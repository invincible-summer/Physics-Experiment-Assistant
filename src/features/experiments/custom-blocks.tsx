/**
 * 实验自定义块：受迫振动多系列图、热导准稳态诊断、迈克尔逊 checklist
 */
import { useMemo, useState } from 'react';
import { PhysicsPlot, PlotSeries } from '../../components/PhysicsPlot';
import { EmptyState, Notice, Panel } from '../../components/ui';
import { MICHELSON_CHECKLIST } from '../../experiments/tsinghua-a1-2026/michelson';
import { MarkdownInline } from '../../components/Markdown';

const SERIES_SYMBOLS = ['circle', 'rect', 'triangle', 'diamond'] as const;

export interface ForcedSeriesEntry {
  name: string;
  points: { x: number; y: number }[];
  phiPoints: { x: number; y: number }[];
}

export function ForcedPlotsBlock({ series }: { series?: ForcedSeriesEntry[] }) {
  const data = series ?? [];
  if (data.length === 0) {
    return (
      <Panel title="受迫振动特性图">
        <EmptyState title="暂无可绘制的数据" hint="填写受迫数据并完成自由衰减部分后显示。" />
      </Panel>
    );
  }
  const ampSeries: PlotSeries[] = data.map((s, i) => ({
    name: s.name, type: 'scatter' as const,
    points: s.points,
    symbol: SERIES_SYMBOLS[i % SERIES_SYMBOLS.length],
  }));
  const phiSeries: PlotSeries[] = data.map((s, i) => ({
    name: s.name, type: 'line' as const,
    points: s.phiPoints, showSymbol: true, dashed: i > 0,
    symbol: SERIES_SYMBOLS[i % SERIES_SYMBOLS.length],
  }));
  return (
    <div className="stack">
      <Panel title={'幅频特性 $\\theta$–$\\omega/\\omega_0$'}>
        <PhysicsPlot title="幅频特性" xLabel="ω/ω0" yLabel="θ" series={ampSeries} />
        <div className="small muted" style={{ marginTop: 6 }}><MarkdownInline>多系列用不同点符区分；共振点请结合 $\varphi\approx\pi/2$ 与振幅极大共同判断。</MarkdownInline></div>
      </Panel>
      <Panel title={'相频特性 $\\varphi$–$\\omega/\\omega_0$'}>
        <PhysicsPlot title="相频特性" xLabel="ω/ω0" yLabel="φ (deg)" series={phiSeries} />
      </Panel>
    </div>
  );
}

export interface QuasiDiagnosticsData {
  u1Mean: number; u1Std: number; u1Slope: number; u1SlopeRel: number;
  u2Fit: { a: number; b: number; r: number; n: number }; rowsIn: number; rowsAll: number;
}

export function QuasiDiagnosticsBlock({ data }: { data?: QuasiDiagnosticsData }) {
  if (!data) {
    return (
      <Panel title="准稳态诊断">
        <EmptyState title="暂无诊断数据" hint="填写时序数据后显示。" />
      </Panel>
    );
  }
  const u1Flat = Math.abs(data.u1SlopeRel) < 0.05;
  const u2Linear = Math.abs(data.u2Fit.r) > 0.995;
  const ok = u1Flat && u2Linear;
  return (
    <Panel title="准稳态区间诊断（客观提示，区间由你确认）">
      <table className="stat-table">
        <tbody>
          <tr>
            <th><MarkdownInline>区间内行数</MarkdownInline></th>
            <td className="num">{`${data.rowsIn} / ${data.rowsAll}`}</td>
          </tr>
          <tr>
            <th><MarkdownInline>$U_1$ 均值（修正后）</MarkdownInline></th>
            <td className="num"><MarkdownInline>{`${data.u1Mean.toPrecision(8)} $\\mu\\mathrm{V}$`}</MarkdownInline></td>
          </tr>
          <tr>
            <th><MarkdownInline>$U_1$ 标准差</MarkdownInline></th>
            <td className="num"><MarkdownInline>{Number.isFinite(data.u1Std) ? `${data.u1Std.toPrecision(6)} $\\mu\\mathrm{V}$` : '—'}</MarkdownInline></td>
          </tr>
          <tr>
            <th><MarkdownInline>$U_1$ 时间斜率 / $U_2$ 斜率</MarkdownInline></th>
            <td className="num"><MarkdownInline>{`${data.u1SlopeRel.toPrecision(4)}（应 $\\approx 0$）`}</MarkdownInline></td>
          </tr>
          <tr>
            <th><MarkdownInline>$U_2$–$\\tau$ 线性拟合 $r$</MarkdownInline></th>
            <td className="num"><MarkdownInline>{`${data.u2Fit.r.toPrecision(6)}（应 $\\approx 1$）`}</MarkdownInline></td>
          </tr>
        </tbody>
      </table>
      <div style={{ marginTop: 8 }}>
        <Notice variant={ok ? 'success' : 'warning'} title={ok ? '区间判据满足' : '判据未全部满足'}>
          <MarkdownInline>{ok
            ? '$U_1$ 近似恒定且 $U_2$ 对时间近似线性：当前区间满足准稳态判据。'
            : '$U_1$ 应近似恒定、$U_2$ 应近似线性。请调整 `τstart` / `τend`（候选区间仅供参考，由你确认）。'}</MarkdownInline>
        </Notice>
      </div>
    </Panel>
  );
}

export function MichelsonChecklistBlock() {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const done = useMemo(() => Object.values(checked).filter(Boolean).length, [checked]);
  return (
    <Panel title={`光路调节流程（${done}/${MICHELSON_CHECKLIST.length}）`}>
      <div className="check-list">
        {MICHELSON_CHECKLIST.map((item) => {
          const on = checked[item.id] ?? false;
          return (
            <label key={item.id} className={`check-item${on ? ' checked' : ''}`}>
              <input
                type="checkbox"
                checked={on}
                onChange={(e) => setChecked((s) => ({ ...s, [item.id]: e.target.checked }))}
              />
              <span style={{ flex: 1, minWidth: 0 }}>
                <MarkdownInline>{on ? `~~${item.label}~~` : item.label}</MarkdownInline>
                <div className="small muted"><MarkdownInline>{item.tip}</MarkdownInline></div>
              </span>
            </label>
          );
        })}
      </div>
      <div className="small muted" style={{ marginTop: 8 }}><MarkdownInline>勾选状态仅存于当前会话，不写入项目数据。</MarkdownInline></div>
      <div style={{ marginTop: 8 }}>
        <Notice variant="warning" title="安全要点">
          <MarkdownInline>$\lambda = 2\Delta d/\Delta k$ 等计算见后续步骤；激光高压、钠灯高温、光学面与磁座操作安全提示常驻页面顶部。</MarkdownInline>
        </Notice>
      </div>
    </Panel>
  );
}
