/**
 * 绘图工作台（/tools/plotter）：MATLAB/pyplot 风格的通用画图工具。
 * 数据系列（DataGrid 多列：x + y1..yn）+ 表达式系列 y=f(x)（安全 AST 求值，无 eval）；
 * 轴名/单位/坐标范围（横纵起点）/对数轴可配；SVG/PNG/CSV 导出；
 * 与工具总线联动：接收其他工具的表格载荷，也可把当前数据发送给线性拟合。
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { parseNumericText } from '../../core/numeric';
import { axisRange, sampleFunction } from '../../core/graph';
import { PhysicsPlot, PlotSeries, PlotChecklist } from '../../components/PhysicsPlot';
import { DataGrid, GridColumn } from '../../components/DataGrid';
import { Button, ConfirmButton, EmptyState, Menu, Notice, Panel, toast } from '../../components/ui';
import { MarkdownBlock, MarkdownInline } from '../../components/Markdown';
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

export function PlotterPage() {
  const navigate = useNavigate();
  const send = useToolBus((s) => s.send);
  const [draft, setDraft] = useToolDraft<PlotterDraft>('plotter', INITIAL);
  const patch = (p: Partial<PlotterDraft>) => setDraft((d) => ({ ...d, ...p }));
  const [exprSeq, setExprSeq] = useState(1);
  const [showGrid, setShowGrid] = useState(true);
  const [editorTab, setEditorTab] = useState<'data' | 'function' | 'axes'>('data');
  const [focusPlot, setFocusPlot] = useState(false);

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
      const breakBefore: number[] = [];
      let gap = false;
      for (const row of draft.rows) {
        const xr = (row[0] ?? '').trim();
        const yr = (row[i + 1] ?? '').trim();
        if (xr === '' || yr === '') { gap = true; continue; }
        const xp = parseNumericText(xr);
        const yp = parseNumericText(yr);
        if (!xp.ok || !yp.ok) { gap = true; continue; }
        if (gap && points.length) breakBefore.push(points.length);
        gap = false;
        points.push({ x: xp.value, y: yp.value });
      }
      if (points.length === 0) continue;
      out.push({
        name: draft.seriesNames[i] || `y${i + 1}`,
        points,
        breakBefore,
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
      let sampled;
      try {
        sampled = sampleFunction(expr, e.xmin, e.xmax, e.samples, draft.xLog, draft.yLog);
      } catch (err) {
        errors.push({ id: e.id, message: (err as Error).message });
        continue;
      }
      const { points, breakBefore, skipped } = sampled;
      if (points.length < 2) {
        errors.push({ id: e.id, message: '取样区间内有效点不足，请检查定义域与对数轴约束' });
        continue;
      }
      const name = e.name.trim() || `y = ${expr}`;
      series.push({ name, points, breakBefore, type: 'line', dashed: series.length % 2 === 1 });
      annotations.push({ text: `${name}，${points.length} 个有效点${skipped ? `，${skipped} 点域外或不满足对数轴约束` : ''}` });
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

  const addExpr = (expr = '', xmin = '0', xmax = '10') => {
    const id = `e${Date.now().toString(36)}${exprSeq}`;
    setExprSeq((v) => v + 1);
    patch({
      exprs: [...draft.exprs, { id, name: '', expr, xmin, xmax, samples: '201' }],
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

  const bounds = useMemo(() => {
    try {
      const x = axisRange(draft.xMin, draft.xMax, draft.xLog);
      const y = axisRange(draft.yMin, draft.yMax, draft.yLog);
      return { x, y, error: '' };
    } catch (error) { return { x: { min: undefined, max: undefined }, y: { min: undefined, max: undefined }, error: (error as Error).message }; }
  }, [draft.xMin, draft.xMax, draft.yMin, draft.yMax, draft.xLog, draft.yLog]);
  const hiddenPoints = dataSeries.reduce((n, s) => n + s.points.filter(p => (draft.xLog && p.x <= 0) || (draft.yLog && p.y <= 0)).length, 0);
  const invalidRows = draft.rows.filter(row => row.some(v => v.trim()) && (
    !parseNumericText(row[0] ?? '').ok || Array.from({ length: draft.yCount }, (_, i) => row[i + 1] ?? '').some(v => !parseNumericText(v).ok)
  )).length;
  const hasData = dataSeries.length > 0;

  return (
    <div className="stack-lg">
      <header className="page-head">
        <h1 className="page-title"><MarkdownInline>绘图工作台</MarkdownInline></h1>
        <div className="page-lead">
          <MarkdownBlock>表格数据与 $y=f(x)$ 表达式混合成图；轴名、单位、坐标起点与对数轴可配；导出 SVG / PNG / CSV，或把数据发送给线性拟合。</MarkdownBlock>
        </div>
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

      <div className="plot-workflow row">
        <span><MarkdownInline>**01** 录入数据或函数</MarkdownInline></span>
        <span><MarkdownInline>**02** 设置坐标与图名</MarkdownInline></span>
        <span><MarkdownInline>**03** 检查并导出</MarkdownInline></span>
        <Button size="sm" onClick={() => setFocusPlot(!focusPlot)} aria-pressed={focusPlot}>{focusPlot ? '返回编辑' : '专注看图'}</Button>
      </div>
      <div className={`plot-workspace${focusPlot ? ' plot-focus' : ''}`}>

        <div className="stack">
          <div className="plot-editor-nav row" role="group" aria-label="绘图编辑步骤">
            <Button size="sm" variant={editorTab === 'data' ? 'primary' : 'ghost'} aria-pressed={editorTab === 'data'} onClick={() => setEditorTab('data')}>数据录入</Button>
            <Button size="sm" variant={editorTab === 'function' ? 'primary' : 'ghost'} aria-pressed={editorTab === 'function'} onClick={() => setEditorTab('function')}>函数曲线</Button>
            <Button size="sm" variant={editorTab === 'axes' ? 'primary' : 'ghost'} aria-pressed={editorTab === 'axes'} onClick={() => setEditorTab('axes')}>图名与坐标</Button>
          </div>
          <Panel
            className={editorTab === 'data' ? '' : 'plot-editor-hidden'}
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
                    <MarkdownInline allowLinks={false}>数据点连线</MarkdownInline>
                  </label>
                </div>
              </div>
            </div>
          </Panel>

          <Panel
            className={editorTab === 'function' ? '' : 'plot-editor-hidden'}
            title="表达式系列"
            sub="输入 $y=f(x)$，三角函数使用弧度；可与测量数据叠加比较"
            actions={<Button size="sm" icon="function" onClick={() => addExpr()}>添加表达式</Button>}
          >
            <div className="row plot-presets">
              <span className="small muted"><MarkdownInline>添加数学函数</MarkdownInline></span>
              <Button size="sm" onClick={() => addExpr('sin(x)', '0', '6.283185307179586')}>正弦函数</Button>
              <Button size="sm" onClick={() => addExpr('exp(-x)*cos(2*pi*x)')}>衰减振荡</Button>
              <Button size="sm" onClick={() => addExpr('x^2')}>二次函数</Button>
            </div>
            {draft.exprs.length === 0 ? (
              <div className="small muted"><MarkdownBlock>还没有表达式；点击右上「添加表达式」，例如 `sin(x)` 或 `2.5*x^2 + 1`。</MarkdownBlock></div>
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
                        <span className="small muted"><MarkdownInline>至</MarkdownInline></span>
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

          <Panel className={editorTab === 'axes' ? '' : 'plot-editor-hidden'} title="图名与坐标轴" sub="坐标起点/终点留空则自动伸展；对数轴的起点与终点必须为正值">
            <div className="form-grid">
              <div className="field">
                <div className="field-label"><MarkdownInline>图名</MarkdownInline></div>
                <input className="input" aria-label="图名" value={draft.title} onChange={(e) => patch({ title: e.target.value })} />
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
                    <MarkdownInline allowLinks={false}>横轴对数</MarkdownInline>
                  </label>
                  <label className="row" style={{ gap: 6 }}>
                    <input type="checkbox" checked={draft.yLog} onChange={(e) => patch({ yLog: e.target.checked })} />
                    <MarkdownInline allowLinks={false}>纵轴对数</MarkdownInline>
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
          <Panel title="图像预览" sub="拖动底部滑块缩放横轴；图例可切换系列显示" actions={<Button size="sm" aria-pressed={showGrid} onClick={() => setShowGrid(!showGrid)}>{showGrid ? '隐藏网格' : '显示网格'}</Button>}>
            {bounds.error && <Notice variant="danger" title="请修正坐标范围"><MarkdownBlock>{bounds.error}</MarkdownBlock></Notice>}
            {invalidRows > 0 && <Notice variant="warning"><MarkdownBlock>{`${invalidRows} 行含缺失或非法数值；仅绘制有效配对，连线在缺失处断开。`}</MarkdownBlock></Notice>}
            {hiddenPoints > 0 && <Notice variant="warning"><MarkdownBlock>{`${hiddenPoints} 个非正数据点无法显示在对数轴上，原始输入仍保留。`}</MarkdownBlock></Notice>}

            {bounds.error ? null : allSeries.length === 0 ? (
              <EmptyState icon="chart" title="等待数据或表达式" hint="粘贴两列测量数据，或切换到「函数曲线」添加正弦函数" />
            ) : (
              <PhysicsPlot
                title={draft.title || '未命名图'}
                xLabel={xLabel}
                yLabel={yLabel}
                series={allSeries}
                height={480}
                interactive
                showGrid={showGrid}
                annotations={exprSeries.annotations}
                xLog={draft.xLog}
                yLog={draft.yLog}
                xMin={bounds.x.min}
                xMax={bounds.x.max}
                yMin={bounds.y.min}
                yMax={bounds.y.max}
              />
            )}
          </Panel>
          {dataSeries.length > 0 && (
            <PlotChecklist title={draft.title} xLabel={xLabel} yLabel={yLabel} series={allSeries} />
          )}
          <Notice variant="info">
            <MarkdownBlock>{'导出的 CSV 同时包含数据点与表达式采样点；需要拟合时用「发送到… → 线性拟合」。'}</MarkdownBlock>
          </Notice>
        </div>
      </div>
    </div>
  );
}
