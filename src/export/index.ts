/**
 * 导出模块（plan §12）：Markdown 数据处理片段 / LaTeX / CSV / JSON。
 * 图 SVG/PNG 由 PhysicsPlot 组件内导出。
 */
import { StoredProject, serializeProject } from '../persistence/db';
import { ExperimentDefinition, ExperimentComputation, DatasetDefinition, ComputedFit } from '../experiments/types';
import { parseTable } from '../experiments/engine';
import { StandardProfile } from '../standards/types';
import { ResultItem } from '../core/results';
import { useSettings } from '../stores/settings';

/** LaTeX 单位包裹：`\mathrm{}`（默认）或 `\text{}`，由设置 latexUnitStyle 决定 */
function unitTex(unit: string, latexUnitStyle: boolean): string {
  const escaped = unit.replace(/%/g, '\\%');
  return latexUnitStyle ? `\\,\\mathrm{${escaped}}` : `\\,\\text{${escaped}}`;
}

/** 未显式传参时读取当前全局设置（调用方无法改签名时的最小侵入接线） */
function resolveLatexUnitStyle(explicit?: boolean): boolean {
  return explicit ?? useSettings.getState().latexUnitStyle;
}

/** CSV 转义 */
export function toCSV(rows: string[][]): string {
  return rows
    .map((row) => row.map((cell) => {
      const v = (cell ?? '').trim();
      if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
      return v;
    }).join(','))
    .join('\r\n');
}

export function tableToCSV(dataset: DatasetDefinition, project: StoredProject): string {
  const raw = project.tables[dataset.id] ?? [];
  const excluded = project.excludedRows[dataset.id] ?? [];
  const header = dataset.columns.map((c) => (c.unit ? `${c.header} (${c.unit})` : c.header));
  const body = raw
    .map((row, i) => ({ row, i }))
    .filter(({ row }) => row.some((cell) => (cell ?? '').trim() !== ''))
    .map(({ row, i }) => [
      excluded.includes(i) ? '#' : String(i + 1),
      ...dataset.columns.map((col, j) => (row[j] ?? '').trim() || '—'),
    ]);
  return toCSV([['行', ...header], ...body]);
}

/** 数据表 → Markdown（原始输入列 + 派生列计算值分开呈现，保留行号） */
export function tableToMarkdown(dataset: DatasetDefinition, project: StoredProject): string {
  const parsed = parseTable(dataset, { params: project.params, tables: project.tables, excludedRows: project.excludedRows });
  const raw = project.tables[dataset.id] ?? [];
  const inputCols = dataset.columns.filter((c) => c.kind === 'input');
  const derivedCols = dataset.columns.filter((c) => c.kind === 'derived');
  const lines = [
    `**${dataset.title}**`,
    '',
    `| 行 | ${inputCols.map((c) => (c.unit ? `${c.header} (${c.unit})` : c.header)).join(' | ')} |`,
    `|---|${inputCols.map(() => '---').join('|')}|`,
  ];
  raw.forEach((row, i) => {
    if (row.every((cell) => (cell ?? '').trim() === '')) return;
    const values = inputCols.map((col) => (row[dataset.columns.indexOf(col)] ?? '').trim() || '—');
    lines.push(`| ${i + 1} | ${values.map(markdownCell).join(' | ')} |`);
  });
  if (derivedCols.length > 0 && parsed.n > 0) {
    lines.push('', `派生列（${derivedCols.map((c) => c.header).join('、')}）：`);
    lines.push(`| 行 | ${inputCols.map((x) => x.header).join(' | ')} | ${derivedCols.map((c) => c.header).join(' | ')} |`);
    lines.push(`|---|${inputCols.map(() => '---').join('|')}|${derivedCols.map(() => '---').join('|')}|`);
    parsed.rows.forEach((row, i) => {
      const ins = inputCols.map((x) => (parsed.rawRows[i]?.[x.id] ?? '').trim() || '—');
      const dvs = derivedCols.map((c) => (Number.isFinite(row[c.id]) ? Number(row[c.id].toPrecision(6)).toString() : '—'));
      lines.push(`| ${i + 1} | ${ins.map(markdownCell).join(' | ')} | ${dvs.join(' | ')} |`);
    });
  }
  return lines.join('\n');
}

