/** 完整实验报告导出测试：Markdown 与 LaTeX 的关键节与内容完整性 */
import { describe, expect, it } from 'vitest';
import { resultToMarkdown } from '../export';
import { makeResult } from '../core/results';
import { buildFullReportLatex, buildFullReportMarkdown } from '../export/report';
import { getExperiment } from '../experiments';
import { getProfile } from '../standards/registry';
import { CURRENT_SCHEMA_VERSION, StoredProject } from '../persistence/db';

function makeProject(): StoredProject {
  const now = new Date().toISOString();
  const exp = getExperiment('friction')!;
  const tables: Record<string, string[][]> = {};
  for (const ds of exp.datasets) tables[ds.id] = [ds.columns.map(() => '')];
  // 第一个数据表填入两行示意数据
  const ds0 = exp.datasets[0];
  tables[ds0.id] = [
    ds0.columns.map((_, i) => (i === 0 ? '10.0' : '100')),
    ds0.columns.map((_, i) => (i === 0 ? '20.0' : '150')),
  ];
  return {
    id: 'p_report_test',
    schemaVersion: CURRENT_SCHEMA_VERSION,
    title: '摩擦系数测试报告',
    createdAt: now,
    updatedAt: now,
    standardProfileId: 'tsinghua-a1-2026',
    standardProfileVersion: 1,
    experimentId: 'friction',
    experimentVersion: 1,
    metadata: Object.fromEntries(exp.metadataFields.map((f, i) => [f.id, i === 0 ? '张三' : `值${i}`])),
    tables,
    params: Object.fromEntries(exp.params.map((p) => [p.id, p.defaultText ?? '1'])),
    excludedRows: { [ds0.id]: [1] },
    auditLog: [
      { at: now, action: 'create', detail: '新建项目' },
      { at: now, action: '排除行', detail: `${ds0.title} 第 2 行` },
    ],
    notes: '',
  };
}

describe('buildFullReportMarkdown', () => {
  const project = makeProject();
  const experiment = getExperiment('friction')!;
  const profile = getProfile('tsinghua-a1-2026');
  const computation = experiment.compute(
    { params: project.params, tables: project.tables, excludedRows: project.excludedRows },
    profile,
  );
  const md = buildFullReportMarkdown(project, experiment, computation, profile, { mathStyle: 'dollar' });

  it('包含封面标题与标准信息', () => {
    expect(md).toContain('# 实验报告：');
    expect(md).toContain(experiment.title);
    expect(md).toContain(profile.id);
  });
  it('包含实验信息（metadata）与审计标记', () => {
    expect(md).toContain('## 实验信息');
    expect(md).toContain('张三');
    expect(md).toContain('## 审计日志');
    expect(md).toContain('排除行');
  });
  it('包含参数、数据表与排除行标注', () => {
    expect(md).toContain('## 实验参数');
    expect(md).toContain('## 原始数据与派生量');
    expect(md).toContain('已排除行');
  });
  it('包含规则摘要与诚信声明', () => {
    expect(md).toContain('## 规则与标准');
    expect(md).toContain('主观内容由实验者');
  });
});

describe('buildFullReportLatex', () => {
  const project = makeProject();
  const experiment = getExperiment('friction')!;
  const profile = getProfile('tsinghua-a1-2026');
  const computation = experiment.compute(
    { params: project.params, tables: project.tables, excludedRows: project.excludedRows },
    profile,
  );
  const tex = buildFullReportLatex(project, experiment, computation, profile);

  it('是完整可编译文档结构', () => {
    expect(tex).toContain('\\documentclass');
    expect(tex).toContain('\\begin{document}');
    expect(tex).toContain('\\end{document}');
    expect(tex).toContain('ctexart');
  });
  it('包含各主要章节与 booktabs 表格', () => {
    expect(tex).toContain('\\section{实验信息}');
    expect(tex).toContain('\\section{实验参数}');
    expect(tex).toContain('\\section{原始数据与派生量}');
    expect(tex).toContain('\\section{计算结果}');
    expect(tex).toContain('\\section{规则与标准}');
    expect(tex).toContain('\\toprule');
    expect(tex).toContain('\\section{审计日志}');
  });
  it('特殊字符已转义：无裸 ±；中文信息保留', () => {
    expect(tex).not.toContain('±');
    expect(tex).toContain('张三');
  });
});


it('escapes user metadata in Markdown tables and LaTeX text', () => {
  const project = makeProject();
  const experiment = getExperiment('friction')!;
  const profile = getProfile('tsinghua-a1-2026');
  project.metadata[experiment.metadataFields[0].id] = 'A|B {组}_50%\\name';
  const computation = experiment.compute({ params: project.params, tables: project.tables, excludedRows: project.excludedRows }, profile);
  const md = buildFullReportMarkdown(project, experiment, computation, profile, { mathStyle: 'dollar' });
  expect(md).toContain(String.raw`A\|B {组}_50%\\name`);
  const tex = buildFullReportLatex(project, experiment, computation, profile);
  expect(tex).toContain(String.raw`A|B \{组\}\_50\%\textbackslash{}name`);
  expect(tex).not.toContain(String.raw`\textbackslash{}quad`);
});

it('exports final equations as standalone Markdown math blocks', () => {
  const md = resultToMarkdown(makeResult({ id: 'test', title: '结果', symbol: 'x', finalText: '1.00', unit: 'm' }), 'dollar');
  expect(md).toContain('最终结果：\n\n$$');
  expect(md).not.toContain('最终结果：$$');
});
