/** 实验：阻尼振动和受迫振动（plan §10.4） */
import { ExperimentDefinition, ExperimentState, ExperimentComputation, ComputedFit } from '../types';
import { parseTable, runFit, parseParams } from '../engine';
import { makeResult } from '../../core/results';
import { mean, sampleStd, tQuantile } from '../../core/statistics';
import { formatMeasurement } from '../../core/sigfig';
import { StandardProfile } from '../../standards/types';
import { dampingTimerError } from '../../instruments';

const DOC = '2026秋物理实验A(1)教学资料';

export const DampingExperiment: ExperimentDefinition = {
  id: 'damping',
  version: 1,
  title: '阻尼振动和受迫振动',
  subtitle: 'lnθ–j 拟合 → ζ/ω0/τ/Q；幅频/相频特性',
  category: '力学',
  tags: ['时序', '线性拟合', '完整报告'],
  reportType: 'full',
  safety: ['波尔共振仪摆轮摆动范围内勿放置物品', '阻尼电机启动前确认摆轮自由'],
  provenance: { status: 'source-explicit', document: DOC, section: '实验四 阻尼振动和受迫振动' },
  metadataFields: [
    { id: 'name', label: '姓名', kind: 'text' },
    { id: 'studentId', label: '学号', kind: 'text' },
    { id: 'date', label: '实验日期', kind: 'text' },
    { id: 'dampingLevel', label: '自由衰减测量所用阻尼档位', kind: 'text' },
  ],
  params: [
    { id: 'settleTau', label: '稳定时间工具：时间常数 τ（可留空自动用拟合值）', unit: 's', defaultText: '' },
  ],
  datasets: [
    {
      id: 'amplitude',
      title: '自由衰减振幅序列',
      hint: 'j 为振幅序号（1,2,…），θj 为对应振幅（格或长度单位，同列即可）；ln θj 自动派生。',
      defaultRows: 12,
      columns: [
        { id: 'j', header: 'j' },
        { id: 'theta', header: 'θj' },
        { id: 'lntheta', header: 'ln θj', kind: 'derived', expression: 'ln(theta)', formulaLatex: '\\ln\\theta_j = a + b\\,j' },
      ],
    },
    {
      id: 'period',
      title: '阻尼振动周期计时（多次）',
      hint: 'T 为周期计时读数（s）。计时器误差限 Δ仪=读数×10⁻⁵+0.001 s 自动应用。',
      defaultRows: 6,
      columns: [
        { id: 'T', header: 'T', unit: 's' },
      ],
    },
    {
      id: 'forced1',
      title: '受迫振动数据（阻尼档位 1）',
      hint: 'T 为受迫周期（s），θ 为稳态振幅，φ 为相位差（deg）。',
      defaultRows: 10,
      columns: [
        { id: 'T', header: 'T', unit: 's' },
        { id: 'theta', header: 'θ' },
        { id: 'phi', header: 'φ', unit: 'deg' },
        { id: 'w', header: 'ω', unit: 'rad/s', kind: 'derived', expression: '2 * pi / T' },
        { id: 'wr', header: 'ω/ω0', kind: 'derived', expression: '2 * pi / T / w0', formulaLatex: '\\omega/\\omega_0' },
      ],
    },
    {
      id: 'forced2',
      title: '受迫振动数据（阻尼档位 2，选填）',
      hint: '同上；留空则该档位不参与绘图。',
      defaultRows: 8,
      columns: [
        { id: 'T', header: 'T', unit: 's' },
        { id: 'theta', header: 'θ' },
        { id: 'phi', header: 'φ', unit: 'deg' },
        { id: 'w', header: 'ω', unit: 'rad/s', kind: 'derived', expression: '2 * pi / T' },
        { id: 'wr', header: 'ω/ω0', kind: 'derived', expression: '2 * pi / T / w0' },
      ],
    },
  ],
  fits: [
    { id: 'ln-fit', title: 'ln θj–j 线性拟合', tableId: 'amplitude', xCol: 'j', yCol: 'lntheta', mode: 'ols', modelLatex: '\\ln\\theta_j = a + b\\,j' },
  ],
  plots: [
    { id: 'ln-plot', title: 'ln θj–j 衰减直线', tableId: 'amplitude', xCol: 'j', yCol: 'lntheta', xLabel: 'j', yLabel: 'ln θj', fitId: 'ln-fit', fitLabel: 'y = a + bj' },
  ],
  steps: [
    {
      id: 'free-amp', title: '自由衰减振幅',
      blocks: [
        { type: 'safety', items: ['摆轮起振前确认无障碍物'] },
        { type: 'table', tableId: 'amplitude' },
        { type: 'fits', fitIds: ['ln-fit'] },
        { type: 'plot', plotId: 'ln-plot' },
      ],
    },
    {
      id: 'period', title: '阻尼周期计时',
      blocks: [
        { type: 'table', tableId: 'period' },
        { type: 'results', resultIds: ['Td'] },
      ],
    },
    {
      id: 'damping-params', title: '阻尼参数',
      blocks: [
        { type: 'results', resultIds: ['zeta', 'w0', 'tau-Q'] },
      ],
    },
    {
      id: 'forced', title: '受迫振动特性',
      blocks: [
        { type: 'table', tableId: 'forced1' },
        { type: 'table', tableId: 'forced2' },
        { type: 'custom', component: 'forced-plots' },
        { type: 'results', resultIds: ['forced-diag'] },
      ],
    },
    {
      id: 'settle', title: '稳定时间工具',
      blocks: [
        { type: 'params', fields: ['settleTau'] },
        { type: 'results', resultIds: ['settle-time'] },
      ],
    },
  ],
  compute: (state: ExperimentState, profile: StandardProfile): ExperimentComputation => {
    const results = [];
    const fits: Record<string, ComputedFit> = {};
    const diagnostics: string[] = [];
    const custom: Record<string, unknown> = {};
    const { scope } = parseParams([{ id: 'settleTau' }], state.params);

    // --- lnθ–j 拟合 ---
    const amp = parseTable(DampingExperiment.datasets[0], state, {});
    const fitRes = runFit(DampingExperiment.fits[0], amp);
    let zeta = NaN;
    let dzeta = NaN;
    let bSlope = NaN;
    if ('ols' in fitRes && fitRes.ols) {
      fits['ln-fit'] = fitRes;
      const f = fitRes.ols;
      bSlope = f.b;
      // ζ = (−b)/√(4π²+b²)
      zeta = -bSlope / Math.sqrt(4 * Math.PI ** 2 + bSlope ** 2);
      // dζ/db = 4π²·? 推导：ζ = -b(4π²+b²)^{-1/2}；dζ/db = -(4π²+b²)^{-1/2} + b²(4π²+b²)^{-3/2} = -4π²/(4π²+b²)^{3/2}
      const dzdb = (4 * Math.PI ** 2) / Math.pow(4 * Math.PI ** 2 + bSlope ** 2, 1.5);
      dzeta = Math.abs(dzdb) * f.deltaB;
      if (bSlope >= 0) diagnostics.push('lnθ–j 拟合斜率 b 应为负（振幅衰减）；请检查数据列 j/θj 是否填反');
      results.push(makeResult({
        id: 'zeta',
        title: '阻尼比 ζ（由拟合斜率）',
        symbol: '\\zeta',
        finalText: formatMeasurement(zeta, dzeta, profile.sigfig).text,
        steps: [
          {
            formulaLatex: 'b = -\\beta T_d = -\\frac{2\\pi\\zeta}{\\sqrt{1-\\zeta^2}} \\;\\Rightarrow\\; \\zeta = \\frac{-b}{\\sqrt{4\\pi^2 + b^2}}',
            substitution: `b=${bSlope.toPrecision(8)}，Δb=t·Sb=${f.deltaB.toPrecision(8)}（t=${f.t.toPrecision(6)}，ν=${f.dof}=n−2）`,
            unrounded: `ζ = ${zeta.toPrecision(12)}`,
          },
          {
            formulaLatex: '\\Delta\\zeta = \\left|\\frac{4\\pi^2}{(4\\pi^2+b^2)^{3/2}}\\right|\\Delta b',
            substitution: `Δζ = ${dzeta.toPrecision(10)}`,
          },
        ],
        provenance: { status: 'source-explicit', document: DOC },
      }));
    }

    // --- 周期 ---
    const per = parseTable(DampingExperiment.datasets[1], state, {});
    const tValues = per.rows.map((r) => r.T).filter(Number.isFinite);
    let Td = NaN;
    let dTd = NaN;
    if (tValues.length >= 1) {
      if (tValues.length >= 2) {
        Td = mean(tValues);
        const n = tValues.length;
        const t = tQuantile(n - 1, profile.confidence ?? 0.95);
        const dA = t * sampleStd(tValues) / Math.sqrt(n);
        const dB = dampingTimerError(Td);
        dTd = Math.sqrt(dA ** 2 + dB ** 2);
        results.push(makeResult({
          id: 'Td',
          title: '阻尼振动周期 Td',
          symbol: 'T_d',
          unit: 's',
          finalText: formatMeasurement(Td, dTd, profile.sigfig).text,
          steps: [
            {
              formulaLatex: 'T_d = 2\\pi/\\omega_d',
              substitution: `${n} 次计时平均，t=${t.toPrecision(6)}（ν=${n - 1}）`,
              unrounded: `Td = ${Td.toPrecision(12)} s，ΔA=${dA.toPrecision(6)}，Δ仪=读数×10⁻⁵+0.001=${dB.toPrecision(6)} s`,
            },
          ],
          provenance: { status: 'source-explicit', document: DOC },
        }));
      } else {
        Td = tValues[0];
        dTd = dampingTimerError(Td);
        results.push(makeResult({
          id: 'Td',
          title: '阻尼振动周期 Td（单次）',
          symbol: 'T_d',
          unit: 's',
          finalText: formatMeasurement(Td, dTd, profile.sigfig).text,
          steps: [{ formulaLatex: 'T_d', substitution: `单次计时，Δ=Δ仪=${dTd.toPrecision(6)} s` }],
          provenance: { status: 'source-explicit', document: DOC },
        }));
      }
    }

    // --- ω0/τ/Q ---
    if (Number.isFinite(zeta) && Number.isFinite(Td) && zeta > 0 && zeta < 1) {
      const w0 = (2 * Math.PI) / (Td * Math.sqrt(1 - zeta * zeta));
      // ω0 = 2π/(Td√(1−ζ²))；相对传播
      const rel = Math.sqrt((dTd / Td) ** 2 + (zeta * dzeta / (1 - zeta * zeta)) ** 2);
      const dw0 = rel * w0;
      const tau = 1 / (zeta * w0);
      const dtau = tau * Math.sqrt((dzeta / zeta) ** 2 + (dw0 / w0) ** 2);
      const Q = 1 / (2 * zeta);
      const dQ = Q * dzeta / zeta;
      results.push(makeResult({
        id: 'w0',
        title: '固有角频率 ω0',
        symbol: '\\omega_0',
        unit: 'rad/s',
        finalText: formatMeasurement(w0, dw0, profile.sigfig).text,
        steps: [
          {
            formulaLatex: '\\omega_0 = \\frac{2\\pi}{T_d\\sqrt{1-\\zeta^2}}',
            substitution: `Td=${Td.toPrecision(8)} s，ζ=${zeta.toPrecision(8)}`,
            unrounded: `ω0 = ${w0.toPrecision(12)} rad/s`,
          },
        ],
        provenance: { status: 'source-explicit', document: DOC },
      }));
      results.push(makeResult({
        id: 'tau-Q',
        title: '时间常数 τ 与品质因数 Q',
        finalText: `τ = ${formatMeasurement(tau, dtau, profile.sigfig).text} s；Q = ${formatMeasurement(Q, dQ, profile.sigfig).text}`,
        steps: [
          {
            formulaLatex: '\\tau = \\frac{1}{\\zeta\\omega_0},\\quad Q = \\frac{1}{2\\zeta}',
            substitution: `ζ=${zeta.toPrecision(8)}，ω0=${w0.toPrecision(8)} rad/s`,
            unrounded: `τ = ${tau.toPrecision(12)} s，Q = ${Q.toPrecision(10)}`,
          },
        ],
        provenance: { status: 'source-explicit', document: DOC },
      }));

      // 受迫表派生需要 w0
      const mkForced = (idx: number) => parseTable(DampingExperiment.datasets[idx], state, { w0 });
      const f1 = mkForced(2);
      const f2 = mkForced(3);
      custom['forced-series'] = [f1, f2].map((tbl, i) => ({
        name: `阻尼档位 ${i + 1}`,
        points: tbl.rows.filter((r) => Number.isFinite(r.wr) && Number.isFinite(r.theta)).map((r) => ({ x: r.wr, y: r.theta })),
        phiPoints: tbl.rows.filter((r) => Number.isFinite(r.wr) && Number.isFinite(r.phi)).map((r) => ({ x: r.wr, y: r.phi })),
      })).filter((s) => s.points.length > 0);

      const nearRes = f1.rows.filter((r) => Number.isFinite(r.phi) && Math.abs(Math.abs(r.phi) - 90) < 5);
      results.push(makeResult({
        id: 'forced-diag',
        title: '受迫振动诊断',
        finalText: '',
        steps: [{
          formulaLatex: '\\varphi(\\omega_r) \\approx \\pi/2',
          substitution: `档位1数据 ${f1.rows.length} 点，其中 |φ|∈[85°,95°] 的点 ${nearRes.length} 个`,
          note: nearRes.length > 0
            ? '存在 φ≈π/2 的数据点，可结合振幅极大共同判断共振点（最终判断请由实验者完成）'
            : '未发现 φ≈π/2 的点，可在共振区附近加密测量',
        }],
        provenance: { status: 'source-explicit', document: DOC },
      }));

      // 稳定时间
      const tauUsed = scope.settleTau !== undefined && Number.isFinite(scope.settleTau) ? scope.settleTau : tau;
      results.push(makeResult({
        id: 'settle-time',
        title: '稳定时间（e^(−t/τ)<0.01）',
        finalText: `t > 4.60517 τ = ${(4.60517 * tauUsed).toPrecision(8)} s`,
        steps: [{
          formulaLatex: 'e^{-t/\\tau} < 0.01 \\;\\Rightarrow\\; t > \\ln 100 \\cdot \\tau = 4.60517\\,\\tau',
          substitution: `τ=${tauUsed.toPrecision(8)} s（${scope.settleTau !== undefined ? '用户输入' : '拟合值'}）`,
        }],
        provenance: { status: 'source-explicit', document: DOC },
      }));
    } else if (Number.isFinite(zeta)) {
      diagnostics.push('需要有效周期 Td 且 0<ζ<1 才能计算 ω0/τ/Q');
    }

    return { results, fits, custom, diagnostics };
  },
};