/** 结果项 → Markdown（公式 → 代入 → 未修约 → 最终表达） */
export function resultToMarkdown(item: ResultItem, mathStyle: 'dollar' | 'parens', latexUnitStyle?: boolean): string {  const block = (tex: string) => (mathStyle === 'dollar' ? `$$${tex}$$` : `\\[${tex}\\]`);
  const lines: string[] = [`**${item.title}**`];
  if (item.finalText) {
    const uTex = item.unit ? unitTex(item.unit, resolveLatexUnitStyle(latexUnitStyle)) : '';
    lines.push('', '最终结果：', '', block(`${item.symbol ?? ''}${item.symbol ? ' = ' : ''}${texSafe(item.finalText)}${uTex}`));
    if (item.relativeText) lines.push('', `相对不确定度：${item.relativeText}`);
  }
  for (const s of item.steps) {
    if (s.formulaLatex) lines.push('', block(s.formulaLatex));
    if (s.substitution) lines.push('', '```text', s.substitution, '```');
    if (s.unrounded) lines.push(`未修约值：\`${s.unrounded}\``);
    if (s.note) lines.push(s.note);
  }
  if (item.components && item.components.length > 0) {
    lines.push('', '| 分量 | 数值 | 贡献率 |', '|---|---|---|');
    for (const c of item.components) {
      lines.push(`| ${stripTex(c.symbol)} | ${c.value.toPrecision(6)} | ${c.fraction !== undefined ? `${(c.fraction * 100).toFixed(1)}%` : '—'} |`);
    }
  }
  if (item.roundingNote) lines.push('', `修约依据：${item.roundingNote}`);
  if (item.ruleNotes && item.ruleNotes.length) lines.push('', `规则：${item.ruleNotes.join('；')}`);
  if (item.provenance) {
    lines.push('', `来源：${item.provenance.status}${item.provenance.document ? `（${item.provenance.document}${item.provenance.section ? '，' + item.provenance.section : ''}）` : ''}`);
  }
  return lines.join('\n');
}

export function texSafe(s: string): string {
  // ± 在 KaTeX 可用 \\pm
  return s.replace(/±/g, '\\pm ').replace(/°/g, '^\\circ ');
}

export function stripTex(s: string): string {
  return s.replace(/\\/g, '').replace(/[{}]/g, '');
}

/**
 * 完整"数据处理"报告片段（plan §12.2）。
 * 只生成客观计算内容；不编造实验现象与结论（AGENTS §18）。
 */
export function buildDataProcessingMarkdown(
  project: StoredProject,
  experiment: ExperimentDefinition,
  computation: ExperimentComputation,
  profile: StandardProfile,
  mathStyle: 'dollar' | 'parens' = 'dollar',
  latexUnitStyle?: boolean,
): string {
  const m = (tex: string) => (mathStyle === 'dollar' ? `$$${tex}$$` : `\\[${tex}\\]`);
  const lines: string[] = [];
  lines.push('### 数据处理');
  lines.push('', `> 标准：${profile.name}（${profile.id} v${profile.version}）；实验：${experiment.title} v${experiment.version}；软件生成数据处理片段，不含主观结论。`);
  lines.push('', `规则摘要：${profile.rulesSummary.slice(0, 4).join('；')}…`);

  // 参数
  const filledParams = experiment.params.filter((p) => (project.params[p.id] ?? '').trim() !== '');
  if (filledParams.length > 0) {
    lines.push('', '#### 参数', '', '| 参数 | 数值 | 单位 |', '|---|---|---|');
    for (const p of filledParams) {
      lines.push(`| ${markdownCell(p.label)} | ${markdownCell(project.params[p.id])} | ${markdownCell(p.unit ?? '')} |`);
    }
  }

  // 数据表
  for (const ds of experiment.datasets) {
    const has = (project.tables[ds.id] ?? []).some((r) => r.some((c) => (c ?? '').trim() !== ''));
    if (has) {
      lines.push('', '#### ' + ds.title, '', tableToMarkdown(ds, project));
      const excluded = project.excludedRows[ds.id] ?? [];
      if (excluded.length > 0) {
        lines.push('', `已排除行（用户明确操作，保留审计）：${excluded.map((i) => i + 1).join('、')}`);
      }
    }
  }

  // 拟合
  const fitEntries = Object.values(computation.fits).filter((f): f is ComputedFit => 'spec' in f);
  if (fitEntries.length > 0) {
    lines.push('', '#### 拟合结果');
    for (const f of fitEntries) {
      lines.push('', `**${f.spec.title}**`, '', m(f.spec.modelLatex));
      if (f.ols) {
        lines.push('', `a = \`${f.ols.a.toPrecision(8)}\`，b = \`${f.ols.b.toPrecision(8)}\`，r = \`${f.ols.r.toPrecision(6)}\`（n=${f.ols.n}，ν=${f.ols.dof}，t=${f.ols.t.toPrecision(6)}）`);
        lines.push('', `Sa = \`${f.ols.sa.toPrecision(8)}\`，Sb = \`${f.ols.sb.toPrecision(8)}\`，Δa = \`${f.ols.deltaA.toPrecision(8)}\`，Δb = \`${f.ols.deltaB.toPrecision(8)}\``);
      } else if (f.origin) {
        lines.push('', `b = \`${f.origin.b.toPrecision(8)}\`，R² = \`${f.origin.r2.toPrecision(6)}\`（过原点，ν=${f.origin.dof}）`);
      }
    }
  }

  // 结果
  lines.push('', '#### 计算结果');
  for (const item of computation.results) {
    lines.push('', resultToMarkdown(item, mathStyle, latexUnitStyle), '---');
  }

  // 诊断（客观）
  if (computation.diagnostics.length > 0) {
    lines.push('', '#### 数据诊断（客观提示）');
    for (const d of computation.diagnostics) lines.push(`- ${d}`);
  }

  lines.push('', '---', '', '> 本片段由物理实验小助手按可追溯计算链生成；实验现象、误差分析等主观内容由实验者撰写。');
  return lines.join('\n');
}

