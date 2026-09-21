/**
 * 完整实验报告导出（Markdown / LaTeX）。
 * 在「数据处理片段」基础上补齐：封面与实验信息（metadata）、审计日志、规则全文、生成信息。
 * 只输出客观计算链与可追溯信息，不编造实验现象与结论（AGENTS §18）。
 */
import { StoredProject } from '../persistence/db';
import { ExperimentDefinition, ExperimentComputation } from '../experiments/types';
import { StandardProfile } from '../standards/types';
import { parseTable } from '../experiments/engine';
import {
  resultToMarkdown, tableToMarkdown, texSafe, stripTex,
} from './index';

export interface ReportOptions {
  mathStyle: 'dollar' | 'parens';
  /** true：单位用 \mathrm{}；false：\text{} */
  latexUnitStyle?: boolean;
}

/* ============================== Markdown ============================== */

export function buildFullReportMarkdown(
  project: StoredProject,
  experiment: ExperimentDefinition,
  computation: ExperimentComputation,
  profile: StandardProfile,
  opts: ReportOptions,
): string {
  const lines: string[] = [];
  const now = new Date();

  // 封面
  lines.push(`# 实验报告：${experiment.title}`);
  lines.push('');
  lines.push(`> ${experiment.subtitle ?? experiment.category} · 生成时间：${now.toLocaleString('zh-CN')} · 标准：${profile.name}（${profile.id} v${profile.version}）`);

  // 实验信息
  const metaRows = experiment.metadataFields
    .map((f) => ({ label: f.label, value: (project.metadata[f.id] ?? '').trim() }))
    .filter((r) => r.value !== '');
  lines.push('', '## 实验信息', '');
  lines.push('| 项目 | 内容 |', '|---|---|');
  lines.push(`| 实验名称 | ${experiment.title} |`);
  for (const r of metaRows) lines.push(`| ${r.label} | ${r.value} |`);
  lines.push(`| 项目创建 | ${formatTime(project.createdAt)} |`);
  lines.push(`| 最近修改 | ${formatTime(project.updatedAt)} |`);

  // 参数
  const filledParams = experiment.params.filter((p) => (project.params[p.id] ?? '').trim() !== '');
  if (filledParams.length > 0) {
    lines.push('', '## 实验参数', '', '| 参数 | 数值 | 单位 |', '|---|---|---|');
    for (const p of filledParams) {
      lines.push(`| ${p.label} | ${project.params[p.id]} | ${p.unit ?? ''} |`);
    }
  }

  // 数据表
  lines.push('', '## 原始数据与派生量');
  let anyTable = false;
  for (const ds of experiment.datasets) {
    const has = (project.tables[ds.id] ?? []).some((r) => r.some((c) => (c ?? '').trim() !== ''));
    if (!has) continue;
    anyTable = true;
    lines.push('', `### ${ds.title}`, '', tableToMarkdown(ds, project));
    const excluded = project.excludedRows[ds.id] ?? [];
    if (excluded.length > 0) {
      lines.push('', `已排除行（用户明确操作，保留审计）：${excluded.map((i) => i + 1).join('、')}`);
    }
  }
  if (!anyTable) lines.push('', '（未录入数据表）');

  // 拟合
  const fitEntries = Object.values(computation.fits).filter((f): f is import('../experiments/types').ComputedFit => 'spec' in f);
  if (fitEntries.length > 0) {
    const m = (tex: string) => (opts.mathStyle === 'dollar' ? `$$${tex}$$` : `\\[${tex}\\]`);
    lines.push('', '## 拟合结果');
    for (const f of fitEntries) {
      lines.push('', `**${f.spec.title}**：${m(f.spec.modelLatex)}`);
      if (f.ols) {
        lines.push('', `a = \`${f.ols.a.toPrecision(8)}\`，b = \`${f.ols.b.toPrecision(8)}\`，r = \`${f.ols.r.toPrecision(6)}\`（n=${f.ols.n}，ν=${f.ols.dof}，t=${f.ols.t.toPrecision(6)}）`);
        lines.push('', `Sa = \`${f.ols.sa.toPrecision(8)}\`，Sb = \`${f.ols.sb.toPrecision(8)}\`，Δa = \`${f.ols.deltaA.toPrecision(8)}\`，Δb = \`${f.ols.deltaB.toPrecision(8)}\``);
      } else if (f.origin) {
        lines.push('', `b = \`${f.origin.b.toPrecision(8)}\`，R² = \`${f.origin.r2.toPrecision(6)}\`（过原点，ν=${f.origin.dof}）`);
      }
    }
  }

  // 结果
  lines.push('', '## 计算结果');
  for (const item of computation.results) {
    lines.push('', resultToMarkdown(item, opts.mathStyle, opts.latexUnitStyle), '', '---');
  }

  // 规则
  lines.push('', '## 规则与标准', '');
  lines.push(`当前标准：**${profile.name}**（${profile.id} v${profile.version}）。规则摘要：`);
  for (const r of profile.rulesSummary) lines.push(`- ${r}`);

  // 诊断
  if (computation.diagnostics.length > 0) {
    lines.push('', '## 数据诊断（客观提示）', '');
    for (const d of computation.diagnostics) lines.push(`- ${d}`);
  }

  // 审计
  if (project.auditLog.length > 0) {
    lines.push('', '## 审计日志', '');
    for (const a of project.auditLog) {
      lines.push(`- ${formatTime(a.at)} — **${a.action}**${a.detail ? `：${a.detail}` : ''}`);
    }
  }

  lines.push(
    '', '---', '',
    '> 本报告由物理实验小助手按可追溯计算链自动生成；实验现象描述、误差分析与结论等主观内容由实验者本人撰写补充。',
    `> 软件：物理实验小助手（纯前端，数据仅存本地浏览器）；实验定义 v${experiment.version}；报告时间 ${now.toISOString()}。`,
  );
  return lines.join('\n');
}

