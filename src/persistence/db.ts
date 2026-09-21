/**
 * persistence — IndexedDB 项目持久化（Dexie）。
 * localStorage 仅保存轻量偏好（AGENTS.md §13）。
 */
import Dexie, { Table } from 'dexie';
import { z } from 'zod';
import { DEFAULT_PROFILE_ID } from '../standards/registry';

export interface AuditEntry {
  at: string;
  action: string;
  detail?: string;
}

export interface StoredProject {
  id: string;
  schemaVersion: number;
  title: string;
  createdAt: string;
  updatedAt: string;
  standardProfileId: string;
  standardProfileVersion: number;
  experimentId?: string;
  experimentVersion?: number;
  /** 实验元数据（姓名学号等，由实验定义 metadataFields 驱动） */
  metadata: Record<string, string>;
  /** tableId → 行×列的原始输入文本 */
  tables: Record<string, string[][]>;
  /** 参数/仪器设定 rawText */
  params: Record<string, string>;
  /** tableId → 被用户明确排除的行号 */
  excludedRows: Record<string, number[]>;
  auditLog: AuditEntry[];
  notes: string;
  uiState?: Record<string, unknown>;
}

export const CURRENT_SCHEMA_VERSION = 1;

class ProjectDB extends Dexie {
  projects!: Table<StoredProject, string>;

  constructor() {
    super('pea-projects');
    this.version(1).stores({
      // schemaVersion 迁移策略：新增版本时在此追加 upgrade 函数
      projects: 'id, updatedAt, experimentId, standardProfileId',
    });
  }
}

export const db = new ProjectDB();

