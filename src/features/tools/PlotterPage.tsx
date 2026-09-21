/**
 * 绘图工作台（/tools/plotter）：MATLAB/pyplot 风格的通用画图工具。
 * 数据系列（DataGrid 多列：x + y1..yn）+ 表达式系列 y=f(x)（安全 AST 求值，无 eval）；
 * 轴名/单位/坐标范围（横纵起点）/对数轴可配；SVG/PNG/CSV 导出；
 * 与工具总线联动：接收其他工具的表格载荷，也可把当前数据发送给线性拟合。
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { parseNumericText } from '../../core/numeric';
import { compileExpression, evaluateExpression } from '../../core/expression';
import { PhysicsPlot, PlotSeries, PlotChecklist } from '../../components/PhysicsPlot';
import { DataGrid, GridColumn } from '../../components/DataGrid';
import { Button, ConfirmButton, EmptyState, Menu, Notice, Panel, toast } from '../../components/ui';
import { MarkdownInline } from '../../components/Markdown';
import { useToolDraft, clearToolDraft } from './use-tool-draft';
import { PayloadBanner } from './PayloadBanner';
import { tablePayload, useToolBus } from './tool-bus';

interface ExprDraft {
  id: string;
  name: string;
  expr: string;
  xmin: string;
  xmax: string;
  samples: string;
}

interface PlotterDraft {
  rows: string[][];
  /** y 系列个数（列 0 固定为 x） */
  yCount: number;
  seriesNames: string[];
  exprs: ExprDraft[];
  title: string;
  xName: string;
  xUnit: string;
  yName: string;
  yUnit: string;
  xMin: string;
  xMax: string;
  yMin: string;
  yMax: string;
  xLog: boolean;
  yLog: boolean;
  connectPoints: boolean;
}

const INITIAL: PlotterDraft = {
  rows: Array.from({ length: 8 }, () => ['', '']),
  yCount: 1,
  seriesNames: ['y1'],
  exprs: [],
  title: '未命名图',
  xName: 'x',
  xUnit: '',
  yName: 'y',
  yUnit: '',
  xMin: '',
  xMax: '',
  yMin: '',
  yMax: '',
  xLog: false,
  yLog: false,
  connectPoints: false,
};

const MAX_SERIES = 6;

function parseAxisBound(raw: string, log: boolean): number | undefined {
  const t = raw.trim();
  if (t === '') return undefined;
  const p = parseNumericText(t);
  if (!p.ok) return undefined;
  if (log && p.value <= 0) return undefined;
  return p.value;
}

