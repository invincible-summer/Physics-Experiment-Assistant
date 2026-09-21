/**
 * 持久化导入/导出测试（AGENTS §13）。
 * 测试环境无 IndexedDB，因此只覆盖纯函数：serializeProject(s) / parseProjectImport；
 * 入库与强制重分配 id 的行为由 importProjectJson 在浏览器侧承担。
 */
import { describe, expect, it } from 'vitest';
import {
  CURRENT_SCHEMA_VERSION, parseProjectImport, serializeProject, serializeProjectsArchive,
  StoredProject,
} from '../persistence/db';

function makeProject(over: Partial<StoredProject> = {}): StoredProject {
  const now = new Date().toISOString();
  return {
    id: `p_test_${Math.random().toString(36).slice(2, 8)}`,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    title: '测试项目',
    createdAt: now,
    updatedAt: now,
    standardProfileId: 'tsinghua-a1-2026',
    standardProfileVersion: 1,
    experimentId: 'friction',
    experimentVersion: 1,
    metadata: { name: '张三' },
    tables: { t1: [['1.0', '2.0'], ['', '3.0']] },
    params: { g: '9.8' },
    excludedRows: { t1: [1] },
    auditLog: [{ at: now, action: 'create', detail: '测试' }],
    notes: '',
    ...over,
  };
}

function archiveText(projects: unknown[]): string {
  return JSON.stringify({
    __app__: 'physics-experiment-assistant',
    kind: 'projects-archive',
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    projects,
  });
}

describe('项目导出格式', () => {
  it('「导出全部」使用 projects-archive 信封（AGENTS §13 可复核备份）', () => {
    const raw = JSON.parse(serializeProjectsArchive([makeProject()]));
    expect(raw.__app__).toBe('physics-experiment-assistant');
    expect(raw.kind).toBe('projects-archive');
    expect(raw.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(typeof raw.exportedAt).toBe('string');
    expect(Array.isArray(raw.projects)).toBe(true);
  });
});

describe('parseProjectImport 三种载荷', () => {
  it('归档往返：2 个项目导出为 archive 后解析回相同数量与标题', () => {
    const a = makeProject({ title: '摩擦系数测量' });
    const b = makeProject({ title: '霍尔效应及磁电阻测量' });
    const parsed = parseProjectImport(serializeProjectsArchive([a, b]));
    expect(parsed.ok).toBe(true);
    expect(parsed.payloadKind).toBe('archive');
    expect(parsed.projects).toHaveLength(2);
    expect(parsed.skipped).toBe(0);
    expect(parsed.projects.map((p) => p.title)).toEqual(['摩擦系数测量', '霍尔效应及磁电阻测量']);
    // 解析阶段不重分配 id（入库时才强制重分配）
    expect(parsed.projects[0].id).toBe(a.id);
  });

  it('单项目信封保持兼容（serializeProject 现有格式）', () => {
    const p = makeProject({ title: '单项目备份' });
    const parsed = parseProjectImport(serializeProject(p));
    expect(parsed.ok).toBe(true);
    expect(parsed.payloadKind).toBe('single');
    expect(parsed.projects).toHaveLength(1);
    expect(parsed.skipped).toBe(0);
    expect(parsed.projects[0].title).toBe('单项目备份');
    expect(parsed.projects[0].tables).toEqual(p.tables);
  });

  it('归档中的坏条目被跳过且计数正确', () => {
    const good1 = makeProject({ title: '好项目一' });
    const good2 = makeProject({ title: '好项目二' });
    const bad = { id: 123, title: '缺字段的坏条目' };
    const parsed = parseProjectImport(archiveText([good1, bad, good2]));
    expect(parsed.ok).toBe(true);
    expect(parsed.payloadKind).toBe('archive');
    expect(parsed.projects.map((p) => p.title)).toEqual(['好项目一', '好项目二']);
    expect(parsed.skipped).toBe(1);
  });

  it('旧版裸数组导出按各条目尽力校验导入', () => {
    const p = makeProject({ title: '旧版裸数组项目' });
    const parsed = parseProjectImport(JSON.stringify([p]));
    expect(parsed.ok).toBe(true);
    expect(parsed.payloadKind).toBe('legacy');
    expect(parsed.projects[0].title).toBe('旧版裸数组项目');
  });

  it('旧版裸对象导出可导入', () => {
    const p = makeProject({ title: '旧版裸对象项目' });
    const parsed = parseProjectImport(JSON.stringify(p));
    expect(parsed.ok).toBe(true);
    expect(parsed.payloadKind).toBe('legacy');
    expect(parsed.projects).toHaveLength(1);
    expect(parsed.skipped).toBe(0);
  });

  it('旧版裸数组中的坏条目同样被跳过计数', () => {
    const p = makeProject();
    const parsed = parseProjectImport(JSON.stringify([p, { nope: true }, 42]));
    expect(parsed.ok).toBe(true);
    expect(parsed.projects).toHaveLength(1);
    expect(parsed.skipped).toBe(2);
  });
});

describe('parseProjectImport 失败与版本迁移', () => {
  it('完全无关的 JSON 被拒绝', () => {
    expect(parseProjectImport('not json at all').ok).toBe(false);
    expect(parseProjectImport('[]').ok).toBe(false);
    expect(parseProjectImport('{"foo":1}').ok).toBe(false);
    expect(parseProjectImport(JSON.stringify({ __app__: 'other-app', project: makeProject() })).ok).toBe(false);
  });

  it('schemaVersion 高于当前版本：单项目报错，归档中跳过并计数', () => {
    const tooNew = makeProject({ schemaVersion: CURRENT_SCHEMA_VERSION + 1 });
    const single = parseProjectImport(JSON.stringify({
      __app__: 'physics-experiment-assistant',
      project: tooNew,
    }));
    expect(single.ok).toBe(false);
    expect(single.error).toContain('schemaVersion');

    const archive = parseProjectImport(archiveText([tooNew]));
    expect(archive.ok).toBe(false);
    expect(archive.skipped).toBe(1);
  });

  it('schemaVersion 低于当前版本自动迁移并附说明', () => {
    const old = makeProject({ schemaVersion: 0 });
    const parsed = parseProjectImport(archiveText([old]));
    expect(parsed.ok).toBe(true);
    expect(parsed.projects[0].schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(parsed.migrationNote).toContain('迁移');
  });

  it('全部条目无效时整体失败并给出首条原因', () => {
    const parsed = parseProjectImport(archiveText([{ bad: 1 }, { bad: 2 }]));
    expect(parsed.ok).toBe(false);
    expect(parsed.skipped).toBe(2);
    expect(parsed.error).toBeTruthy();
  });
});
