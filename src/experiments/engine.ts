/** 实验引擎：表格解析（输入列 + 派生列 + 排除行）与通用拟合/绘图装配 */
import { DatasetDefinition, ExperimentState, FitSpec, ParsedTable } from './types';
import { parseNumericText } from '../core/numeric';
import { compileExpression, evaluateExpression } from '../core/expression';
import { ols, olsThroughOrigin } from '../core/regression';
import { ComputedFit } from './types';

/** 解析表格：把 string[][] 转成数值行；无效/空单元格置 NaN；排除行剔除；派生列自动求值 */
export function parseTable(
  dataset: DatasetDefinition,
  state: ExperimentState,
  paramScope: Record<string, number> = {},
): ParsedTable {
  const rowsRaw = state.tables[dataset.id] ?? [];
  const excluded = state.excludedRows[dataset.id] ?? [];
  const derivedCols = dataset.columns.filter((c) => c.kind === 'derived');
  const compiled = new Map<string, ReturnType<typeof compileExpression> | null>();
  for (const c of derivedCols) {
    try {
      compiled.set(c.id, compileExpression(c.expression ?? ''));
    } catch {
      compiled.set(c.id, null);
    }
  }

  const rows: Record<string, number>[] = [];
  const rawRows: Record<string, string>[] = [];
  rowsRaw.forEach((row, r) => {
    // 全空行跳过
    if (row.every((cell) => (cell ?? '').trim() === '')) return;
    if (excluded.includes(r)) return;
    const values: Record<string, number> = {};
    const raws: Record<string, string> = {};
    let anyValid = false;
    for (const col of dataset.columns) {
      if (col.kind === 'derived') continue;
      const raw = (row[dataset.columns.indexOf(col)] ?? '').trim();
      raws[col.id] = raw;
      if (raw === '') {
        values[col.id] = NaN;
      } else {
        const p = parseNumericText(raw);
        if (p.ok) {
          values[col.id] = p.value;
          anyValid = true;
        } else {
          values[col.id] = NaN;
        }
      }
    }
    if (!anyValid) return;
    // 参数作用域（params.X → X）
    const scope: Record<string, number> = { ...paramScope, ...values };
    for (const col of derivedCols) {
      const c = compiled.get(col.id);
      if (!c) { values[col.id] = NaN; continue; }
      try {
        values[col.id] = evaluateExpression(c, scope);
      } catch {
        values[col.id] = NaN;
      }
    }
    rows.push(values);
    rawRows.push(raws);
  });
  return { rows, rawRows, n: rows.length };
}

/** 执行拟合（过滤 NaN 点） */
export function runFit(spec: FitSpec, table: ParsedTable): ComputedFit | { error: string } {
  const pairs = table.rows
    .map((r) => ({ x: r[spec.xCol], y: r[spec.yCol] }))
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  if (pairs.length < 3) return { error: `拟合 ${spec.title}：有效数据点不足（需 ≥3，当前 ${pairs.length}）` };
  const xs = pairs.map((p) => p.x);
  const ys = pairs.map((p) => p.y);
  try {
    if (spec.mode === 'origin') {
      return { spec, origin: olsThroughOrigin(xs, ys) };
    }
    return { spec, ols: ols(xs, ys) };
  } catch (err) {
    return { error: `拟合 ${spec.title} 失败：${(err as Error).message}` };
  }
}

/** 解析参数为数值 scope（无效跳过） */
export function parseParams(
  fields: { id: string }[],
  params: Record<string, string>,
): { scope: Record<string, number>; missing: string[]; invalid: string[] } {
  const scope: Record<string, number> = {};
  const missing: string[] = [];
  const invalid: string[] = [];
  for (const f of fields) {
    const raw = (params[f.id] ?? '').trim();
    if (raw === '') { missing.push(f.id); continue; }
    const p = parseNumericText(raw);
    if (!p.ok) { invalid.push(f.id); continue; }
    scope[f.id] = p.value;
  }
  return { scope, missing, invalid };
}