export function newProjectId(): string {
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function createProject(init: {
  title: string;
  experimentId?: string;
  experimentVersion?: number;
  standardProfileId?: string;
  metadata?: Record<string, string>;
}): Promise<StoredProject> {
  const now = new Date().toISOString();
  const project: StoredProject = {
    id: newProjectId(),
    schemaVersion: CURRENT_SCHEMA_VERSION,
    title: init.title,
    createdAt: now,
    updatedAt: now,
    standardProfileId: init.standardProfileId ?? DEFAULT_PROFILE_ID,
    standardProfileVersion: 1,
    experimentId: init.experimentId,
    experimentVersion: init.experimentVersion,
    metadata: init.metadata ?? {},
    tables: {},
    params: {},
    excludedRows: {},
    auditLog: [],
    notes: '',
  };
  await db.projects.add(project);
  return project;
}

export async function saveProject(project: StoredProject): Promise<void> {
  project.updatedAt = new Date().toISOString();
  await db.projects.put(project);
}

export async function getProject(id: string): Promise<StoredProject | undefined> {
  return db.projects.get(id);
}

export async function listProjects(): Promise<StoredProject[]> {
  const all = await db.projects.toArray();
  return all.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

export async function deleteProject(id: string): Promise<void> {
  await db.projects.delete(id);
}

export async function clearAllProjects(): Promise<void> {
  await db.projects.clear();
}

/** 复制项目：深拷贝、新 id、标题加「副本」，并在审计日志留痕 */
export async function duplicateProject(id: string): Promise<StoredProject | undefined> {
  const src = await db.projects.get(id);
  if (!src) return undefined;
  const now = new Date().toISOString();
  const copy: StoredProject = JSON.parse(JSON.stringify(src)) as StoredProject;
  copy.id = newProjectId();
  copy.title = `${src.title}（副本）`;
  copy.createdAt = now;
  copy.updatedAt = now;
  copy.auditLog = [...copy.auditLog, { at: now, action: 'duplicate', detail: `复制自「${src.title}」` }];
  await db.projects.add(copy);
  return copy;
}

// ---------------------------------------------------------------------------
// JSON 导入导出（带 schema 校验）
// ---------------------------------------------------------------------------

const ProjectSchema = z.object({
  id: z.string(),
  schemaVersion: z.number(),
  title: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  standardProfileId: z.string(),
  standardProfileVersion: z.number(),
  experimentId: z.string().optional(),
  experimentVersion: z.number().optional(),
  metadata: z.record(z.string()),
  tables: z.record(z.array(z.array(z.string()))),
  params: z.record(z.string()),
  excludedRows: z.record(z.array(z.number())),
  auditLog: z.array(z.object({ at: z.string(), action: z.string(), detail: z.string().optional() })),
  notes: z.string(),
  uiState: z.record(z.unknown()).optional(),
});

/** 载荷形态：单项目信封 / 「导出全部」归档信封 / 旧版裸数组或裸对象 */
export type ProjectImportPayloadKind = 'single' | 'archive' | 'legacy';

/** 导入解析结果（纯解析，不触碰 IndexedDB，便于在无库环境测试） */
export interface ProjectImportParseResult {
  ok: boolean;
  payloadKind?: ProjectImportPayloadKind;
  /** 校验通过、可导入的项目 */
  projects: StoredProject[];
  /** 因结构非法或版本过高被跳过的条目数 */
  skipped: number;
  error?: string;
  /** 版本迁移说明 */
  migrationNote?: string;
}

/** 写入 IndexedDB 的导入结果 */
export interface ImportProjectsResult {
  ok: boolean;
  imported: number;
  skipped: number;
  payloadKind?: ProjectImportPayloadKind;
  error?: string;
  migrationNote?: string;
}

export function serializeProject(project: StoredProject): string {
  return JSON.stringify(
    {
      __app__: 'physics-experiment-assistant',
      __exportedAt__: new Date().toISOString(),
      project,
    },
    null,
    2,
  );
}

/** 「导出全部」归档信封：自家备份必须能被自家导入器读回 */
export function serializeProjectsArchive(projects: StoredProject[]): string {
  return JSON.stringify(
    {
      __app__: 'physics-experiment-assistant',
      kind: 'projects-archive',
      schemaVersion: CURRENT_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      projects,
    },
    null,
    2,
  );
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** 逐条校验并做版本迁移；坏条目跳过并计数，不拖垮整个备份 */
function parseProjectEntries(entries: unknown[], kind: ProjectImportPayloadKind): ProjectImportParseResult {
  const projects: StoredProject[] = [];
  const migratedFrom: number[] = [];
  let skipped = 0;
  let firstIssue: string | undefined;
  for (const entry of entries) {
    const check = ProjectSchema.safeParse(entry);
    if (!check.success) {
      skipped += 1;
      firstIssue ??= check.error.issues[0]?.message;
      continue;
    }
    const p = check.data as StoredProject;
    if (p.schemaVersion > CURRENT_SCHEMA_VERSION) {
      skipped += 1;
      firstIssue ??= `schemaVersion=${p.schemaVersion} 高于当前应用支持的 ${CURRENT_SCHEMA_VERSION}`;
      continue;
    }
    if (p.schemaVersion < CURRENT_SCHEMA_VERSION) {
      // 升级迁移钩子：schemaVersion 递增时在此追加
      migratedFrom.push(p.schemaVersion);
      p.schemaVersion = CURRENT_SCHEMA_VERSION;
    }
    projects.push(p);
  }
  const migrationNote = migratedFrom.length > 0
    ? `${migratedFrom.length} 个项目结构已从 v${Math.min(...migratedFrom)} 等旧版本迁移到 v${CURRENT_SCHEMA_VERSION}`
    : undefined;
  if (projects.length === 0) {
    return {
      ok: false, payloadKind: kind, projects, skipped,
      error: `没有可导入的有效项目${firstIssue ? `：${firstIssue}` : ''}`,
      migrationNote,
    };
  }
  return { ok: true, payloadKind: kind, projects, skipped, migrationNote };
}

/**
 * 解析/规范化导入载荷（纯函数）。接受三种载荷：
 * ① 单项目信封 `{__app__, project}`；
 * ② 「导出全部」归档信封 `{__app__, kind:'projects-archive', projects:[...]}`；
 * ③ 旧版裸导出（裸数组 / 裸对象），按各条目尽力校验。
 */
export function parseProjectImport(text: string): ProjectImportParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    return { ok: false, projects: [], skipped: 0, error: `JSON 解析失败：${(err as Error).message}` };
  }

  if (isRecord(parsed) && parsed.__app__ === 'physics-experiment-assistant') {
    // ① 单项目信封（现有格式）
    if ('project' in parsed) {
      const check = ProjectSchema.safeParse(parsed.project);
      if (!check.success) {
        return {
          ok: false, payloadKind: 'single', projects: [], skipped: 1,
          error: `项目结构校验失败：${check.error.issues[0]?.message ?? '未知错误'}`,
        };
      }
      const p = check.data as StoredProject;
      if (p.schemaVersion > CURRENT_SCHEMA_VERSION) {
        return {
          ok: false, payloadKind: 'single', projects: [], skipped: 1,
          error: `项目 schemaVersion=${p.schemaVersion} 高于当前应用支持的 ${CURRENT_SCHEMA_VERSION}，请升级应用`,
        };
      }
      let migrationNote: string | undefined;
      if (p.schemaVersion < CURRENT_SCHEMA_VERSION) {
        const from = p.schemaVersion;
        p.schemaVersion = CURRENT_SCHEMA_VERSION;
        migrationNote = `项目结构已从 v${from} 迁移到 v${CURRENT_SCHEMA_VERSION}`;
      }
      return { ok: true, payloadKind: 'single', projects: [p], skipped: 0, migrationNote };
    }
    // ② 项目归档信封
    if (parsed.kind === 'projects-archive' || Array.isArray(parsed.projects)) {
      if (!Array.isArray(parsed.projects)) {
        return { ok: false, payloadKind: 'archive', projects: [], skipped: 0, error: '项目归档缺少 projects 数组' };
      }
      return parseProjectEntries(parsed.projects, 'archive');
    }
    return { ok: false, projects: [], skipped: 0, error: '无法识别的导出信封（既非单项目也非项目归档）' };
  }

  // ③ 旧版裸导出：裸数组 / 裸对象
  const entries = Array.isArray(parsed) ? parsed : isRecord(parsed) ? [parsed] : [];
  if (entries.length === 0) {
    return { ok: false, projects: [], skipped: 0, error: '不是本项目导出的 JSON 文件（缺少应用标识或可识别的项目数据）' };
  }
  return parseProjectEntries(entries, 'legacy');
}

/** 导入 JSON：Zod 校验后强制重分配 id 再入库，避免与现有项目冲突 */
export async function importProjectJson(json: string): Promise<ImportProjectsResult> {
  const parsed = parseProjectImport(json);
  if (!parsed.ok) {
    return { ok: false, imported: 0, skipped: parsed.skipped, error: parsed.error };
  }
  const now = new Date().toISOString();
  for (const p of parsed.projects) {
    p.id = newProjectId();
    p.updatedAt = now;
    if (parsed.payloadKind === 'single') {
      // 单项目导入沿用旧行为：标题加后缀以示副本；归档/旧版恢复保留原标题
      p.title = `${p.title}（导入）`;
    }
    await db.projects.add(p);
  }
  return {
    ok: true,
    imported: parsed.projects.length,
    skipped: parsed.skipped,
    payloadKind: parsed.payloadKind,
    migrationNote: parsed.migrationNote,
  };
}