/* ============================== LaTeX ============================== */

/** LaTeX 文本转义（数学段不走这里） */
function texEscape(text: string): string {
  return text
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/([%&#_$])/g, '\\$1')
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/\^/g, '\\textasciicircum{}');
}

/** 数据表单元格文本转义（含 — 与单位原样） */
const cell = (s: string) => texEscape(s);

export function buildFullReportLatex(
  project: StoredProject,
  experiment: ExperimentDefinition,
  computation: ExperimentComputation,
  profile: StandardProfile,
  opts: { latexUnitStyle?: boolean } = {},
): string {
  const unit = (u: string) => (opts.latexUnitStyle ?? true) ? `\\,\\mathrm{${u.replace(/%/g, '\\%')}}` : `\\,\\text{${u.replace(/%/g, '\\%')}}`;
  const L: string[] = [];
  const push = (...xs: string[]) => L.push(...xs);

  push(
    '% !TEX program = xelatex',
    '% 物理实验小助手 · 完整实验报告（需要 ctex 宏包支持中文）',
    '\\documentclass[12pt]{ctexart}',
    '\\usepackage{amsmath,amssymb,booktabs,geometry,longtable,array}',
    '\\geometry{margin=2.4cm}',
    `\\title{${texEscape(`实验报告：${experiment.title}`)}}`,
    `\\author{${texEscape(experiment.metadataFields.map((f) => (project.metadata[f.id] ?? '').trim()).filter(Boolean).join(' \\quad ') || ' ')}}`,
    `\\date{${texEscape(new Date().toLocaleDateString('zh-CN'))}}`,
    '\\begin{document}',
    '\\maketitle',
  );

  // 实验信息
  push('', '\\section{实验信息}', '', '\\begin{tabular}{ll}', '\\toprule');
  push(`\\multicolumn{1}{l}{项目} & 内容 \\\\`, '\\midrule');
  push(`实验名称 & ${texEscape(experiment.title)} \\\\`);
  for (const f of experiment.metadataFields) {
    const v = (project.metadata[f.id] ?? '').trim();
    if (v) push(`${texEscape(f.label)} & ${texEscape(v)} \\\\`);
  }
  push(`标准 & ${texEscape(`${profile.name}（${profile.id} v${profile.version}）`)} \\\\`);
  push('\\bottomrule', '\\end{tabular}');

  // 参数
  const filledParams = experiment.params.filter((p) => (project.params[p.id] ?? '').trim() !== '');
  if (filledParams.length > 0) {
    push('', '\\section{实验参数}', '', '\\begin{tabular}{lll}', '\\toprule', '参数 & 数值 & 单位 \\\\', '\\midrule');
    for (const p of filledParams) {
      push(`${texEscape(p.label)} & ${cell(project.params[p.id])} & ${texEscape(p.unit ?? '')} \\\\`);
    }
    push('\\bottomrule', '\\end{tabular}');
  }

  // 数据表
  push('', '\\section{原始数据与派生量}');
  let anyTable = false;
  for (const ds of experiment.datasets) {
    const raw = project.tables[ds.id] ?? [];
    if (!raw.some((r) => r.some((c) => (c ?? '').trim() !== ''))) continue;
    anyTable = true;
    const parsed = parseTable(ds, { params: project.params, tables: project.tables, excludedRows: project.excludedRows });
    const inputCols = ds.columns.filter((c) => c.kind !== 'derived');
    const derivedCols = ds.columns.filter((c) => c.kind === 'derived');
    push('', `\\subsection{${texEscape(ds.title)}}`, '');
    const colsSpec = `l${'r'.repeat(inputCols.length)}`;
    push(`\\begin{tabular}{${colsSpec}}`, '\\toprule');
    push(`行号 & ${inputCols.map((c) => texEscape(c.unit ? `${c.header}（${c.unit}）` : c.header)).join(' & ')} \\\\`, '\\midrule');
    raw.forEach((row, i) => {
      if (row.every((c) => (c ?? '').trim() === '')) return;
      const excluded = (project.excludedRows[ds.id] ?? []).includes(i);
      const values = inputCols.map((c) => cell((row[ds.columns.indexOf(c)] ?? '').trim() || '—'));
      push(`${excluded ? `\\textit{${i + 1}（已排除）}` : String(i + 1)} & ${values.join(' & ')} \\\\`);
    });
    push('\\bottomrule', '\\end{tabular}');
    if (derivedCols.length > 0 && parsed.n > 0) {
      push('', '派生列（按定义表达式计算，未修约完整精度截取 6 位有效数字显示）：', '');
      const dSpec = `l${'r'.repeat(derivedCols.length)}`;
      push(`\\begin{tabular}{${dSpec}}`, '\\toprule');
      push(`行号 & ${derivedCols.map((c) => texEscape(c.header)).join(' & ')} \\\\`, '\\midrule');
      parsed.rows.forEach((row, i) => {
        const dvs = derivedCols.map((c) => (Number.isFinite(row[c.id]) ? Number(row[c.id].toPrecision(6)).toString() : '—'));
        push(`${i + 1} & ${dvs.join(' & ')} \\\\`);
      });
      push('\\bottomrule', '\\end{tabular}');
    }
  }
  if (!anyTable) push('', '（未录入数据表）');

  // 拟合
  const fitEntries = Object.values(computation.fits).filter((f): f is import('../experiments/types').ComputedFit => 'spec' in f);
  if (fitEntries.length > 0) {
    push('', '\\section{拟合结果}');
    for (const f of fitEntries) {
      push('', `\\subsection{${texEscape(f.spec.title)}}`, '', `\\[${f.spec.modelLatex}\\]`);
      if (f.ols) {
        push(`\\[a = ${f.ols.a.toPrecision(8)},\\quad b = ${f.ols.b.toPrecision(8)},\\quad r = ${f.ols.r.toPrecision(6)}\\]`);
        push(`\\[S_a = ${f.ols.sa.toPrecision(8)},\\quad S_b = ${f.ols.sb.toPrecision(8)},\\quad \\Delta_a = ${f.ols.deltaA.toPrecision(8)},\\quad \\Delta_b = ${f.ols.deltaB.toPrecision(8)}\\]`);
        push(`（n=${f.ols.n}，$\\nu=${f.ols.dof}$，$t=${f.ols.t.toPrecision(6)}$）`);
      } else if (f.origin) {
        push(`\\[b = ${f.origin.b.toPrecision(8)},\\quad R^2 = ${f.origin.r2.toPrecision(6)}\\]`);
        push(`（过原点拟合，$\\nu=${f.origin.dof}$）`);
      }
    }
  }

  // 结果
  push('', '\\section{计算结果}');
  for (const item of computation.results) {
    push('', `\\subsection{${texEscape(item.title)}}`);
    if (item.finalText) {
      const sym = item.symbol ? `${item.symbol} = ` : '';
      push('', `\\[${sym}${texSafe(item.finalText)}${item.unit ? unit(item.unit) : ''}\\]`);
      if (item.relativeText) push(`相对不确定度：${texEscape(item.relativeText)}。`);
    }
    for (const s of item.steps) {
      if (s.formulaLatex) push('', `\\[${s.formulaLatex}\\]`);
      if (s.substitution) push('', `\\begin{quote}\\small\\ttfamily ${texEscape(s.substitution)}\\end{quote}`);
      if (s.unrounded) push(`未修约值：\\texttt{${texEscape(s.unrounded)}}`);
    }
    if (item.components && item.components.length > 0) {
      push('', '\\begin{tabular}{lrr}', '\\toprule', '分量 & 数值 & 贡献率 \\\\', '\\midrule');
      for (const c of item.components) {
        push(`${texEscape(stripTex(c.symbol))} & ${c.value.toPrecision(6)} & ${c.fraction !== undefined ? `${(c.fraction * 100).toFixed(1)}\\%` : '—'} \\\\`);
      }
      push('\\bottomrule', '\\end{tabular}');
    }
    if (item.roundingNote) push('', `修约依据：${texEscape(item.roundingNote)}`);
    if (item.ruleNotes && item.ruleNotes.length > 0) push('', `规则：${texEscape(item.ruleNotes.join('；'))}`);
    if (item.provenance) {
      push('', `来源：${texEscape(`${item.provenance.status}${item.provenance.document ? `（${item.provenance.document}${item.provenance.section ? '，' + item.provenance.section : ''}）` : ''}`)}`);
    }
  }

  // 规则摘要
  push('', '\\section{规则与标准}', '', `当前标准：\\textbf{${texEscape(profile.name)}}（${texEscape(`${profile.id} v${profile.version}`)}）。`, '', '\\begin{itemize}');
  for (const r of profile.rulesSummary) push(`\\item ${texEscape(r)}`);
  push('\\end{itemize}');

  // 诊断
  if (computation.diagnostics.length > 0) {
    push('', '\\section{数据诊断（客观提示）}', '', '\\begin{itemize}');
    for (const d of computation.diagnostics) push(`\\item ${texEscape(d)}`);
    push('\\end{itemize}');
  }

  // 审计附录
  if (project.auditLog.length > 0) {
    push('', '\\appendix', '\\section{审计日志}', '', '\\begin{itemize}');
    for (const a of project.auditLog) {
      push(`\\item ${texEscape(`${formatTime(a.at)} — ${a.action}${a.detail ? `：${a.detail}` : ''}`)}`);
    }
    push('\\end{itemize}');
  }

  push(
    '',
    '\\paragraph{生成说明} 本报告由物理实验小助手按可追溯计算链自动生成；实验现象描述、误差分析与结论等主观内容由实验者本人撰写补充。',
    `实验定义版本 v${experiment.version}；生成时间 ${texEscape(new Date().toISOString())}。`,
    '',
    '\\end{document}',
  );
  return L.join('\n');
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('zh-CN', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
