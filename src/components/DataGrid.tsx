/**
 * EditableDataGrid — 数据表格组件（plan.md §4.3，AGENTS.md §12）。
 *
 * - 粘贴 TSV/CSV（多单元格）；
 * - Enter 下移、Tab 右移、方向键导航；
 * - 增删行、撤销/重做；
 * - 派生量列只读（悬停显示公式）；
 * - 缺失值显示 —，绝不自动填 0；
 * - 异常格式标红但不篡改数据；
 * - 行排除（记录审计），复制为 Markdown 表格。
 */
import { ClipboardEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { parseNumericText } from '../core/numeric';
import { compileExpression, evaluateExpression } from '../core/expression';
import { Tex } from './katex';
import { toast } from './ui';

export interface GridColumn {
  id: string;
  header: string;
  unit?: string;
  /** 默认 input */
  kind?: 'input' | 'derived' | 'index';
  /** 派生表达式：可引用本表其他列 id 与全局参数（scope 传入） */
  expression?: string;
  formulaLatex?: string;
  /** 派生值格式化：小数位 */
  decimals?: number;
}

export interface DataGridProps {
  columns: GridColumn[];
  rows: string[][];
  onChange: (rows: string[][]) => void;
  /** 派生列求值作用域（表外参数） */
  derivedScope?: Record<string, number>;
  /** 行排除回调（用户明确操作，进入审计日志） */
  excludedRows?: number[];
  onToggleExclude?: (row: number) => void;
  defaultRows?: number;
  minRows?: number;
  title?: string;
  hint?: string;
}

interface HistoryState { rows: string[][] }

export function DataGrid({
  columns, rows, onChange, derivedScope = {}, excludedRows = [], onToggleExclude,
  defaultRows = 8, minRows = 1, title, hint,
}: DataGridProps) {
  const undoStack = useRef<HistoryState[]>([]);
  const redoStack = useRef<HistoryState[]>([]);
  const [focused, setFocused] = useState<{ r: number; c: number } | null>(null);
  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  const inputCols = columns.filter((c) => c.kind === 'input').length;

  const pushHistory = (newRows: string[][]) => {
    undoStack.current.push({ rows });
    if (undoStack.current.length > 100) undoStack.current.shift();
    redoStack.current = [];
    onChange(newRows);
  };

  const undo = () => {
    const prev = undoStack.current.pop();
    if (!prev) return;
    redoStack.current.push({ rows });
    onChange(prev.rows);
  };
  const redo = () => {
    const next = redoStack.current.pop();
    if (!next) return;
    undoStack.current.push({ rows });
    onChange(next.rows);
  };

  const setCell = (r: number, c: number, value: string) => {
    const next = rows.map((row) => [...row]);
    next[r][c] = value;
    onChange(next);
  };

  const setCellHistory = (r: number, c: number, value: string) => {
    const next = rows.map((row) => [...row]);
    next[r][c] = value;
    pushHistory(next);
  };

  const addRow = (at?: number) => {
    const next = [...rows.map((r) => [...r])];
    const empty = columns.map(() => '');
    if (at === undefined) next.push(empty);
    else next.splice(at + 1, 0, empty);
    pushHistory(next);
  };

  const removeRow = (r: number) => {
    if (rows.length <= minRows) { toast(`至少保留 ${minRows} 行`); return; }
    const next = rows.filter((_, i) => i !== r);
    pushHistory(next);
  };

  /** 派生列求值（含行内变量） */
  const derivedValues = useMemo(() => {
    const compiledCache = new Map<string, ReturnType<typeof compileExpression> | null>();
    const result: (number | null)[][] = rows.map(() => columns.map(() => null));
    rows.forEach((row, r) => {
      columns.forEach((col, c) => {
        if (col.kind !== 'derived' || !col.expression) return;
        let compiled = compiledCache.get(col.id);
        if (compiled === undefined) {
          try {
            compiled = compileExpression(col.expression);
          } catch {
            compiled = null;
          }
          compiledCache.set(col.id, compiled);
        }
        if (!compiled) return;
        const scope: Record<string, number> = { ...derivedScope };
        let ok = true;
        columns.forEach((c2, j) => {
          if (c2.kind === 'derived') return;
          const raw = (row[j] ?? '').trim();
          if (raw === '') { ok = false; return; }
          const p = parseNumericText(raw);
          if (!p.ok) { ok = false; return; }
          scope[c2.id] = p.value;
        });
        // 行内派生列依赖其他派生列：按列序求值（定义须无环）
        columns.forEach((c2, j) => {
          if (c2.kind !== 'derived' || j >= c) return;
          const v = result[r][j];
          if (v === null) { ok = false; return; }
          scope[c2.id] = v;
        });
        if (!ok) return;
        try {
          result[r][c] = evaluateExpression(compiled, scope);
        } catch {
          result[r][c] = null;
        }
      });
    });
    return result;
  }, [rows, columns, derivedScope]);

  const onPaste = (e: ClipboardEvent<HTMLInputElement>, r0: number, c0: number) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    if (!text) return;
    const matrix = parseTSV(text);
    if (matrix.length === 0 || matrix[0].length === 0) return;
    const needRows = r0 + matrix.length;
    const next = rows.map((row) => [...row]);
    while (next.length < needRows) next.push(columns.map(() => ''));
    matrix.forEach((pastedRow, di) => {
      pastedRow.forEach((val, dj) => {
        const col = columns[c0 + dj];
        if (!col || col.kind === 'derived') return; // 溢出到派生列时忽略
        next[r0 + di][c0 + dj] = val.trim();
      });
    });
    pushHistory(next);
    toast(`已粘贴 ${matrix.length} 行 × ${matrix[0].length} 列`);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>, r: number, c: number) => {
    const move = (dr: number, dc: number) => {
      e.preventDefault();
      const nr = Math.max(0, Math.min(rows.length - 1, r + dr));
      const ncIdx = Math.max(0, Math.min(columns.length - 1, c + dc));
      const key = `${nr}-${ncIdx}`;
      const el = inputRefs.current.get(key);
      if (el) { el.focus(); el.select(); }
    };
    if (e.key === 'Enter') { move(e.shiftKey ? -1 : 1, 0); }
    else if (e.key === 'Tab') { move(0, e.shiftKey ? -1 : 1); }
    else if (e.key === 'ArrowDown') move(1, 0);
    else if (e.key === 'ArrowUp') move(-1, 0);
    else if (e.key === 'ArrowRight' && (e.target as HTMLInputElement).selectionStart === (e.target as HTMLInputElement).value.length) move(0, 1);
    else if (e.key === 'ArrowLeft' && (e.target as HTMLInputElement).selectionStart === 0) move(0, -1);
    else if (e.ctrlKey && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
    else if (e.ctrlKey && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
  };

  const markdownTable = () => {
    const head = `| ${columns.map((c) => (c.unit ? `${c.header} (${c.unit})` : c.header)).join(' | ')} |`;
    const sep = `|${columns.map(() => '---').join('|')}|`;
    const body = rows
      .filter((r) => r.some((cell) => cell.trim() !== ''))
      .map((r) => `| ${columns.map((c, j) => {
        if (c.kind === 'derived') {
          const v = derivedValues[rows.indexOf(r)]?.[j];
          return v === null || v === undefined ? '—' : fmtDerived(v, c.decimals);
        }
        return (r[j] ?? '').trim() === '' ? '—' : (r[j] ?? '').trim();
      }).join(' | ')} |`);
    return [head, sep, ...body].join('\n');
  };

  return (
    <div>
      {title && <div className="panel-title">{title}</div>}
      {hint && <div className="panel-sub" style={{ marginBottom: 6 }}>{hint}</div>}
      <div className="row" style={{ marginBottom: 8 }}>
        <button className="btn btn-sm" onClick={() => addRow()}>＋ 加行</button>
        <button className="btn btn-sm" onClick={() => {
          const next = rows.map((r) => [...r]);
          while (next.length < defaultRows) next.push(columns.map(() => ''));
          if (next.length !== rows.length) pushHistory(next);
        }}>补足 {defaultRows} 行</button>
        <button className="btn btn-sm" onClick={undo} disabled={undoStack.current.length === 0}>↶ 撤销</button>
        <button className="btn btn-sm" onClick={redo} disabled={redoStack.current.length === 0}>↷ 重做</button>
        <span className="spacer" style={{ flex: 1 }} />
        <button
          className="btn btn-sm"
          onClick={async () => {
            try { await navigator.clipboard.writeText(markdownTable()); toast('已复制 Markdown 表格'); } catch { /* noop */ }
          }}
        >复制为 Markdown</button>
      </div>
      <div className="grid-wrap">
        <table className="data-grid">
          <thead>
            <tr>
              <th style={{ width: 44 }}>#</th>
              {columns.map((c) => (
                <th key={c.id}>
                  {c.header}
                  {c.unit && <span className="col-unit">{c.unit}</span>}
                  {c.kind === 'derived' && c.formulaLatex && (
                    <span className="col-unit" title={c.formulaLatex}><Tex tex={c.formulaLatex} display={false} /></span>
                  )}
                </th>
              ))}
              <th style={{ width: 60 }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={r}>
                <td className={`row-idx${excludedRows.includes(r) ? ' row-excluded' : ''}`}
                  onClick={() => onToggleExclude?.(r)}
                  title={onToggleExclude ? '点击排除/恢复该行（记录审计）' : undefined}
                >{excludedRows.includes(r) ? '⊘' : r + 1}</td>
                {columns.map((c, j) => {
                  if (c.kind === 'derived') {
                    const v = derivedValues[r]?.[j];
                    const valText = v === null || v === undefined ? '—' : fmtDerived(v, c.decimals);
                    return (
                      <td key={c.id} className={`derived${c.formulaLatex ? ' has-formula' : ''}`} title={c.formulaLatex}>
                        {valText}
                      </td>
                    );
                  }
                  const raw = (row[j] ?? '').trim();
                  const parsed = raw === '' ? null : parseNumericText(raw);
                  const invalid = raw !== '' && !parsed?.ok;
                  return (
                    <td key={c.id} style={excludedRows.includes(r) ? { opacity: 0.45 } : undefined}>
                      <input
                        ref={(el) => { if (el) inputRefs.current.set(`${r}-${j}`, el); }}
                        className={`cell-input${invalid ? ' invalid' : ''}`}
                        value={row[j] ?? ''}
                        placeholder="—"
                        inputMode="decimal"
                        onFocus={() => setFocused({ r, c: j })}
                        onChange={(e) => setCell(r, j, e.target.value)}
                        onBlur={(e) => { if (e.target.value !== (rows[r]?.[j] ?? '')) setCellHistory(r, j, e.target.value); }}
                        onPaste={(e) => onPaste(e, r, j)}
                        onKeyDown={(e) => onKeyDown(e, r, j)}
                        aria-label={`${c.header} 第 ${r + 1} 行`}
                      />
                    </td>
                  );
                })}
                <td>
                  <button className="btn btn-sm btn-ghost" title="在下方插入行" onClick={() => addRow(r)}>＋</button>
                  <button className="btn btn-sm btn-ghost" title="删除该行" onClick={() => removeRow(r)}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {focused && (
        <div className="small muted" style={{ marginTop: 4 }}>
          Enter/Tab/方向键导航 · Ctrl+Z 撤销 · 可从 Excel 粘贴 TSV · 空缺显示 —，不会自动填 0
        </div>
      )}
    </div>
  );
}

function fmtDerived(v: number, decimals?: number): string {
  if (!Number.isFinite(v)) return '—';
  if (decimals !== undefined) return v.toFixed(decimals);
  // 默认 6 位有效数字，不提前修约原则——显示用
  if (v === 0) return '0';
  const a = Math.abs(v);
  if (a >= 1e7 || a < 1e-5) return v.toExponential(4);
  return Number(v.toPrecision(6)).toString();
}

/** 解析粘贴的 TSV/CSV 文本为矩阵（自动识别 Tab / 逗号 / 分号分隔） */
export function parseTSV(text: string): string[][] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n').filter((l) => l.trim() !== '');
  if (lines.length === 0) return [];
  const first = lines[0];
  let sep = '\t';
  const tabs = (first.match(/\t/g) ?? []).length;
  const commas = (first.match(/,/g) ?? []).length;
  const semis = (first.match(/;/g) ?? []).length;
  if (commas > tabs && commas >= semis) sep = ',';
  else if (semis > tabs && semis > commas) sep = ';';
  return lines.map((l) => l.split(sep).map((c) => c.trim()));
}