export function PlotterPage() {
  const navigate = useNavigate();
  const send = useToolBus((s) => s.send);
  const [draft, setDraft] = useToolDraft<PlotterDraft>('plotter', INITIAL);
  const patch = (p: Partial<PlotterDraft>) => setDraft((d) => ({ ...d, ...p }));
  const [exprSeq, setExprSeq] = useState(1);

  const columns: GridColumn[] = useMemo(() => {
    const cols: GridColumn[] = [{ id: 'x', header: draft.xName || 'x', unit: draft.xUnit || undefined }];
    for (let i = 0; i < draft.yCount; i++) {
      cols.push({ id: `y${i}`, header: draft.seriesNames[i] || `y${i + 1}` });
    }
    return cols;
  }, [draft.yCount, draft.seriesNames, draft.xName, draft.xUnit]);

  /** 数据系列：逐列解析，非法/空缺跳过（不篡改、不填 0） */
  const dataSeries = useMemo<PlotSeries[]>(() => {
    const out: PlotSeries[] = [];
    for (let i = 0; i < draft.yCount; i++) {
      const points: { x: number; y: number }[] = [];
      for (const row of draft.rows) {
        const xr = (row[0] ?? '').trim();
        const yr = (row[i + 1] ?? '').trim();
        if (xr === '' || yr === '') continue;
        const xp = parseNumericText(xr);
        const yp = parseNumericText(yr);
        if (!xp.ok || !yp.ok) continue;
        points.push({ x: xp.value, y: yp.value });
      }
      if (points.length === 0) continue;
      out.push({
        name: draft.seriesNames[i] || `y${i + 1}`,
        points,
        type: draft.connectPoints ? 'line' : 'scatter',
        showSymbol: true,
      });
    }
    return out;
  }, [draft.rows, draft.yCount, draft.seriesNames, draft.connectPoints]);

  /** 表达式系列求值（含错误说明）；对数横轴用几何等距取样 */
  const exprSeries = useMemo<{ series: PlotSeries[]; errors: { id: string; message: string }[]; annotations: { text: string }[] }>(() => {
    const series: PlotSeries[] = [];
    const errors: { id: string; message: string }[] = [];
    const annotations: { text: string }[] = [];
    for (const e of draft.exprs) {
      const expr = e.expr.trim();
      if (expr === '') continue;
      let compiled;
      try {
        compiled = compileExpression(expr);
      } catch (err) {
        errors.push({ id: e.id, message: `表达式无法解析：${(err as Error).message}` });
        continue;
      }
      const unknown = compiled.variables.filter((v) => v !== 'x');
      if (unknown.length > 0) {
        errors.push({ id: e.id, message: `表达式含未知变量 ${unknown.join('、')}（只允许 x）` });
        continue;
      }
      const xmin = parseNumericText(e.xmin);
      const xmax = parseNumericText(e.xmax);
      if (!xmin.ok || !xmax.ok) {
        errors.push({ id: e.id, message: '请填写合法的取样起点与终点' });
        continue;
      }
      if (!(xmin.value < xmax.value)) {
        errors.push({ id: e.id, message: '取样起点必须小于终点' });
        continue;
      }
      if (draft.xLog && xmin.value <= 0) {
        errors.push({ id: e.id, message: '对数横轴要求取样起点大于 0' });
        continue;
      }
      const nParsed = parseNumericText(e.samples || '200');
      const n = nParsed.ok ? Math.min(1000, Math.max(2, Math.round(nParsed.value))) : 200;
      const points: { x: number; y: number }[] = [];
      let bad = 0;
      for (let i = 0; i < n; i++) {
        const t = n === 1 ? 0 : i / (n - 1);
        const x = draft.xLog
          ? xmin.value * Math.pow(xmax.value / xmin.value, t)
          : xmin.value + (xmax.value - xmin.value) * t;
        let y: number;
        try {
          y = evaluateExpression(compiled, { x });
        } catch {
          bad += 1;
          continue;
        }
        if (!Number.isFinite(y)) { bad += 1; continue; }
        if (draft.yLog && y <= 0) continue;
        points.push({ x, y });
      }
      if (points.length < 2) {
        errors.push({ id: e.id, message: '取样区间内有效点不足（检查定义域与对数轴约束）' });
        continue;
      }
      const name = e.name.trim() || `y = ${expr}`;
      series.push({ name, points, type: 'line' });
      annotations.push({ text: `${name}，x ∈ [${xmin.value}, ${xmax.value}]，${n} 点${bad > 0 ? `，${bad} 点域外跳过` : ''}` });
    }
    return { series, errors, annotations };
  }, [draft.exprs, draft.xLog, draft.yLog]);

  const allSeries = useMemo(() => [...dataSeries, ...exprSeries.series], [dataSeries, exprSeries]);
  const xLabel = `${draft.xName || 'x'}${draft.xUnit ? ` (${draft.xUnit})` : ''}`;
  const yLabel = `${draft.yName || 'y'}${draft.yUnit ? ` (${draft.yUnit})` : ''}`;

  const setSeriesName = (i: number, name: string) => {
    const names = [...draft.seriesNames];
    names[i] = name;
    patch({ seriesNames: names });
  };
  const addSeries = () => {
    if (draft.yCount >= MAX_SERIES) { toast(`最多 ${MAX_SERIES} 个数据系列`); return; }
    patch({
      yCount: draft.yCount + 1,
      seriesNames: [...draft.seriesNames, `y${draft.yCount + 1}`],
      rows: draft.rows.map((r) => [...r, '']),
    });
  };
  const removeSeries = (i: number) => {
    if (draft.yCount <= 1) { toast('至少保留一个数据系列'); return; }
    patch({
      yCount: draft.yCount - 1,
      seriesNames: draft.seriesNames.filter((_, k) => k !== i),
      rows: draft.rows.map((r) => r.filter((_, k) => k !== i + 1)),
    });
  };

  const addExpr = () => {
    const id = `e${Date.now().toString(36)}${exprSeq}`;
    setExprSeq((v) => v + 1);
    patch({
      exprs: [...draft.exprs, { id, name: '', expr: '', xmin: '0', xmax: '10', samples: '200' }],
    });
  };
  const patchExpr = (id: string, p: Partial<ExprDraft>) =>
    patch({ exprs: draft.exprs.map((e) => (e.id === id ? { ...e, ...p } : e)) });
  const removeExpr = (id: string) => patch({ exprs: draft.exprs.filter((e) => e.id !== id) });
  const exprErrorOf = (id: string) => exprSeries.errors.find((e) => e.id === id);

  const sendToRegression = () => {
    send(tablePayload(`绘图工作台 · ${draft.title}`, [{ header: draft.xName || 'x', index: 0 }, ...draft.seriesNames.slice(0, draft.yCount).map((n, i) => ({ header: n || `y${i + 1}`, index: i + 1 }))], draft.rows));
    navigate('/tools/regression');
  };

  const hasData = dataSeries.length > 0;

  return (
    <div className="stack-lg">
      <header className="page-head">
        <h1 className="page-title"><MarkdownInline>绘图工作台</MarkdownInline></h1>
        <p className="page-lead">
          <MarkdownInline>表格数据与 $y=f(x)$ 表达式混合成图；轴名、单位、坐标起点与对数轴可配；导出 SVG / PNG / CSV，或把数据发送给线性拟合。</MarkdownInline>
        </p>
      </header>

      <PayloadBanner
        accept="table"
        onAccept={(p) => {
          if (p.kind !== 'table') return;
          if (p.headers.length >= 2) {
            const yc = Math.min(MAX_SERIES, p.headers.length - 1);
            patch({
              rows: p.rows.map((r) => r.slice(0, yc + 1)),
              yCount: yc,
              seriesNames: p.headers.slice(1, yc + 1),
              xName: p.headers[0],
            });
            toast(`已填入 ${p.rows.length} 行 × ${yc + 1} 列`);
          } else {
            patch({
              rows: p.rows.map((r, i) => [String(i + 1), r[0] ?? '']),
              yCount: 1,
              seriesNames: [p.headers[0] ?? 'y1'],
              xName: '序号',
            });
            toast(`已填入 ${p.rows.length} 行（x 取序号）`);
          }
        }}
      />

      <div className="tool-layout">
        <div className="stack">
          <Panel
            title="数据系列"
            sub="第 1 列为 $x$，其后每列一个 $y$ 系列；可从 Excel 粘贴"
            actions={hasData ? (
              <Menu
                trigger="发送到…"
                items={[{ id: 'regression', label: '线性拟合', icon: 'function' }]}
                onSelect={(id) => { if (id === 'regression') sendToRegression(); }}
              />
            ) : undefined}
          >
            <div className="stack">
              <DataGrid
                columns={columns}
                rows={draft.rows}
                onChange={(rows) => patch({ rows })}
                defaultRows={8}
                hint="非法单元格在绘图时按缺失跳过；行数据保留原始文本"
              />
              <div className="stack" style={{ gap: 6 }}>
                {draft.seriesNames.slice(0, draft.yCount).map((name, i) => (
                  <div className="row" key={i} style={{ gap: 6 }}>
                    <span className="small muted" style={{ minWidth: 34 }}><MarkdownInline>{`系列 ${i + 1}`}</MarkdownInline></span>
                    <input
                      className="input"
                      style={{ maxWidth: 200 }}
                      value={name}
                      placeholder={`y${i + 1}`}
                      onChange={(e) => setSeriesName(i, e.target.value)}
                      aria-label={`系列 ${i + 1} 名称`}
                    />
                    {draft.yCount > 1 && (
                      <Button size="sm" variant="ghost" onClick={() => removeSeries(i)}>删除该系列</Button>
                    )}
                  </div>
                ))}
                <div className="row">
                  <Button size="sm" onClick={addSeries} disabled={draft.yCount >= MAX_SERIES}>添加数据系列</Button>
                  <label className="row" style={{ gap: 6 }}>
                    <input
                      type="checkbox"
                      checked={draft.connectPoints}
                      onChange={(e) => patch({ connectPoints: e.target.checked })}
                    />
                    <MarkdownInline>数据点连线</MarkdownInline>
                  </label>
                </div>
              </div>
            </div>
          </Panel>

          <Panel
            title="表达式系列"
            sub="安全 AST 求值（无 eval）；变量只允许 $x$"
            actions={<Button size="sm" icon="function" onClick={addExpr}>添加表达式</Button>}
          >
            {draft.exprs.length === 0 ? (
              <div className="small muted"><MarkdownInline>还没有表达式；点击右上「添加表达式」，例如 `sin(x)` 或 `2.5*x^2 + 1`。</MarkdownInline></div>
            ) : (
              <div className="stack">
                {draft.exprs.map((e) => {
                  const err = exprErrorOf(e.id);
                  return (
                    <div key={e.id} className="stack" style={{ gap: 6, borderTop: '1px solid var(--line)', paddingTop: 8 }}>
                      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                        <input
                          className={`input${err ? ' invalid' : ''}`}
                          style={{ minWidth: 180, flex: 1 }}
                          value={e.expr}
                          placeholder="如 sin(x) 或 2.5*x^2 + 1"
                          onChange={(ev) => patchExpr(e.id, { expr: ev.target.value })}
                          aria-label="表达式 y=f(x)"
                        />
                        <input
                          className="input"
                          style={{ maxWidth: 120 }}
                          value={e.name}
                          placeholder="系列名（可选）"
                          onChange={(ev) => patchExpr(e.id, { name: ev.target.value })}
                          aria-label="表达式系列名"
                        />
                        <Button size="sm" variant="ghost" onClick={() => removeExpr(e.id)}>删除</Button>
                      </div>
                      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                        <span className="small muted"><MarkdownInline>取样区间</MarkdownInline></span>
                        <input className="input" style={{ width: 84 }} value={e.xmin} onChange={(ev) => patchExpr(e.id, { xmin: ev.target.value })} aria-label="取样起点" />
                        <span className="small muted">—</span>
                        <input className="input" style={{ width: 84 }} value={e.xmax} onChange={(ev) => patchExpr(e.id, { xmax: ev.target.value })} aria-label="取样终点" />
                        <span className="small muted"><MarkdownInline>点数</MarkdownInline></span>
                        <input className="input" style={{ width: 70 }} value={e.samples} onChange={(ev) => patchExpr(e.id, { samples: ev.target.value })} aria-label="取样点数" />
                      </div>
                      {err && <div className="field-error"><MarkdownInline>{err.message}</MarkdownInline></div>}
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>

          <Panel title="图名与坐标轴" sub="坐标起点/终点留空则自动伸展；对数轴下非正范围被忽略">
            <div className="form-grid">
              <div className="field">
                <div className="field-label"><MarkdownInline>图名</MarkdownInline></div>
                <input className="input" value={draft.title} onChange={(e) => patch({ title: e.target.value })} />
              </div>
              <div className="field">
                <div className="field-label"><MarkdownInline>横轴名称 / 单位</MarkdownInline></div>
                <div className="row" style={{ gap: 6 }}>
                  <input className="input" value={draft.xName} onChange={(e) => patch({ xName: e.target.value })} aria-label="横轴名称" />
                  <input className="input" style={{ maxWidth: 110 }} value={draft.xUnit} placeholder="单位" onChange={(e) => patch({ xUnit: e.target.value })} aria-label="横轴单位" />
                </div>
              </div>
              <div className="field">
                <div className="field-label"><MarkdownInline>纵轴名称 / 单位</MarkdownInline></div>
                <div className="row" style={{ gap: 6 }}>
                  <input className="input" value={draft.yName} onChange={(e) => patch({ yName: e.target.value })} aria-label="纵轴名称" />
                  <input className="input" style={{ maxWidth: 110 }} value={draft.yUnit} placeholder="单位" onChange={(e) => patch({ yUnit: e.target.value })} aria-label="纵轴单位" />
                </div>
              </div>
              <div className="field">
                <div className="field-label"><MarkdownInline>横轴起点 / 终点</MarkdownInline></div>
                <div className="row" style={{ gap: 6 }}>
                  <input className="input" style={{ maxWidth: 110 }} value={draft.xMin} placeholder="自动" onChange={(e) => patch({ xMin: e.target.value })} aria-label="横轴起点" />
                  <input className="input" style={{ maxWidth: 110 }} value={draft.xMax} placeholder="自动" onChange={(e) => patch({ xMax: e.target.value })} aria-label="横轴终点" />
                </div>
              </div>
              <div className="field">
                <div className="field-label"><MarkdownInline>纵轴起点 / 终点</MarkdownInline></div>
                <div className="row" style={{ gap: 6 }}>
                  <input className="input" style={{ maxWidth: 110 }} value={draft.yMin} placeholder="自动" onChange={(e) => patch({ yMin: e.target.value })} aria-label="纵轴起点" />
                  <input className="input" style={{ maxWidth: 110 }} value={draft.yMax} placeholder="自动" onChange={(e) => patch({ yMax: e.target.value })} aria-label="纵轴终点" />
                </div>
              </div>
              <div className="field">
                <div className="field-label"><MarkdownInline>标度</MarkdownInline></div>
                <div className="row" style={{ gap: 14 }}>
                  <label className="row" style={{ gap: 6 }}>
                    <input type="checkbox" checked={draft.xLog} onChange={(e) => patch({ xLog: e.target.checked })} />
                    <MarkdownInline>横轴对数</MarkdownInline>
                  </label>
                  <label className="row" style={{ gap: 6 }}>
                    <input type="checkbox" checked={draft.yLog} onChange={(e) => patch({ yLog: e.target.checked })} />
                    <MarkdownInline>纵轴对数</MarkdownInline>
                  </label>
                </div>
              </div>
            </div>
            <div className="row" style={{ marginTop: 8 }}>
              <ConfirmButton
                size="sm"
                question="确认清空绘图工作台全部输入？"
                onConfirm={() => { clearToolDraft('plotter'); setDraft(INITIAL); toast('已清空绘图草稿'); }}
              >清空草稿</ConfirmButton>
            </div>
          </Panel>
        </div>

        <div className="stack">
          <Panel title="图像预览" sub="导出为白底可打印样式（可在设置中更改）">
            {allSeries.length === 0 ? (
              <EmptyState icon="chart" title="等待数据或表达式" hint="在左侧粘贴数据列，或添加一条 y=f(x) 表达式" />
            ) : (
              <PhysicsPlot
                title={draft.title || '未命名图'}
                xLabel={xLabel}
                yLabel={yLabel}
                series={allSeries}
                height={420}
                annotations={exprSeries.annotations}
                xLog={draft.xLog}
                yLog={draft.yLog}
                xMin={parseAxisBound(draft.xMin, draft.xLog)}
                xMax={parseAxisBound(draft.xMax, draft.xLog)}
                yMin={parseAxisBound(draft.yMin, draft.yLog)}
                yMax={parseAxisBound(draft.yMax, draft.yLog)}
              />
            )}
          </Panel>
          {allSeries.length > 0 && (
            <PlotChecklist title={draft.title} xLabel={xLabel} yLabel={yLabel} series={allSeries} />
          )}
          <Notice variant="info">
            <MarkdownInline>{'导出的 CSV 同时包含数据点与表达式采样点；需要拟合时用「发送到… → 线性拟合」。'}</MarkdownInline>
          </Notice>
        </div>
      </div>
    </div>
  );
}
