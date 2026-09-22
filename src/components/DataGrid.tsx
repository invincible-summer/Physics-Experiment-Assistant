/**
 * DataGrid v2 — 全站统一数据表格（AGENTS.md §12）。
 * 粘贴 TSV/CSV（多单元格 + 文件导入）；Enter/Tab/方向键导航，末行 Enter 自动增行；
 * 增删行、撤销/重做（含键盘输入，聚焦快照模型）；批量操作（序列填充/清空列/整表清空）；
 * 列宽拖动调整；派生列只读；缺失值显示 —（绝不自动填 0）；
 * 异常格式标红并给出原因（不篡改数据）；行排除（记录审计）；复制为 Markdown 表格。
 */
import { ClipboardEvent, KeyboardEvent, useMemo, useRef, useState } from 'react';
import { parseNumericText } from '../core/numeric';
import { compileExpression, evaluateExpression } from '../core/expression';
import { Tex } from './katex';
import { Icon } from './Icon';
import { Button, ConfirmButton, Field, Menu, Modal, toast } from './ui';
import { MarkdownBlock, MarkdownInline } from './Markdown';
import { GridHistory, cloneRows } from './grid-history';

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

export function DataGrid({
  columns, rows, onChange, derivedScope = {}, excludedRows = [], onToggleExclude,
  defaultRows = 8, minRows = 1, title, hint,
}: DataGridProps) {
  const history = useRef<GridHistory>(new GridHistory(100));
  const [, setHistTick] = useState(0);
  const [focused, setFocused] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchCol, setBatchCol] = useState('');
  const [batchMode, setBatchMode] = useState<'fill' | 'clear'>('fill');
  const [fillStart, setFillStart] = useState('0');
  const [fillStep, setFillStep] = useState('1');
  const [colWidths, setColWidths] = useState<Record<string, number>>({});
  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const fileRef = useRef<HTMLInputElement>(null);
  const resizeRef = useRef<{ colId: string; startX: number; startW: number } | null>(null);

  const bumpHist = () => setHistTick((v) => v + 1);

  /** 结构性变更统一入口：先记录历史再应用 */
  const commit = (next: string[][]) => {
    history.current.record(rows);
    bumpHist();
    onChange(next);
  };

  const undo = () => {
    const prev = history.current.undo(rows);
    if (!prev) return;
    bumpHist();
    onChange(prev);
  };
  const redo = () => {
    const next = history.current.redo(rows);
    if (!next) return;
    bumpHist();
    onChange(next);
  };

  /** 键盘逐格输入：即时同步（不入历史）；历史由聚焦快照在失焦时提交 */
  const setCell = (r: number, c: number, value: string) => {
    const next = cloneRows(rows);
    next[r][c] = value;
    onChange(next);
  };

  const addRow = (at?: number) => {
    const next = cloneRows(rows);
    const empty = columns.map(() => '');
    if (at === undefined) next.push(empty);
    else next.splice(at + 1, 0, empty);
    commit(next);
  };

  const removeRow = (r: number) => {
    if (rows.length <= minRows) { toast(`至少保留 ${minRows} 行`); return; }
    commit(rows.filter((_, i) => i !== r));
  };

  const focusCell = (r: number, c: number) => {
    const el = inputRefs.current.get(`${r}-${c}`);
    if (el) { el.focus(); el.select(); }
  };

  /** 派生列求值（含行内变量，按列序、无环） */
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

  /** 非法单元格统计（脚注汇总） */
  const invalidCount = useMemo(() => {
    let n = 0;
    rows.forEach((row) => {
      columns.forEach((c, j) => {
        if (c.kind === 'derived') return;
        const raw = (row[j] ?? '').trim();
        if (raw !== '' && !parseNumericText(raw).ok) n += 1;
      });
    });
    return n;
  }, [rows, columns]);

  const applyMatrix = (matrix: string[][], r0: number, c0: number, replaceAll: boolean) => {
    if (matrix.length === 0 || matrix[0].length === 0) return 0;
    const next = replaceAll ? [] as string[][] : cloneRows(rows);
    const needRows = replaceAll ? matrix.length : r0 + matrix.length;
    while (next.length < needRows) next.push(columns.map(() => ''));
    matrix.forEach((pastedRow, di) => {
      pastedRow.forEach((val, dj) => {
        const col = columns[(replaceAll ? 0 : c0) + dj];
        if (!col || col.kind === 'derived') return;
        next[(replaceAll ? 0 : r0) + di][(replaceAll ? 0 : c0) + dj] = val.trim();
      });
    });
    commit(next);
    return matrix.length;
  };

  const onPaste = (e: ClipboardEvent<HTMLInputElement>, r0: number, c0: number) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    if (!text) return;
    const matrix = parseTSV(text);
    const n = applyMatrix(matrix, r0, c0, false);
    if (n > 0) toast(`已粘贴 ${n} 行 × ${matrix[0].length} 列`);
  };

  const onImportFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      const matrix = parseTSV(text.replace(/^﻿/, ''));
      const hasData = rows.some((r) => r.some((c) => c.trim() !== ''));
      if (hasData && !window.confirm('导入将覆盖当前表格全部内容，确认导入？')) return;
      const n = applyMatrix(matrix, 0, 0, true);
      if (n > 0) toast(`已从 ${file.name} 导入 ${n} 行`);
      else toast('文件中没有可导入的数据');
    };
    reader.onerror = () => toast('文件读取失败');
    reader.readAsText(file);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>, r: number, c: number) => {
    const move = (dr: number, dc: number) => {
      e.preventDefault();
      let nr = r + dr;
      const nc = Math.max(0, Math.min(columns.length - 1, c + dc));
      // 末行继续向下/Enter：自动增行（录入长表不打断节奏）
      if (nr > rows.length - 1) {
        addRow();
        window.setTimeout(() => focusCell(rows.length, nc), 0);
        return;
      }
      nr = Math.max(0, nr);
      focusCell(nr, nc);
    };
    if (e.key === 'Enter') { history.current.commitSnapshot(rows); bumpHist(); move(e.shiftKey ? -1 : 1, 0); }
    else if (e.key === 'Tab') { history.current.commitSnapshot(rows); bumpHist(); move(0, e.shiftKey ? -1 : 1); }
    else if (e.key === 'ArrowDown') move(1, 0);
    else if (e.key === 'ArrowUp') move(-1, 0);
    else if (e.key === 'ArrowRight' && (e.target as HTMLInputElement).selectionStart === (e.target as HTMLInputElement).value.length) move(0, 1);
    else if (e.key === 'ArrowLeft' && (e.target as HTMLInputElement).selectionStart === 0) move(0, -1);
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
    else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
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

  const editableColumns = columns.filter((c) => c.kind !== 'derived');

  const applyBatch = () => {
    const colId = batchCol || editableColumns[0]?.id || '';
    const ci = columns.findIndex((c) => c.id === colId);
    if (ci < 0) { setBatchOpen(false); return; }
    if (batchMode === 'clear') {
      const next = cloneRows(rows);
      next.forEach((row) => { row[ci] = ''; });
      commit(next);
      toast(`已清空「${columns[ci].header}」列`);
    } else {
      const start = parseNumericText(fillStart);
      const step = parseNumericText(fillStep);
      if (!start.ok || !step.ok) { toast('起始值或步长不是有效数值'); return; }
      const next = cloneRows(rows);
      next.forEach((row, i) => { row[ci] = String(start.value + step.value * i); });
      commit(next);
      toast(`已按等差序列填充「${columns[ci].header}」列（${rows.length} 行）`);
    }
    setBatchOpen(false);
  };

  const clearAll = () => {
    commit(rows.map(() => columns.map(() => '')));
    toast('已清空整张表格（可用撤销恢复）');
  };

  const onResizeStart = (e: React.PointerEvent, colId: string, th: HTMLTableCellElement) => {
    e.preventDefault();
    resizeRef.current = { colId, startX: e.clientX, startW: th.getBoundingClientRect().width };
    const onMove = (ev: PointerEvent) => {
      const cur = resizeRef.current;
      if (!cur) return;
      const w = Math.max(64, Math.min(420, cur.startW + ev.clientX - cur.startX));
      setColWidths((prev) => ({ ...prev, [cur.colId]: Math.round(w) }));
    };
    const onUp = () => {
      resizeRef.current = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  return (
    <div>
      {title && <div className="panel-title" style={{ marginBottom: 2 }}><MarkdownInline>{title}</MarkdownInline></div>}
      {hint && <div className="panel-sub" style={{ marginBottom: 8 }}><MarkdownBlock>{hint}</MarkdownBlock></div>}
      <div className="grid-toolbar">
        <Button size="sm" icon="plus" onClick={() => addRow()}>添加一行</Button>
        <Button size="sm" onClick={() => {
          const next = cloneRows(rows);
          while (next.length < defaultRows) next.push(columns.map(() => ''));
          if (next.length !== rows.length) commit(next);
        }}>{`补足 ${defaultRows} 行`}</Button>
        <Menu
          trigger="批量操作"
          items={[
            { id: 'fill', label: '序列填充 / 清空列…', icon: 'grid' },
            { id: 'reset-width', label: '重置列宽', icon: 'undo' },
          ]}
          onSelect={(id) => {
            if (id === 'fill') { setBatchCol(editableColumns[0]?.id ?? ''); setBatchMode('fill'); setBatchOpen(true); }
            if (id === 'reset-width') { setColWidths({}); toast('已重置列宽'); }
          }}
        />
        <Button size="sm" icon="upload" onClick={() => fileRef.current?.click()}>导入 CSV/TSV</Button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onImportFile(f);
            e.target.value = '';
          }}
        />
        <Button size="sm" variant="ghost" icon="undo" onClick={undo} disabled={!history.current.canUndo} aria-label="撤销">撤销</Button>
        <Button size="sm" variant="ghost" icon="redo" onClick={redo} disabled={!history.current.canRedo} aria-label="重做">重做</Button>
        <span className="spacer" />
        <ConfirmButton size="sm" onConfirm={clearAll} question="确认清空整张表格？（可用撤销恢复）">清空表格</ConfirmButton>
        <Button
          size="sm"
          icon="copy"
          onClick={async () => {
            try { await navigator.clipboard.writeText(markdownTable()); toast('已复制 Markdown 表格'); } catch { /* noop */ }
          }}
        >复制为 Markdown</Button>
      </div>
      <div className="grid-wrap">
        <table className="data-grid">
          <thead>
            <tr>
              <th style={{ width: 40 }}>#</th>
              {columns.map((c) => (
                <th key={c.id} style={colWidths[c.id] ? { width: colWidths[c.id], position: 'relative' } : { position: 'relative' }}>
                  <MarkdownInline>{c.header}</MarkdownInline>
                  {c.unit && <span className="col-unit"><MarkdownInline>{c.unit}</MarkdownInline></span>}
                  {c.kind === 'derived' && c.formulaLatex && (
                    <span className="col-unit" title={c.formulaLatex}><Tex tex={c.formulaLatex} display={false} /></span>
                  )}
                  <span
                    className="col-resize"
                    onPointerDown={(e) => onResizeStart(e, c.id, e.currentTarget.parentElement as HTMLTableCellElement)}
                    title="拖动调整列宽"
                  />
                </th>
              ))}
              <th style={{ width: 116 }}><MarkdownInline>操作</MarkdownInline></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={r}>
                <td
                  className={`row-idx${excludedRows.includes(r) ? ' row-excluded' : ''}`}
                  onClick={() => onToggleExclude?.(r)}
                  title={onToggleExclude ? '点击排除/恢复该行（记录审计）' : undefined}
                >{r + 1}</td>
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
                  const invalid = raw !== '' && parsed !== null && !parsed.ok;
                  return (
                    <td key={c.id} style={excludedRows.includes(r) ? { opacity: 0.45 } : undefined}>
                      <input
                        ref={(el) => { if (el) inputRefs.current.set(`${r}-${j}`, el); }}
                        className={`cell-input${invalid ? ' invalid' : ''}`}
                        value={row[j] ?? ''}
                        placeholder="—"
                        inputMode="decimal"
                        title={invalid && parsed ? parsed.error : undefined}
                        onFocus={() => { setFocused(true); history.current.snapshot(rows); }}
                        onChange={(e) => setCell(r, j, e.target.value)}
                        onBlur={() => { history.current.commitSnapshot(rows); bumpHist(); }}
                        onPaste={(e) => onPaste(e, r, j)}
                        onKeyDown={(e) => onKeyDown(e, r, j)}
                        aria-label={`${c.header} 第 ${r + 1} 行`}
                      />
                    </td>
                  );
                })}
                <td className="grid-actions">
                  <Button size="sm" variant="ghost" onClick={() => addRow(r)}>插入</Button>
                  <Button size="sm" variant="ghost" onClick={() => removeRow(r)}>删除</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(focused || invalidCount > 0) && (
        <div className="small muted grid-footnote">
          <MarkdownInline>{`Enter/Tab/方向键导航 · 末行 Enter 自动增行 · Ctrl+Z 撤销 · 可粘贴 TSV 或导入 CSV 文件 · 空缺显示 —，不会自动填 0${onToggleExclude ? ' · 点击行号排除/恢复该行' : ''}`}</MarkdownInline>
          {invalidCount > 0 && (
            <span className="row" style={{ gap: 4, marginTop: 3, color: 'var(--danger)' }}>
              <Icon name="alert" size={13} />
              <MarkdownInline>{`**${invalidCount}** 个单元格无法解析为数值，计算时已按缺失处理`}</MarkdownInline>
            </span>
          )}
        </div>
      )}

      <Modal open={batchOpen} onClose={() => setBatchOpen(false)} title="批量操作">
        <div className="stack">
          <div className="form-grid">
            <Field label="目标列">
              <select className="select" value={batchCol} onChange={(e) => setBatchCol(e.target.value)}>
                {editableColumns.map((c) => <option key={c.id} value={c.id}>{c.header}</option>)}
              </select>
            </Field>
            <Field label="操作">
              <select className="select" value={batchMode} onChange={(e) => setBatchMode(e.target.value as 'fill' | 'clear')}>
                <option value="fill">等差序列填充</option>
                <option value="clear">清空该列</option>
              </select>
            </Field>
            {batchMode === 'fill' && (
              <>
                <Field label="起始值">
                  <input className="input" inputMode="decimal" value={fillStart} onChange={(e) => setFillStart(e.target.value)} />
                </Field>
                <Field label="步长">
                  <input className="input" inputMode="decimal" value={fillStep} onChange={(e) => setFillStep(e.target.value)} />
                </Field>
              </>
            )}
          </div>
          <div className="small muted">
            <MarkdownBlock>{batchMode === 'fill' ? '按 `起始值 + 行号 × 步长` 填充现有全部行；常用于序号列、时间列。' : '清空该列全部单元格（其他列不受影响；可用撤销恢复）。'}</MarkdownBlock>
          </div>
          <div className="row-right">
            <Button variant="ghost" onClick={() => setBatchOpen(false)}>取消</Button>
            <Button variant="primary" onClick={applyBatch}>应用</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function fmtDerived(v: number, decimals?: number): string {
  if (!Number.isFinite(v)) return '—';
  if (decimals !== undefined) return v.toFixed(decimals);
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
