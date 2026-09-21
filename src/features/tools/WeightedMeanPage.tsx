/** 加权平均页（plan §9.2）：DataGrid 双列录入（x 与 u 或 w），通用扩展属性显著标注 */
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { weightedMean, weightSum } from '../../core/statistics';
import { parseNumericText } from '../../core/numeric';
import { formatMeasurement } from '../../core/sigfig';
import { useSettings } from '../../stores/settings';
import { EmptyState, Menu, Notice, Panel, Tabs, toast } from '../../components/ui';
import { makeResult } from '../../core/results';
import { ResultCard } from '../../components/ResultInspector';
import { PhysicsPlot } from '../../components/PhysicsPlot';
import { MarkdownBlock, MarkdownInline } from '../../components/Markdown';
import { DataGrid } from '../../components/DataGrid';
import { useToolDraft } from './use-tool-draft';
import { PayloadBanner } from './PayloadBanner';
import { useToolBus } from './tool-bus';
import { fmtDisplay } from './fmt';

type Mode = 'inverse-square' | 'manual';

interface WmDraft {
  rows: string[][];
  mode: Mode;
}

const INITIAL_DRAFT: WmDraft = {
  rows: Array.from({ length: 6 }, () => ['', '']),
  mode: 'inverse-square',
};

export function WeightedMeanPage() {
  const profile = useSettings((s) => s.activeProfile());
  const navigate = useNavigate();
  const send = useToolBus((s) => s.send);
  const [draft, setDraft] = useToolDraft<WmDraft>('weighted-mean', INITIAL_DRAFT);
  const { rows, mode } = draft;
  const patch = (p: Partial<WmDraft>) => setDraft((d) => ({ ...d, ...p }));

  /** 逐行解析：第一列 x 必填，第二列 u/w 必须为正数才纳入 */
  const parsed = useMemo(() => {
    const items: { x: number; u?: number; w?: number }[] = [];
    for (const row of rows) {
      const rx = (row[0] ?? '').trim();
      const rr = (row[1] ?? '').trim();
      if (rx === '' && rr === '') continue;
      const px = parseNumericText(rx);
      if (!px.ok) continue;
      const item: { x: number; u?: number; w?: number } = { x: px.value };
      const pr = parseNumericText(rr);
      if (rr !== '' && pr.ok && pr.value > 0) {
        if (mode === 'inverse-square') item.u = pr.value;
        else item.w = pr.value;
      }
      items.push(item);
    }
    return items;
  }, [rows, mode]);

  const result = useMemo(() => {
    if (parsed.length === 0) return null;
    const valid = mode === 'inverse-square'
      ? parsed.filter((p) => p.u !== undefined)
      : parsed.filter((p) => p.w !== undefined);
    if (valid.length === 0) {
      return { error: mode === 'inverse-square' ? '第二列应为不确定度 $u$（>0）' : '第二列应为权重 $w$（>0）' };
    }
    const xs = valid.map((p) => p.x);
    const ws = mode === 'inverse-square'
      ? valid.map((p) => 1 / (p.u! * p.u!))
      : valid.map((p) => p.w!);
    const xw = weightedMean(xs, ws);
    const sw = weightSum(ws);
    // 仅 wi=1/ui²（独立测量）时 u(x̄w)=1/√Σwi 才有意义；手动权重不给不确定度（AGENTS §11）
    const uw = mode === 'inverse-square' ? 1 / Math.sqrt(sw) : null;
    return { xs, ws, xw, sw, uw, valid, dropped: parsed.length - valid.length };
  }, [parsed, mode]);

  const resultItem = useMemo(() => {
    if (!result || 'error' in result) return null;
    const r = result;
    const warnings: string[] = [];
    if (r.dropped > 0) {
      warnings.push(`**${r.dropped}** 行因第二列缺失或不是正数而未参与加权`);
    }
    const formatted = r.uw !== null ? formatMeasurement(r.xw, r.uw, profile.sigfig) : null;
    return makeResult({
      id: 'weighted-mean',
      title: mode === 'inverse-square' ? '加权平均（wi = 1/ui²，独立测量）' : '加权平均（手动权重）',
      symbol: '\\bar{x}_w',
      finalText: formatted ? formatted.text : fmtDisplay(r.xw, 8),
      relativeText: formatted ? formatted.relativePercent : undefined,
      steps: [
        {
          formulaLatex: '\\bar{x}_w = \\frac{\\sum_i w_i x_i}{\\sum_i w_i}',
          substitution: `wi = ${mode === 'inverse-square' ? '1/ui²' : '手动输入'}，Σwi = ${r.sw.toPrecision(8)}`,
          unrounded: `x̄w = ${r.xw.toPrecision(12)}`,
        },
        ...(r.uw !== null
          ? [{
              formulaLatex: 'u(\\bar{x}_w) = \\frac{1}{\\sqrt{\\sum_i w_i}}',
              substitution: `Σwi = ${r.sw.toPrecision(8)}`,
              unrounded: `u(x̄w) = ${r.uw.toPrecision(10)}`,
            }]
          : []),
      ],
      roundingNote: formatted?.roundingNote,
      ruleNotes: [
        '加权平均属于通用扩展，不是上传课程讲义的必修公式',
        mode === 'inverse-square'
          ? 'u(x̄w) = 1/√Σwi 仅在各测量相互独立且 wi=1/ui² 时成立'
          : '手动权重模式只给出加权平均值；权重与 1/u² 的对应关系未知，不给出 u(x̄w)，避免误导',
      ],
      warnings,
      provenance: { status: 'general', note: '通用扩展（AGENTS §11）' },
    });
  }, [result, mode, profile]);

  return (
    <div className="stack-lg">
      <header className="page-head">
        <h1 className="page-title"><MarkdownInline>加权平均</MarkdownInline></h1>
        <p className="page-lead">
          <MarkdownInline>{'两列数据：$x$ 与不确定度 $u$（或手动权重 $w$），计算加权平均'}</MarkdownInline>
        </p>
      </header>

      <Notice variant="info">
        <MarkdownBlock>{'加权平均是**通用扩展**（AGENTS §11），不是上传课程讲义的必修公式，结果与当前标准配置（' + `**${profile.shortName}**` + '）无关。'}</MarkdownBlock>
      </Notice>

      <PayloadBanner
        accept="table"
        onAccept={(p) => {
          if (p.kind !== 'table') return;
          patch({ rows: p.rows.map((r) => [r[0] ?? '', r[1] ?? '']) });
          toast(p.headers.length >= 2 ? '已填入两列作为 x 与 u/w' : '已填入单列作为 x，请补第二列 u/w');
        }}
      />

      <div className="tool-layout">
        <div className="stack">
          <Panel title="数据输入">
            <div className="stack">
              <Tabs
                ariaLabel="权重模式"
                tabs={[
                  { id: 'inverse-square', label: '$w_i=1/u_i^2$（独立测量）' },
                  { id: 'manual', label: '手动权重 $w_i$' },
                ]}
                active={mode}
                onChange={(id) => patch({ mode: id as Mode })}
              />
              <DataGrid
                columns={[
                  { id: 'x', header: '$x_i$' },
                  { id: 'u', header: mode === 'inverse-square' ? '$u_i$' : '$w_i$' },
                ]}
                rows={rows}
                onChange={(next) => patch({ rows: next })}
                defaultRows={6}
                hint={mode === 'inverse-square' ? '第二列填各测量的标准不确定度 $u_i$（>0）' : '第二列填手动权重 $w_i$（>0），只给出加权平均值'}
              />
            </div>
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
            <Notice variant="danger"><MarkdownInline>{result.error}</MarkdownInline></Notice>
          ) : resultItem ? (
            <Panel
              title="结果"
              actions={result && !('error' in result) && result.uw !== null ? (
                <Menu
                  trigger="发送到…"
                  items={[{ id: 'unc', label: '加权均值 → 不确定度传播', icon: 'ruler' }]}
                  onSelect={() => {
                    if (!result || 'error' in result) return;
                    send({
                      kind: 'scalar',
                      source: '加权平均',
                      name: 'xw',
                      valueText: String(result.xw),
                      uncText: result.uw !== null ? String(result.uw) : undefined,
                      createdAt: new Date().toISOString(),
                    });
                    toast('已送出 x̄w，在不确定度传播页确认填入');
                    navigate('/tools/uncertainty');
                  }}
                />
              ) : undefined}
            >
              <ResultCard item={resultItem} profileName={profile.shortName} />
            </Panel>
          ) : (
            <Panel title="结果"><EmptyState icon="target" title="等待数据" hint="输入两列数据后自动计算" /></Panel>
          )}
        </div>
      </div>
    </div>
  );
}
