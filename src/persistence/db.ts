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

export interface ImportResult {
  ok: boolean;
  project?: StoredProject;
  error?: string;
  /** 版本迁移说明 */
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

export function deserializeProject(json: string): ImportResult {
  try {
    const parsed = JSON.parse(json);
    if (parsed?.__app__ !== 'physics-experiment-assistant') {
      return { ok: false, error: '不是本项目导出的 JSON 文件（缺少应用标识）' };
    }
    const check = ProjectSchema.safeParse(parsed.project);
    if (!check.success) {
      return { ok: false, error: `项目结构校验失败：${check.error.issues[0]?.message ?? '未知错误'}` };
    }
    const p = check.data as StoredProject;
    let migrationNote: string | undefined;
    if (p.schemaVersion > CURRENT_SCHEMA_VERSION) {
      return { ok: false, error: `项目 schemaVersion=${p.schemaVersion} 高于当前应用支持的 ${CURRENT_SCHEMA_VERSION}，请升级应用` };
    }
    if (p.schemaVersion < CURRENT_SCHEMA_VERSION) {
      // 升级迁移钩子：schemaVersion 递增时在此追加
      p.schemaVersion = CURRENT_SCHEMA_VERSION;
      migrationNote = `项目结构已从 v${p.schemaVersion} 迁移到 v${CURRENT_SCHEMA_VERSION}`;
    }
    return { ok: true, project: p, migrationNote };
  } catch (err) {
    return { ok: false, error: `JSON 解析失败：${(err as Error).message}` };
  }
}

export async function importProjectJson(json: string): Promise<ImportResult> {
  const result = deserializeProject(json);
  if (!result.ok || !result.project) return result;
  // 导入为副本，避免 id 冲突
  result.project.id = newProjectId();
  result.project.title = `${result.project.title}（导入）`;
  result.project.updatedAt = new Date().toISOString();
  await db.projects.add(result.project);
  return result;
}
