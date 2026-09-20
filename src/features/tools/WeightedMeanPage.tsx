/** 加权平均页（plan §9.2） */
import { useMemo, useState } from 'react';
import { weightedMean, weightSum } from '../../core/statistics';
import { parseTSV } from '../../components/DataGrid';
import { parseNumericText } from '../../core/numeric';
import { useSettings } from '../../stores/settings';
import { Panel } from '../../components/ui';
import { makeResult } from '../../core/results';
import { ResultCard } from '../../components/ResultInspector';
import { PhysicsPlot } from '../../components/PhysicsPlot';
import { MarkdownInline } from '../../components/Markdown';

type Mode = 'inverse-square' | 'manual';

export function WeightedMeanPage() {
  const profile = useSettings((s) => s.activeProfile());
  const [mode, setMode] = useState<Mode>('inverse-square');
  const [text, setText] = useState('');

  const parsed = useMemo(() => {
    const rows = parseTSV(text);
    const items: { x: number; u?: number; w?: number }[] = [];
    for (const row of rows) {
      if (row.length === 0) continue;
      const px = parseNumericText(row[0]);
      if (!px.ok) continue;
      const item: { x: number; u?: number; w?: number } = { x: px.value };
      if (row.length >= 2) {
        const pu = parseNumericText(row[1]);
        if (pu.ok) {
          if (mode === 'inverse-square') {
            if (pu.value > 0) item.u = pu.value;
          } else {
            if (pu.value > 0) item.w = pu.value;
          }
        }
      }
      items.push(item);
    }
    return items;
  }, [text, mode]);

  const result = useMemo(() => {
    if (parsed.length === 0) return null;
    const valid = mode === 'inverse-square'
      ? parsed.filter((p) => p.u !== undefined)
      : parsed.filter((p) => p.w !== undefined);
    if (valid.length === 0) return { error: mode === 'inverse-square' ? '第二列应为 u（>0）' : '第二列应为权重 w（>0）' };
    const xs = valid.map((p) => p.x);
    const ws = mode === 'inverse-square'
      ? valid.map((p) => 1 / (p.u! * p.u!))
      : valid.map((p) => p.w!);
    const xw = weightedMean(xs, ws);
    const sw = weightSum(ws);
    const uw = mode === 'inverse-square' ? 1 / Math.sqrt(sw) : Math.sqrt(1 / sw); // 手动权重时 1/√Σw 仅当 w=1/u²
    return { xs, ws, xw, sw, uw, valid };
  }, [parsed, mode]);

  const resultItem = useMemo(() => {
    if (!result || 'error' in result) return null;
    const r = result;
    return makeResult({
      id: 'weighted-mean',
      title: mode === 'inverse-square' ? '加权平均（wi = 1/ui²，独立测量）' : '加权平均（手动权重）',
      symbol: '\\bar{x}_w',
      finalText: `${r.xw.toPrecision(8)} ± ${r.uw.toPrecision(4)}`,
      steps: [
        {
          formulaLatex: '\\bar{x}_w = \\frac{\\sum_i w_i x_i}{\\sum_i w_i}',
          substitution: `wi = ${mode === 'inverse-square' ? '1/ui²' : '手动输入'}，Σwi = ${r.sw.toPrecision(8)}`,
          unrounded: `x̄w = ${r.xw.toPrecision(12)}，u(x̄w) = ${r.uw.toPrecision(10)}`,
        },
      ],
      ruleNotes: [
        '加权平均属于通用扩展，不是上传课程讲义的必修公式',
        mode === 'inverse-square'
          ? 'u(x̄w) = 1/√Σwi 仅在各测量相互独立且 wi=1/ui² 时成立'
          : '手动权重模式下 u(x̄w)=1/√Σwi 仅当权重即 1/u² 时有意义',
      ],
      provenance: { status: 'general', note: '通用扩展（AGENTS §11）' },
    });
  }, [result, mode]);

  return (
    <main className="page">
      <h1><MarkdownInline>加权平均</MarkdownInline></h1>
      <p className="muted"><MarkdownInline>{`两列数据：\`x\` 与 \`u\`（或手动权重 \`w\`）。当前标准 **${profile.shortName}**（加权平均为通用扩展，与标准无关）`}</MarkdownInline></p>
      <div className="tool-layout">
        <div className="stack">
          <Panel title="数据">
            <div className="row" style={{ marginBottom: 8 }}>
              <select className="select" style={{ maxWidth: 260 }} value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
                <option value="inverse-square">独立测量：wi = 1/ui²</option>
                <option value="manual">手动权重 wi</option>
              </select>
            </div>
            <textarea
              className="textarea" rows={10} value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={mode === 'inverse-square' ? 'x\tu\n9.42\t0.05\n9.48\t0.03' : 'x\tw\n9.42\t2\n9.48\t1'}
            />
            <div className="field-help"><MarkdownInline>两列（Tab/逗号分隔），可从 Excel 粘贴</MarkdownInline></div>
          </Panel>
          {result && !('error' in result) && result.valid.length > 0 && (
            <Panel title="权重占比">
              <PhysicsPlot
                title="各测量权重占比"
                xLabel="测量序号"
                yLabel="权重 wi"
                hideLegend
                height={240}
                series={[{
                  name: '权重', type: 'scatter',
                  points: result.ws.map((w, i) => ({ x: i + 1, y: w })),
                }]}
              />
            </Panel>
          )}
        </div>
        <div className="stack">
          {result && 'error' in result ? (
            <div className="notice notice-danger"><div className="n-body"><MarkdownInline>{result.error}</MarkdownInline></div></div>
          ) : resultItem ? <ResultCard item={resultItem} profileName={profile.shortName} /> : (
            <Panel title="结果"><div className="empty-state"><div><MarkdownInline>输入数据后计算</MarkdownInline></div></div></Panel>
          )}
        </div>
      </div>
    </main>
  );
}
