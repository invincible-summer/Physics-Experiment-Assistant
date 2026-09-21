/** 线性拟合页（plan §9.3）：DataGrid 成对录入 + 普通 OLS / 强制过原点 / 加权拟合，变换 + 拟合图 + 残差图 + 课程修约结果 + 数据流转 */
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ols, olsThroughOrigin, weightedOLS, TRANSFORMS } from '../../core/regression';
import type { OLSResult, ThroughOriginResult, WeightedOLSResult } from '../../core/regression';
import { fitParameterDisplay } from '../../core/sigfig';
import { parseNumericText } from '../../core/numeric';
import { useSettings } from '../../stores/settings';
import { Button, EmptyState, Field, Menu, Notice, Panel, toast } from '../../components/ui';
import { PhysicsPlot, PlotChecklist, PlotSeries } from '../../components/PhysicsPlot';
import { Tex } from '../../components/katex';
import { makeResult, ResultItem } from '../../core/results';
import { ResultCard } from '../../components/ResultInspector';
import { MarkdownInline } from '../../components/Markdown';
import { DataGrid, GridColumn } from '../../components/DataGrid';
import { useToolDraft } from './use-tool-draft';
import { PayloadBanner } from './PayloadBanner';
import { useToolBus } from './tool-bus';
import { fmtDisplay } from './fmt';

type FitMode = 'ols' | 'origin' | 'weighted';
type FitResult = OLSResult | ThroughOriginResult | WeightedOLSResult;
type Analysis = { fit: FitResult; xs: number[]; ys: number[]; badWeights: number } | { error: string };

/** 变换元数据：选项文案、定义域检查、默认轴标签 */
const TRANSFORM_ORDER = ['identity', 'ln', 'log10', 'square', 'reciprocal', 'sqrt'] as const;
const TRANSFORM_META: Record<string, {
  option: (base: string) => string;
  domain: (v: number) => boolean;
  axis: (base: string) => string;
}> = {
  identity: { option: (b) => `${b}（恒等）`, domain: () => true, axis: (b) => b },
  ln: { option: (b) => `ln ${b}`, domain: (v) => v > 0, axis: (b) => `ln ${b}` },
  log10: { option: (b) => `lg ${b}（log10）`, domain: (v) => v > 0, axis: (b) => `lg ${b}` },
  square: { option: (b) => `${b}²`, domain: () => true, axis: (b) => `${b}²` },
  reciprocal: { option: (b) => `1/${b}`, domain: (v) => v !== 0, axis: (b) => `1/${b}` },
  sqrt: { option: (b) => `√${b}`, domain: (v) => v >= 0, axis: (b) => `√${b}` },
};

const MODE_EQUATION: Record<FitMode, string> = {
  ols: 'y = a + bx',
  origin: 'y = bx',
  weighted: '加权 y = a + bx',
};

interface RegDraft {
  rows: string[][];
  mode: FitMode;
  xTransform: string;
  yTransform: string;
  swapXY: boolean;
  xName: string;
  yName: string;
}

const INITIAL_DRAFT: RegDraft = {
  rows: Array.from({ length: 8 }, () => ['', '', '']),
  mode: 'ols',
  xTransform: 'identity',
  yTransform: 'identity',
  swapXY: false,
  xName: '',
  yName: '',
};

