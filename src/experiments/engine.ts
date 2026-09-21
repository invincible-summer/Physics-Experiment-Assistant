/** 实验引擎：表格解析（输入列 + 派生列 + 排除行）、通用拟合装配、步骤完成度判定 */
import { DatasetDefinition, ExperimentDefinition, ExperimentComputation, ExperimentState, FitSpec, ParsedTable } from './types';
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
  let invalidCells = 0;
  rowsRaw.forEach((row, r) => {
    // 全空行跳过
    if (row.every((cell) => (cell ?? '').trim() === '')) return;
    if (excluded.includes(r)) return;
    const values: Record<string, number> = {};
    const raws: Record<string, string> = {};
    let anyValid = false;
    for (let ci = 0; ci < dataset.columns.length; ci++) {
      const col = dataset.columns[ci];
      if (col.kind === 'derived') continue;
      const raw = (row[ci] ?? '').trim();
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
          invalidCells += 1;
        }
      }
    }
    if (!anyValid) return;
    // 参数作用域（params.X → X）；派生列按列序求值并回写作用域，
    // 使后续派生列可引用前面的派生列（与 DataGrid 显示层行为一致）
    const scope: Record<string, number> = { ...paramScope, ...values };
    for (const col of derivedCols) {
      const c = compiled.get(col.id);
      if (!c) { values[col.id] = NaN; scope[col.id] = NaN; continue; }
      try {
        const v = evaluateExpression(c, scope);
        values[col.id] = v;
        scope[col.id] = v;
      } catch {
        values[col.id] = NaN;
        scope[col.id] = NaN;
      }
    }
    rows.push(values);
    rawRows.push(raws);
  });
  return { rows, rawRows, n: rows.length, invalidCells };
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

/** 步骤完成度：done=全部就绪 todo=待输入 attention=有非法输入/拟合失败/排除行 */
export type StepStatus = 'done' | 'attention' | 'todo';

export function stepStatuses(
  experiment: ExperimentDefinition,
  state: ExperimentState,
  computation: ExperimentComputation | null,
): Record<string, StepStatus> {
  const out: Record<string, StepStatus> = {};
  for (const step of experiment.steps) {
    let attention = false;
    let todo = false;
    let done = false;
    for (const block of step.blocks) {
      switch (block.type) {
        case 'params': {
          // 文本类参数不参与数值判定
          const numericFields = block.fields
            .map((fid) => experiment.params.find((p) => p.id === fid))
            .filter((f): f is NonNullable<typeof f> => !!f && f.kind !== 'text')
            .map((f) => ({ id: f.id }));
          const { missing, invalid } = parseParams(numericFields, state.params);
          if (invalid.length > 0) attention = true;
          else if (missing.length > 0) todo = true;
          else if (numericFields.length > 0) done = true;
          break;
        }
        case 'table': {
          const ds = experiment.datasets.find((d) => d.id === block.tableId);
          if (!ds) break;
          const parsed = parseTable(ds, state);
          const excluded = state.excludedRows[ds.id] ?? [];
          if (parsed.invalidCells > 0) attention = true;
          else if (excluded.length > 0) attention = true;
          if (parsed.n > 0) done = true;
          else todo = true;
          break;
        }
        case 'fits': {
          for (const fid of block.fitIds) {
            const fit = computation?.fits[fid];
            if (!fit) { todo = true; continue; }
            if ('error' in fit) {
              // 数据点不足属「待输入」，其他错误（如共线/数值失败）属「需注意」
              if (fit.error.includes('数据点不足')) todo = true;
              else attention = true;
            } else {
              done = true;
            }
          }
          break;
        }
        case 'plot': {
          const spec = experiment.plots.find((p) => p.id === block.plotId);
          const ds = spec ? experiment.datasets.find((d) => d.id === spec.tableId) : undefined;
          if (!spec || !ds) break;
          const parsed = parseTable(ds, state);
          const hasPoints = parsed.rows.some((r) => Number.isFinite(r[spec.xCol]) && Number.isFinite(r[spec.yCol]));
          if (hasPoints) done = true;
          else todo = true;
          break;
        }
        case 'results': {
          const have = new Set((computation?.results ?? []).map((r) => r.id));
          for (const id of block.resultIds) {
            if (have.has(id)) done = true;
            else todo = true;
          }
          break;
        }
        default:
          // safety/note/custom：信息性块，不计完成度
          break;
      }
    }
    out[step.id] = attention ? 'attention' : todo ? 'todo' : 'done';
  }
  return out;
}