/** 当前结果 LaTeX（最终表达） */
export function buildResultLatex(computation: ExperimentComputation, latexUnitStyle?: boolean): string {
  const style = resolveLatexUnitStyle(latexUnitStyle);
  const lines: string[] = ['% 数据处理结果（物理实验小助手生成）'];
  for (const item of computation.results) {
    if (!item.finalText) continue;
    const unit = item.unit ? unitTex(item.unit, style) : '';
    const sym = item.symbol ? item.symbol.replace(/\\/g, '') : '\\text{result}';
    lines.push(`% ${item.title}`);
    lines.push(`${sym} = ${texSafe(item.finalText)}${unit}`);
  }
  return lines.join('\n');
}

export { serializeProject };

/**
 * 公式计算完整过程 Markdown（AGENTS §12：公式 → 数值代入 → 未修约值 → 修约依据 → 最终表达）。
 * 供公式详情页「复制/下载 .md」使用。
 */
export function buildFormulaProcessMarkdown(
  formula: { title: string; latex: string; conditions?: string; variables: { name: string; label: string; unit: string }[]; provenance?: { status: string; document?: string; section?: string } },
  item: ResultItem,
  opts: { profileName: string; mathStyle: 'dollar' | 'parens'; latexUnitStyle?: boolean;
    inputs?: { name: string; rawText: string; unit: string; uncertaintyRaw: string; convertedValue?: number; convertedUnit: string }[] },
): string {
  const block = (tex: string) => (opts.mathStyle === 'dollar' ? `$$${tex}$$` : `\\[${tex}\\]`);
  const lines: string[] = [];
  lines.push(`## 公式计算：${formula.title}`, '');
  lines.push(block(formula.latex), '');
  lines.push('| 变量 | 含义 | 单位 |', '|---|---|---|');
  for (const v of formula.variables) {
    lines.push(`| \`${v.name}\` | ${v.label} | ${v.unit || '—'} |`);
  }
  if (opts.inputs?.length) {
    lines.push('', '### 本次输入', '', '| 变量 | 原始输入 | 输入单位 | 输入不确定度 | 换算值 | 计算单位 |', '|---|---|---|---|---|---|');
    for (const input of opts.inputs) {
      lines.push(`| ${[input.name, input.rawText, input.unit || '—', input.uncertaintyRaw || '未提供', input.convertedValue === undefined ? '—' : String(input.convertedValue), input.convertedUnit || '—'].map(markdownCell).join(' | ')} |`);
    }
  }
  if (formula.conditions) lines.push('', `适用条件：${formula.conditions}`);
  lines.push('', '### 计算过程', '', resultToMarkdown(item, opts.mathStyle, opts.latexUnitStyle));
  lines.push('', '---', '', `> 由物理实验小助手生成；标准：${opts.profileName}；时间：${new Date().toISOString()}`);
  return lines.join('\n');
}

/** 触发浏览器下载文本文件（Markdown / LaTeX / CSV / JSON） */
export function downloadTextFile(filename: string, text: string, mime = 'text/markdown'): void {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.replace(/[\\/:*?"<>|]/g, '_');
  a.click();
  URL.revokeObjectURL(url);
}

/** Escape report table text without changing stored raw inputs. */
export function markdownCell(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' ');
}