export function RegressionPage() {
  const profile = useSettings((s) => s.activeProfile());
  const showFitR = useSettings((s) => s.showFitR);
  const showRR2 = useSettings((s) => s.showRR2);
  const confidence = profile.confidence ?? 0.95;
  const navigate = useNavigate();
  const send = useToolBus((s) => s.send);

  const [draft, setDraft] = useToolDraft<RegDraft>('regression', INITIAL_DRAFT);
  const { rows, mode, xTransform, yTransform, swapXY, xName, yName } = draft;
  const patch = (p: Partial<RegDraft>) => setDraft((d) => ({ ...d, ...p }));

  const gridColumns: GridColumn[] = useMemo(() => {
    const cols: GridColumn[] = [
      { id: 'x', header: '$x$' },
      { id: 'y', header: '$y$' },
    ];
    if (mode === 'weighted') cols.push({ id: 'w', header: '权重 $w_i$' });
    return cols;
  }, [mode]);

  /** 行 → 数值对（原始文本保留给有效数字规则；非法格记 NaN 由定义域/有限性过滤） */
  const data = useMemo(() => {
    const xs: number[] = [];
    const ys: number[] = [];
    const ws: number[] = [];
    const rawXs: string[] = [];
    const rawYs: string[] = [];
    for (const row of rows) {
      const rx = (row[0] ?? '').trim();
      const ry = (row[1] ?? '').trim();
      if (rx === '' && ry === '') continue;
      const px = parseNumericText(rx);
      const py = parseNumericText(ry);
      const pw = parseNumericText((row[2] ?? '').trim());
      rawXs.push(rx);
      rawYs.push(ry);
      xs.push(px.ok ? px.value : NaN);
      ys.push(py.ok ? py.value : NaN);
      ws.push(pw.ok ? pw.value : NaN);
    }
    return { xs, ys, ws, rawXs, rawYs };
  }, [rows]);

  const analysis: Analysis | null = useMemo(() => {
    const tx = TRANSFORMS[xTransform] ?? TRANSFORMS.identity;
    const ty = TRANSFORMS[yTransform] ?? TRANSFORMS.identity;
    const dx = TRANSFORM_META[xTransform]?.domain ?? (() => true);
    const dy = TRANSFORM_META[yTransform]?.domain ?? (() => true);
    // 定义域检查：只剔除所选变换无法取值的数据对（如 ln 要求 > 0）
    const pairs = data.xs
      .map((x, i) => ({ x, y: data.ys[i], w: data.ws[i] }))
      .filter(({ x, y }) => Number.isFinite(x) && Number.isFinite(y) && dx(x) && dy(y));
    const need = mode === 'origin' ? 2 : 3;
    if (pairs.length < need) return null;
    let xs0 = pairs.map((p) => tx(p.x));
    let ys0 = pairs.map((p) => ty(p.y));
    if (swapXY) { [xs0, ys0] = [ys0, xs0]; }
    // 权重与数据点逐行对齐：缺失/非法（≤0）权重计数，存在时整体退化为等权并警告
    const badWeights = mode === 'weighted' ? pairs.filter((p) => !Number.isFinite(p.w) || p.w <= 0).length : 0;
    const wFit = mode === 'weighted'
      ? (badWeights === 0 ? pairs.map((p) => p.w) : xs0.map(() => 1))
      : [];
    try {
      const fit: FitResult = mode === 'origin'
        ? olsThroughOrigin(xs0, ys0, confidence)
        : mode === 'weighted'
          ? weightedOLS(xs0, ys0, wFit, confidence)
          : ols(xs0, ys0, confidence);
      return { fit, xs: xs0, ys: ys0, badWeights };
    } catch (err) {
      return { error: (err as Error).message };
    }
  }, [data, mode, xTransform, yTransform, swapXY, confidence]);

  const defaultXLabel = TRANSFORM_META[xTransform]?.axis('x') ?? 'x';
  const defaultYLabel = TRANSFORM_META[yTransform]?.axis('y') ?? 'y';
  const xLabel = xName.trim() || defaultXLabel;
  const yLabel = yName.trim() || defaultYLabel;
  const plotTitle = `数据与拟合（${MODE_EQUATION[mode]}）`;

  const series: PlotSeries[] = useMemo(() => {
    if (!analysis || 'error' in analysis) return [];
    const { fit, xs, ys } = analysis;
    const dataSeries: PlotSeries = { name: '数据', points: xs.map((x, i) => ({ x, y: ys[i] })), type: 'scatter' };
    const xMin = Math.min(...xs);
    const xMax = Math.max(...xs);
    const pad = (xMax - xMin) * 0.05 || 1;
    const linePoints = [xMin - pad, xMax + pad].map((x) => ({
      x,
      y: 'a' in fit ? fit.a + fit.b * x : fit.b * x,
    }));
    const fitSeries: PlotSeries = {
      name: `拟合 ${MODE_EQUATION[mode]}`, points: linePoints, type: 'line', dashed: true, showSymbol: false,
    };
    return [dataSeries, fitSeries];
  }, [analysis, mode]);

  const residualSeries: PlotSeries[] = useMemo(() => {
    if (!analysis || 'error' in analysis) return [];
    const { fit, xs } = analysis;
    const xMin = Math.min(...xs);
    const xMax = Math.max(...xs);
    return [
      { name: '残差', points: xs.map((x, i) => ({ x, y: fit.residuals[i] })), type: 'scatter' },
      { name: 'e = 0', points: [{ x: xMin, y: 0 }, { x: xMax, y: 0 }], type: 'line', dashed: true, showSymbol: false },
    ];
  }, [analysis]);

  const statRows = useMemo(() => {
    if (!analysis || 'error' in analysis) return [];
    const fit = analysis.fit;
    const tRow = { label: `$t_{${confidence}}(\\nu=${fit.dof})$`, value: fmtDisplay(fit.t) };
    if ('r' in fit) {
      const rows = [
        { label: '数据点数 $n$', value: String(fit.n) },
        { label: '截距 $a$', value: fmtDisplay(fit.a) },
        { label: '斜率 $b$', value: fmtDisplay(fit.b) },
      ];
      if (showFitR) rows.push({ label: '相关系数 $r$（课程首选）', value: fmtDisplay(fit.r, 8) });
      if (showRR2) rows.push({ label: '$R^2$（工程扩展指标）', value: fmtDisplay(fit.r2, 8) });
      rows.push(
        tRow,
        { label: '$S_a$（截距标准误）', value: fmtDisplay(fit.sa) },
        { label: '$S_b$（斜率标准误）', value: fmtDisplay(fit.sb) },
        { label: '$\\Delta_a = t\\,S_a$', value: fmtDisplay(fit.deltaA) },
        { label: '$\\Delta_b = t\\,S_b$', value: fmtDisplay(fit.deltaB) },
        { label: '残差平方和 $\\mathrm{SSE}$', value: fmtDisplay(fit.sse) },
        { label: '剩余标准差 $S$', value: fmtDisplay(fit.s) },
      );
      return rows;
    }
    if ('chi2' in fit) {
      return [
        { label: '数据点数 $n$', value: String(fit.n) },
        { label: '截距 $a$', value: fmtDisplay(fit.a) },
        { label: '斜率 $b$', value: fmtDisplay(fit.b) },
        tRow,
        { label: '$S_a$（截距标准误）', value: fmtDisplay(fit.sa) },
        { label: '$S_b$（斜率标准误）', value: fmtDisplay(fit.sb) },
        { label: '$\\Delta_a = t\\,S_a$', value: fmtDisplay(fit.deltaA) },
        { label: '$\\Delta_b = t\\,S_b$', value: fmtDisplay(fit.deltaB) },
        { label: '加权残差平方和 $\\chi^2$', value: fmtDisplay(fit.chi2) },
        { label: '剩余标准差 $S$', value: fmtDisplay(fit.s) },
      ];
    }
    return [
      { label: '数据点数 $n$', value: String(fit.n) },
      { label: '斜率 $b$', value: fmtDisplay(fit.b) },
      { label: '原点回归 $R^2 = 1 - \\mathrm{SSE}/\\sum_i y_i^2$', value: fmtDisplay(fit.r2, 8) },
      tRow,
      { label: '$S_b$（斜率标准误）', value: fmtDisplay(fit.sb) },
      { label: '$\\Delta_b = t\\,S_b$', value: fmtDisplay(fit.deltaB) },
      { label: '残差平方和 $\\mathrm{SSE}$', value: fmtDisplay(fit.sse) },
      { label: '剩余标准差 $S$', value: fmtDisplay(fit.s) },
    ];
  }, [analysis, confidence, showFitR, showRR2]);

  const resultItem = useMemo<ResultItem | null>(() => {
    if (!analysis || 'error' in analysis) return null;
    const fit = analysis.fit;
    const hasIntercept = 'a' in fit;
    const { aText, bText } = hasIntercept
      ? fitParameterDisplay(fit.a, fit.b, data.rawXs, data.rawYs)
      : { aText: '—', bText: String(fit.b.toPrecision(6)) };
    const warnings: string[] = [];
    if (mode === 'weighted' && analysis.badWeights > 0) {
      warnings.push(`**${analysis.badWeights}** 行权重缺失或不是正数，已按等权 $w_i=1$ 处理`);
    }
    const modeLabel = mode === 'ols' ? '普通 OLS' : mode === 'origin' ? '强制过原点' : '加权（通用扩展）';
    return makeResult({
      id: 'regression',
      title: `线性拟合结果（${modeLabel}，$\\nu=${fit.dof}$）`,
      finalText: hasIntercept ? `a=${aText}，b=${bText}` : `b=${bText}`,
      steps: [
        {
          formulaLatex: hasIntercept ? 'y = a + b x' : 'y = b x',
          substitution: `n=${fit.n}，${hasIntercept ? `a=${fit.a.toPrecision(8)}，` : ''}b=${fit.b.toPrecision(8)}${'r' in fit ? `，r=${fit.r.toPrecision(6)}` : ''}${'chi2' in fit ? `，χ²=${fit.chi2.toPrecision(6)}` : ''}${!hasIntercept && !('r' in fit) ? `，R²=${fit.r2.toPrecision(6)}` : ''}`,
          unrounded: hasIntercept
            ? `Sa=${fit.sa.toPrecision(8)}，Sb=${fit.sb.toPrecision(8)}，Δa=${fit.deltaA.toPrecision(8)}，Δb=${fit.deltaB.toPrecision(8)}（t=${fit.t.toPrecision(6)}）`
            : `Sb=${fit.sb.toPrecision(8)}，Δb=${fit.deltaB.toPrecision(8)}（t=${fit.t.toPrecision(6)}）`,
        },
      ],
      roundingNote: mode === 'ols'
        ? '未估算拟合参数不确定度时的绪论课规则：截距 a 末位至少与 yi 末位取齐；斜率 b 有效位数至少与 xi 有效位数一致；r 至少保留一个非 9 数字'
        : undefined,
      ruleNotes: profile.kind === 'course'
        ? ['课程首先显示 r；R² 仅作工程扩展指标', '拟合参数置信区间使用 ν = n−2 的 t 因子']
        : ['GB/T 模式下拟合参数标准误 Sa、Sb 即标准不确定度'],
      warnings,
      provenance: { status: 'source-explicit', document: '课程基础知识202009.pptx / 讲义第II部分' },
    });
  }, [analysis, mode, data, profile]);

  const sendScalar = (name: string, value: number, unc: number) => {
    send({
      kind: 'scalar',
      source: '线性拟合',
      name,
      valueText: String(value),
      uncText: String(unc),
      createdAt: new Date().toISOString(),
    });
    toast(`已送出 ${name}，在不确定度传播页确认填入`);
    navigate('/tools/uncertainty');
  };

  const fitOk = analysis && !('error' in analysis) ? analysis : null;

  return (
    <>
      <header className="page-head">
        <h1 className="page-title"><MarkdownInline>线性拟合</MarkdownInline></h1>
        <p className="page-lead">
          <MarkdownInline>{`成对数据 + 拟合选项 → $a$ / $b$ / $r$ / $S_a$ / $S_b$ / 置信区间 / 残差诊断（当前标准：**${profile.shortName}**）`}</MarkdownInline>
        </p>
      </header>

      <PayloadBanner
        accept="table"
        onAccept={(p) => {
          if (p.kind !== 'table') return;
          if (p.headers.length <= 1) {
            patch({ rows: p.rows.map((r, i) => [String(i + 1), r[0] ?? '', '']) });
            toast('已填入：单列数据作为 y，x 自动取序号');
          } else {
            patch({ rows: p.rows.map((r) => [r[0] ?? '', r[1] ?? '', r[2] ?? '']) });
            toast('已填入前两列作为 x / y');
          }
        }}
      />

      <div className="tool-layout">
        <div className="stack">
          <Panel title="数据与选项" sub="两列成对数据，可直接从 Excel 粘贴或导入 CSV">
            <DataGrid
              columns={gridColumns}
              rows={rows}
              onChange={(next) => patch({ rows: next })}
              defaultRows={8}
              hint="x / y 成对录入；无法解析的单元格按缺失处理"
            />
            <div className="form-grid" style={{ marginTop: 10 }}>
              <Field label="拟合方式">
                <select className="select" value={mode} onChange={(e) => patch({ mode: e.target.value as FitMode })}>
                  <option value="ols">普通最小二乘 y=a+bx</option>
                  <option value="origin">强制过原点 y=bx</option>
                  <option value="weighted">加权线性拟合（通用扩展）</option>
                </select>
              </Field>
              <Field label="$x$ 变换">
                <select className="select" value={xTransform} onChange={(e) => patch({ xTransform: e.target.value })}>
                  {TRANSFORM_ORDER.map((k) => <option key={k} value={k}>{TRANSFORM_META[k].option('x')}</option>)}
                </select>
              </Field>
              <Field label="$y$ 变换">
                <select className="select" value={yTransform} onChange={(e) => patch({ yTransform: e.target.value })}>
                  {TRANSFORM_ORDER.map((k) => <option key={k} value={k}>{TRANSFORM_META[k].option('y')}</option>)}
                </select>
              </Field>
              <Field label="交换 $x$ / $y$" hint={swapXY ? '当前已交换：以原 y 列为自变量拟合' : '默认以 x 列为自变量'}>
                <div>
                  <Button variant={swapXY ? 'primary' : 'default'} aria-pressed={swapXY} onClick={() => patch({ swapXY: !swapXY })}>交换 x/y</Button>
                </div>
              </Field>
              <Field label="横轴名称（含单位）" hint="留空使用默认标签">
                <input className="input" value={xName} onChange={(e) => patch({ xName: e.target.value })} placeholder={defaultXLabel} />
              </Field>
              <Field label="纵轴名称（含单位）" hint="留空使用默认标签">
                <input className="input" value={yName} onChange={(e) => patch({ yName: e.target.value })} placeholder={defaultYLabel} />
              </Field>
            </div>
            {mode === 'weighted' && (
              <div style={{ marginTop: 8 }}>
                <Notice variant="info">
                  <MarkdownInline>权重列通常取 $w_i = 1/u_i^2$（独立测量假设）；所有权重必须为正，缺失或非法权重将按等权处理并警告。加权线性拟合属于**通用扩展**，不是上传课程讲义的必修公式。</MarkdownInline>
                </Notice>
              </div>
            )}
            {analysis && 'error' in analysis && (
              <div style={{ marginTop: 8 }}>
                <Notice variant="danger" title="拟合失败">
                  <MarkdownInline>{analysis.error}</MarkdownInline>
                </Notice>
              </div>
            )}
          </Panel>
        </div>

        <div className="stack">
          {series.length === 2 && (
            <Panel title="拟合图">
              <PhysicsPlot title={plotTitle} xLabel={xLabel} yLabel={yLabel} series={series} />
              <div style={{ marginTop: 8 }}>
                <PlotChecklist title={plotTitle} xLabel={xLabel} yLabel={yLabel} series={series} />
              </div>
            </Panel>
          )}

          {fitOk && (
            <Panel title="残差图" sub="残差应围绕 0 随机分布，无系统趋势">
              <PhysicsPlot
                title="残差图"
                xLabel={xLabel}
                yLabel="残差 e"
                series={residualSeries}
                height={240}
              />
            </Panel>
          )}

          <Panel
            title="拟合结果"
            sub={`修约规则来自当前标准：${profile.shortName}`}
            actions={fitOk ? (
              <Menu
                trigger="发送到…"
                items={[
                  { id: 'b', label: '斜率 $b \\pm \\Delta_b$ → 不确定度传播', icon: 'ruler' },
                  { id: 'a', label: '截距 $a \\pm \\Delta_a$ → 不确定度传播', icon: 'ruler', disabled: !('a' in fitOk.fit) },
                ]}
                onSelect={(id) => {
                  if (id === 'b') sendScalar('b', fitOk.fit.b, fitOk.fit.deltaB);
                  if (id === 'a' && 'a' in fitOk.fit) sendScalar('a', fitOk.fit.a, fitOk.fit.deltaA);
                }}
              />
            ) : undefined}
          >
            {resultItem ? (
              <>
                <table className="stat-table">
                  <tbody>
                    {statRows.map((row) => (
                      <tr key={row.label}>
                        <td><MarkdownInline>{row.label}</MarkdownInline></td>
                        <td className="num">{row.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ marginTop: 10 }}>
                  <ResultCard item={resultItem} profileName={profile.shortName} />
                </div>
              </>
            ) : (
              <EmptyState
                icon="function"
                title="等待数据"
                hint={`至少输入 ${mode === 'origin' ? '2' : '3'} 对有效数据后开始拟合；无法解析的行与变换定义域外的取值会被忽略`}
              />
            )}
          </Panel>

          {(mode === 'ols' || mode === 'weighted') && (
            <Notice variant="info" title="OLS 模型假设">
              <MarkdownInline>最小二乘假设 **$x$ 的误差可忽略**、不确定度全部集中在 $y$。若 $x$ 列来自仪器读数且其误差相对 $y$ 不可忽略，斜率估计会有偏；v1 暂未支持正交回归（ODR），请在报告中注明该假设。</MarkdownInline>
            </Notice>
          )}

          <Panel title="课程公式视图" sub="课程基础知识202009.pptx / 讲义第II部分">
            <div className="stack">
              <Tex tex="b=\dfrac{S_{xy}}{S_{xx}},\qquad a=\bar{y}-b\,\bar{x}" display />
              <Tex tex="r=\dfrac{S_{xy}}{\sqrt{S_{xx}\,S_{yy}}}" display />
              <Tex tex="S_b = |b|\sqrt{\dfrac{r^{-2}-1}{n-2}},\qquad S_a = S_b\sqrt{\overline{x^2}} = S_b\sqrt{\dfrac{1}{n}\sum_i x_i^2}" display />
              <Tex tex="\Delta_b = t_{0.95}(n{-}2)\,S_b,\qquad \Delta_a = t_{0.95}(n{-}2)\,S_a" display />
              {fitOk && 'r' in fitOk.fit && (
                <div className="small muted">
                  <MarkdownInline>{`交叉验证：课程式 $S_b$ = ${fmtDisplay(fitOk.fit.sbCourse)}，规范式 $S/\\sqrt{S_{xx}}$ = ${fmtDisplay(fitOk.fit.sb)}，两者一致。`}</MarkdownInline>
                </div>
              )}
              <div className="small muted">
                <MarkdownInline>过原点拟合自由度为 $\nu = n-1$；加权拟合无课程原式，按通用加权最小二乘处理。</MarkdownInline>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
