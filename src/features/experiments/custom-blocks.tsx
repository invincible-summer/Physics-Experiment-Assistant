/**
 * 实验自定义块：受迫振动多系列图、热导准稳态诊断、迈克尔逊 checklist
 */
import { useMemo, useState } from 'react';
import { PhysicsPlot, PlotSeries } from '../../components/PhysicsPlot';
import { Panel } from '../../components/ui';
import { MICHELSON_CHECKLIST } from '../../experiments/tsinghua-a1-2026/michelson';
import { Tex } from '../../components/katex';

export function ForcedPlotsBlock({ series }: { series?: { name: string; points: { x: number; y: number }[]; phiPoints: { x: number; y: number }[] }[] }) {
  const data = series ?? [];
  if (data.length === 0) {
    return <Panel title="受迫振动特性图"><div className="empty-state"><div className="e-icon">📉</div><div>填写受迫数据并完成自由衰减部分后显示</div></div></Panel>;
  }
  const ampSeries: PlotSeries[] = data.map((s, i) => ({
    name: s.name, type: 'scatter' as const,
    points: s.points,
    color: undefined, symbol: (['circle', 'rect', 'triangle', 'diamond'] as const)[i % 4],
  }));
  const phiSeries: PlotSeries[] = data.map((s, i) => ({
    name: s.name, type: 'line' as const,
    points: s.phiPoints, showSymbol: true, dashed: i > 0,
    symbol: (['circle', 'rect', 'triangle', 'diamond'] as const)[i % 4],
  }));
  return (
    <div className="stack">
      <Panel title="幅频特性 θ–ω/ω0">
        <PhysicsPlot title="幅频特性" xLabel="ω/ω0" yLabel="θ" series={ampSeries} />
        <div className="small muted" style={{ marginTop: 6 }}>多系列用不同点符区分；共振点请结合 φ≈π/2 与振幅极大共同判断。</div>
      </Panel>
      <Panel title="相频特性 φ–ω/ω0">
        <PhysicsPlot title="相频特性" xLabel="ω/ω0" yLabel="φ (deg)" series={phiSeries} />
      </Panel>
    </div>
  );
}

export function QuasiDiagnosticsBlock({ data }: { data?: {
  u1Mean: number; u1Std: number; u1Slope: number; u1SlopeRel: number;
  u2Fit: { a: number; b: number; r: number; n: number }; rowsIn: number; rowsAll: number;
} }) {
  if (!data) return <Panel title="准稳态诊断"><div className="field-help">填写时序数据后显示</div></Panel>;
  const u1Flat = Math.abs(data.u1SlopeRel) < 0.05;
  const u2Linear = Math.abs(data.u2Fit.r) > 0.995;
  return (
    <Panel title="准稳态区间诊断（客观提示，区间由你确认）">
      <table className="contrib-table">
        <tbody>
          <tr><td>区间内行数</td><td className="num">{data.rowsIn} / {data.rowsAll}</td></tr>
          <tr><td>U1 均值（修正后）</td><td className="num">{data.u1Mean.toPrecision(8)} μV</td></tr>
          <tr><td>U1 标准差</td><td className="num">{Number.isFinite(data.u1Std) ? `${data.u1Std.toPrecision(6)} μV` : '—'}</td></tr>
          <tr><td>U1 时间斜率 / U2 斜率</td><td className="num">{data.u1SlopeRel.toPrecision(4)}（应 ≈0）</td></tr>
          <tr><td>U2–τ 线性拟合 r</td><td className="num">{data.u2Fit.r.toPrecision(6)}（应 ≈1）</td></tr>
        </tbody>
      </table>
      <div className={`notice ${u1Flat && u2Linear ? 'notice-success' : 'notice-warning'}`} style={{ marginTop: 8 }}>
        <span className="n-icon">{u1Flat && u2Linear ? '✓' : '⚠'}</span>
        <div className="n-body">
          {u1Flat && u2Linear
            ? 'U1 近似恒定且 U2 对时间近似线性：当前区间满足准稳态判据。'
            : '判据未全部满足：U1 应近似恒定、U2 应近似线性。请调整 τstart/τend（候选区间仅供参考，由你确认）。'}
        </div>
      </div>
    </Panel>
  );
}

export function MichelsonChecklistBlock() {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const done = useMemo(() => Object.values(checked).filter(Boolean).length, [checked]);
  return (
    <Panel title={`光路调节流程（${done}/${MICHELSON_CHECKLIST.length}）`}>
      <div className="stack">
        {MICHELSON_CHECKLIST.map((item) => (
          <label key={item.id} className="row" style={{ cursor: 'pointer', gap: 8 }}>
            <input
              type="checkbox"
              checked={checked[item.id] ?? false}
              onChange={(e) => setChecked((s) => ({ ...s, [item.id]: e.target.checked }))}
            />
            <span style={{ fontWeight: checked[item.id] ? 400 : 600, textDecoration: checked[item.id] ? 'line-through' : 'none' }}>
              {item.label}
            </span>
            <span className="small muted">{item.tip}</span>
          </label>
        ))}
      </div>
      <div className="small muted" style={{ marginTop: 8 }}>勾选状态仅存于当前会话，不写入项目数据。</div>
      <div className="notice notice-warning" style={{ marginTop: 8 }}>
        <span className="n-icon">⚠</span>
        <div className="n-body">安全要点：<Tex tex="\lambda = 2\Delta d/\Delta k" /> 等计算见后续步骤；激光高压、钠灯高温、光学面与磁座操作安全提示常驻页面顶部。</div>
      </div>
    </Panel>
  );
}
