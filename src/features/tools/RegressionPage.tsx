/** 线性拟合页（plan §9.3） */
import { useMemo, useState } from 'react';
import { PairInput } from './tool-inputs';
import { ols, olsThroughOrigin, weightedOLS, TRANSFORMS } from '../../core/regression';
import { fitParameterDisplay } from '../../core/sigfig';
import { useSettings } from '../../stores/settings';
import { Panel } from '../../components/ui';
import { PhysicsPlot, PlotChecklist, PlotSeries } from '../../components/PhysicsPlot';
import { Tex } from '../../components/katex';
import { makeResult } from '../../core/results';
import { ResultCard } from '../../components/ResultInspector';

type FitMode = 'ols' | 'origin' | 'weighted';

export function RegressionPage() {
  const profile = useSettings((s) => s.activeProfile());
  const [mode, setMode] = useState<FitMode>('ols');
  const [xTransform, setXTransform] = useState('identity');
  const [yTransform, setYTransform] = useState('identity');
  const [swapXY, setSwapXY] = useState(false);
  const [data, setData] = useState<{ xs: number[]; ys: number[]; rawXs: string[]; rawYs: string[] }>({ xs: [], ys: [], rawXs: [], rawYs: [] });
  const [weightsText, setWeightsText] = useState('');

  const weights = useMemo(() => {
    if (mode !== 'weighted') return [];
    return weightsText.split(/[\n,;，；\s]+/).map((s) => Number(s.trim())).filter((v) => Number.isFinite(v) && v > 0);
  }, [weightsText, mode]);

  const analysis = useMemo(() => {
    const tx = TRANSFORMS[xTransform] ?? TRANSFORMS.identity;
    const ty = TRANSFORMS[yTransform] ?? TRANSFORMS.identity;
    const pairs = data.xs
      .map((x, i) => [x, data.ys[i]] as const)
      .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y) && x > 0 && y > 0); // ln/ln 等域检查
    if (pairs.length < 3) return null;
    let xs0 = pairs.map(([x]) => tx(x));
    let ys0 = pairs.map(([, y]) => ty(y));
    if (swapXY) { [xs0, ys0] = [ys0, xs0]; }
    try {
      const fit = mode === 'origin'
        ? olsThroughOrigin(xs0, ys0, profile.confidence ?? 0.95)
        : mode === 'weighted'
          ? weightedOLS(xs0, ys0, weights.length === xs0.length ? weights : xs0.map(() => 1), profile.confidence ?? 0.95)
          : ols(xs0, ys0, profile.confidence ?? 0.95);
      return { fit, xs: xs0, ys: ys0, validWeights: weights.length === xs0.length };
    } catch (err) {
      return { error: (err as Error).message };
    }
  }, [data, mode, xTransform, yTransform, swapXY, weights, profile.confidence]);

  const series: PlotSeries[] = useMemo(() => {
    if (!analysis || 'error' in analysis) return [];
    const { fit, xs, ys } = analysis;
    const dataSeries: PlotSeries = { name: '数据点', points: xs.map((x, i) => ({ x, y: ys[i] })), type: 'scatter' };
    const xMin = Math.min(...xs);
    const xMax = Math.max(...xs);
    const pad = (xMax - xMin) * 0.05 || 1;
    const linePoints = [xMin - pad, xMax + pad].map((x) => ({
      x,
      y: 'a' in fit ? fit.a + fit.b * x : fit.b * x,
    }));
    const fitSeries: PlotSeries = {
      name: '拟合线', points: linePoints, type: 'line', dashed: true, showSymbol: false,
    };
    return [dataSeries, fitSeries];
  }, [analysis]);

  const xLabel = axisLabel('x', xTransform);
  const yLabel = axisLabel('y', yTransform);

  const resultItem = useMemo(() => {
    if (!analysis || 'error' in analysis) return null;
    const fit = analysis.fit;
    const isOls = 'a' in fit;
    const { aText, bText } = isOls
      ? fitParameterDisplay((fit as { a: number }).a, fit.b, data.rawXs, data.rawYs)
      : { aText: '—', bText: String(fit.b.toPrecision(6)) };
    return makeResult({
      id: 'regression',
      title: `线性拟合结果（${mode === 'ols' ? '普通 OLS' : mode === 'origin' ? '过原点' : '加权'}，ν=${fit.dof}）`,
      finalText: isOls ? `a=${aText}，b=${bText}` : `b=${bText}`,
      steps: [
        {
          formulaLatex: isOls ? 'y = a + b x' : 'y = b x',
          substitution: `n=${fit.n}，${isOls ? `a=${(fit as unknown as { a: number }).a.toPrecision(8)}，` : ''}b=${fit.b.toPrecision(8)}${isOls ? `，r=${(fit as unknown as { r: number }).r.toPrecision(6)}` : `，R²=${fit.r2.toPrecision(6)}`}`,
          unrounded: isOls
            ? `Sa=${(fit as { sa: number }).sa.toPrecision(8)}，Sb=${fit.sb.toPrecision(8)}，Δa=${fit.deltaA.toPrecision(8)}，Δb=${fit.deltaB.toPrecision(8)}（t=${fit.t.toPrecision(6)}）`
            : `Sb=${fit.sb.toPrecision(8)}，Δb=${fit.deltaB.toPrecision(8)}（t=${fit.t.toPrecision(6)}）`,
        },
      ],
      roundingNote: isOls
        ? '未估算拟合参数不确定度时的绪论课规则：截距 a 末位至少与 yi 末位取齐；斜率 b 有效位数至少与 xi 有效位数一致；r 至少保留一个非 9 数字'
        : undefined,
      ruleNotes: profile.kind === 'course'
        ? ['课程首先显示 r；R² 仅作工程扩展指标', '拟合参数置信区间使用 ν = n−2 的 t 因子']
        : ['GB/T 模式下拟合参数标准误 Sa、Sb 即标准不确定度'],
      provenance: { status: 'source-explicit', document: '课程基础知识202009.pptx / 讲义第II部分' },
    });
  }, [analysis, mode, data, profile]);

  return (
    <main className="page">
      <h1>线性拟合</h1>
      <p className="muted">成对数据 + 拟合选项 → a/b/r/Sa/Sb/置信区间/残差图（当前标准 {profile.shortName}）</p>
      <div className="tool-layout">
        <div className="stack">
          <Panel title="数据与选项">
            <PairInput label="x / y 数据（两列）" onChange={(xs, ys, rawXs, rawYs) => setData({ xs, ys, rawXs, rawYs })} />
            <div className="form-grid" style={{ marginTop: 10 }}>
              <div>
                <div className="field-label">拟合方式</div>
                <select className="select" value={mode} onChange={(e) => setMode(e.target.value as FitMode)}>
                  <option value="ols">普通最小二乘 y=a+bx</option>
                  <option value="origin">过原点 y=bx</option>
                  <option value="weighted">加权拟合（通用扩展）</option>
                </select>
              </div>
              <div>
                <div className="field-label">x 变换</div>
                <select className="select" value={xTransform} onChange={(e) => setXTransform(e.target.value)}>
                  <option value="identity">x</option>
                  <option value="ln">ln x</option>
                  <option value="log10">log x</option>
                  <option value="square">x²</option>
                  <option value="reciprocal">1/x</option>
                  <option value="sqrt">√x</option>
                </select>
              </div>
              <div>
                <div className="field-label">y 变换</div>
                <select className="select" value={yTransform} onChange={(e) => setYTransform(e.target.value)}>
                  <option value="identity">y</option>
                  <option value="ln">ln y</option>
                  <option value="log10">log y</option>
                  <option value="square">y²</option>
                  <option value="reciprocal">1/y</option>
                  <option value="sqrt">√y</option>
                </select>
              </div>
              <div>
                <div className="field-label">x/y 对调</div>
                <select className="select" value={swapXY ? '1' : '0'} onChange={(e) => setSwapXY(e.target.value === '1')}>
                  <option value="0">否</option>
                  <option value="1">是</option>
                </select>
              </div>
            </div>
            {mode === 'weighted' && (
              <div style={{ marginTop: 8 }}>
                <div className="field-label">权重（每行一个，与数据点一一对应；通常 wi=1/ui²）</div>
                <textarea className="textarea" rows={4} value={weightsText} onChange={(e) => setWeightsText(e.target.value)} placeholder="1\n0.5\n0.25" />
              </div>
            )}
            {analysis && 'error' in analysis && (
              <div className="notice notice-danger" style={{ marginTop: 8 }}><span className="n-icon">✕</span><div className="n-body">{analysis.error}</div></div>
            )}
            {mode !== 'ols' && (
              <div className="notice notice-info" style={{ marginTop: 8 }}>
                <span className="n-icon">ℹ</span>
                <div className="n-body">加权拟合属于通用扩展，不冒充课程必需。</div>
              </div>
            )}
          </Panel>
          {series.length === 2 && (
            <Panel title="拟合图">
              <PhysicsPlot title={`数据与拟合（${mode === 'ols' ? 'y = a + bx' : mode === 'origin' ? 'y = bx' : '加权 y = a + bx'}）`} xLabel={xLabel} yLabel={yLabel} series={series} />
              <PlotChecklist title="拟合图" xLabel={xLabel} yLabel={yLabel} series={series} />
            </Panel>
          )}
        </div>
        <div className="stack">
          {resultItem ? <ResultCard item={resultItem} profileName={profile.shortName} /> : (
            <Panel title="拟合结果"><div className="empty-state"><div className="e-icon">📈</div><div>至少输入 3 对数据</div></div></Panel>
          )}
          {analysis && !('error' in analysis) && (
            <Panel title="残差图">
              <PhysicsPlot
                title="残差图"
                xLabel={xLabel}
                yLabel="残差 e"
                series={[{ name: '残差', points: analysis.xs.map((x, i) => ({ x, y: analysis.fit.residuals[i] })), type: 'scatter' }]}
                height={240}
                hideLegend
              />
            </Panel>
          )}
          <Panel title="课程公式视图">
            <Tex tex="S_b = |b|\sqrt{\dfrac{r^{-2}-1}{n-2}},\quad S_a = S_b\sqrt{\dfrac{\sum x_i^2}{n}},\quad \Delta = t_{0.95}(n{-}2)\,S" display />
            <div className="small muted">普通 OLS 结果中的 Sb 已与该公式交叉验证一致。</div>
          </Panel>
        </div>
      </div>
    </main>
  );
}

function axisLabel(base: 'x' | 'y', transform: string): string {
  const names: Record<string, string> = {
    identity: base === 'x' ? 'x' : 'y',
    ln: `ln ${base}`,
    log10: `log ${base}`,
    square: `${base}²`,
    reciprocal: `1/${base}`,
    sqrt: `√${base}`,
  };
  return names[transform] ?? base;
}
