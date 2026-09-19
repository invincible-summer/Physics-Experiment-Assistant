/** 实验：准稳态法测不良导体导热系数和比热（plan §10.3） */
import { ExperimentDefinition, ExperimentState, ExperimentComputation, ComputedFit } from '../types';
import { parseTable, parseParams } from '../engine';
import { makeResult, ResultItem } from '../../core/results';
import { mean, sampleStd, correlation } from '../../core/statistics';
import { ols as olsFn } from '../../core/regression';
import { formatMeasurement } from '../../core/sigfig';
import { StandardProfile } from '../../standards/types';
import { THERMOCOUPLE_SENSITIVITY } from '../../instruments';

const DOC = '2026秋物理实验A(1)教学资料';

export const ThermalExperiment: ExperimentDefinition = {
  id: 'thermal',
  version: 1,
  title: '准稳态法测不良导体导热系数和比热',
  subtitle: '热电偶测温 · 准稳态区间选择 · λ 与 c',
  category: '热学',
  tags: ['时序区间', '系统误差修正', '线性拟合'],
  reportType: 'minimal',
  safety: ['加热电压不得超过规定值，防止加热器过热', '实验结束后先断加热电源再拆线', '样品高温面勿徒手触摸'],
  provenance: { status: 'source-explicit', document: DOC, section: '实验三 准稳态法测不良导体导热系数和比热' },
  metadataFields: [
    { id: 'name', label: '姓名', kind: 'text' },
    { id: 'studentId', label: '学号', kind: 'text' },
    { id: 'date', label: '实验日期', kind: 'text' },
  ],
  params: [
    { id: 'R', label: '样品半厚度 R', unit: 'mm', defaultText: '25.0' },
    { id: 'F', label: '样品横截面积 F', unit: 'cm²', defaultText: '', hint: '按直径计算 πD²/4' },
    { id: 'rho', label: '密度 ρ（讲义：有机玻璃 1196）', unit: 'kg/m³', defaultText: '1196' },
    { id: 'r', label: '加热器电阻 r', unit: 'Ω', defaultText: '' },
    { id: 'Ubefore', label: '加热前电压 U前', unit: 'V', defaultText: '' },
    { id: 'Uafter', label: '加热后电压 U后', unit: 'V', defaultText: '' },
    { id: 'tauStart', label: '准稳态区间起点 τstart', unit: 's', defaultText: '' },
    { id: 'tauEnd', label: '准稳态区间终点 τend', unit: 's', defaultText: '' },
    { id: 'power85', label: '85% 电功率修正（0=关闭 1=启用）', unit: '', defaultText: '0' },
  ],
  datasets: [
    {
      id: 'series',
      title: '时序数据表',
      hint: 'τ 用 s；U1、U2 用 μV。U1=(t2−t1) 面间热电势，U2=(t1−tc) 对冷端热电势。首行 U1 非零将作为已定系统误差修正基准。',
      defaultRows: 15,
      columns: [
        { id: 'tau', header: 'τ', unit: 's' },
        { id: 'U1', header: 'U1 (t2−t1)', unit: 'μV' },
        { id: 'U2', header: 'U2 (t1−tc)', unit: 'μV' },
        { id: 'U1c', header: 'U1 修正后', unit: 'μV', kind: 'derived', expression: 'U1 - U1_0', formulaLatex: 'U_1^{corr} = U_1 - U_1(\\tau_0)' },
        { id: 'dt', header: 'Δt=U1c/S', unit: '℃', kind: 'derived', expression: '(U1 - U1_0) / 40', formulaLatex: '\\Delta t = U_1^{corr}/S,\\; S=40\\,\\mu\\mathrm{V}/\\mathrm{\\degree C}' },
      ],
    },
  ],
  fits: [
    { id: 'u2-fit', title: '区间内 U2–τ 线性拟合', tableId: 'series', xCol: 'tau', yCol: 'U2', mode: 'ols', modelLatex: 'U_2 = a + b\\tau' },
  ],
  plots: [
    { id: 'u1-plot', title: 'U1–τ（准稳态检验）', tableId: 'series', xCol: 'tau', yCol: 'U1c', xLabel: 'τ (s)', yLabel: 'U1 修正后 (μV)' },
    { id: 'u2-plot', title: 'U2–τ 与线性段拟合', tableId: 'series', xCol: 'tau', yCol: 'U2', xLabel: 'τ (s)', yLabel: 'U2 (μV)', fitId: 'u2-fit', fitLabel: '线性段' },
  ],
  steps: [
    {
      id: 'params', title: '样品与加热参数',
      blocks: [
        { type: 'safety', items: ['加热电压不得超规定值', '断电后再拆线'] },
        { type: 'params', fields: ['R', 'F', 'rho', 'r', 'Ubefore', 'Uafter'], title: '参数（内部换算 SI）' },
      ],
    },
    {
      id: 'data', title: '时序数据',
      blocks: [
        { type: 'table', tableId: 'series' },
        { type: 'note', text: '热电偶灵敏度 40 μV/℃ 自动换算。首行 U1 非零 → 已定系统误差修正（U1c = U1 − U1(τ0)）。' },
      ],
    },
    {
      id: 'select', title: '准稳态区间选择',
      blocks: [
        { type: 'params', fields: ['tauStart', 'tauEnd'], title: '区间 [τstart, τend]（由你确认，不自动决定）' },
        { type: 'custom', component: 'quasi-diagnostics' },
        { type: 'plot', plotId: 'u1-plot' },
        { type: 'plot', plotId: 'u2-plot' },
      ],
    },
    {
      id: 'result', title: 'λ 与 c',
      blocks: [
        { type: 'params', fields: ['power85'] },
        { type: 'results', resultIds: ['qc', 'lambda', 'specific-heat', 'lambda85'] },
      ],
    },
  ],
  compute: (state: ExperimentState, profile: StandardProfile): ExperimentComputation => {
    const results: ResultItem[] = [];
    const fits: Record<string, ComputedFit> = {};
    const diagnostics: string[] = [];
    const custom: Record<string, unknown> = {};
    const { scope, missing } = parseParams(
      [{ id: 'R' }, { id: 'F' }, { id: 'rho' }, { id: 'r' }, { id: 'Ubefore' }, { id: 'Uafter' }, { id: 'tauStart' }, { id: 'tauEnd' }, { id: 'power85' }],
      state.params,
    );
    const Rm = (scope.R ?? NaN) * 1e-3; // mm→m
    const Fm2 = (scope.F ?? NaN) * 1e-4; // cm²→m²
    const rho = scope.rho ?? NaN;
    const rOhm = scope.r ?? NaN;

    // 第一遍解析取首行 U1（已定系统误差修正基准），第二遍带 U1_0 解析派生列
    const firstPass = parseTable(ThermalExperiment.datasets[0], state, {});
    const firstValid = firstPass.rows.find((row) => Number.isFinite(row.tau) && Number.isFinite(row.U1) && Number.isFinite(row.U2));
    if (!firstValid) {
      diagnostics.push('时序数据不足（至少 3 行有效数据）');
      return { results, fits, custom, diagnostics };
    }
    const U1_0 = firstValid.U1;
    const tbl = parseTable(ThermalExperiment.datasets[0], state, { U1_0 });
    const rows = tbl.rows.filter((row) => Number.isFinite(row.tau) && Number.isFinite(row.U1) && Number.isFinite(row.U2));
    if (rows.length < 3) {
      diagnostics.push('时序数据不足（至少 3 行有效数据）');
      return { results, fits, custom, diagnostics };
    }
    const corrected: Record<string, number>[] = rows.map((row) => ({ ...row, U1c: row.U1 - U1_0 }));

    // 区间选择
    const tStart = scope.tauStart;
    const tEnd = scope.tauEnd;
    const inRange = corrected.filter((row) =>
      (tStart === undefined || row.tau >= tStart) && (tEnd === undefined || row.tau <= tEnd));
    const useRows = inRange.length >= 3 ? inRange : corrected;
    if (inRange.length < 3 && (tStart !== undefined || tEnd !== undefined)) {
      diagnostics.push(`区间内仅 ${inRange.length} 行（<3），暂用全部数据；请调整 τstart/τend`);
    }

    // 准稳态诊断：U1 均值/标准差/斜率；U2 线性拟合
    const taus = useRows.map((row) => row.tau);
    const u1s = useRows.map((row) => row.U1c);
    const u2s = useRows.map((row) => row.U2);
    const u1Mean = mean(u1s);
    const u1Std = u1s.length >= 2 ? sampleStd(u1s) : NaN;
    const u1Fit = olsFn(taus, u1s);
    const u2Fit = olsFn(taus, u2s);
    custom['quasi'] = {
      u1Mean, u1Std, u1Slope: u1Fit.b, u1SlopeRel: Math.abs(u1Fit.b) / Math.max(1e-12, Math.abs(u2Fit.b)),
      u2Fit: { a: u2Fit.a, b: u2Fit.b, r: u2Fit.r, n: u2Fit.n },
      rowsIn: useRows.length, rowsAll: corrected.length,
    };
    fits['u2-fit'] = { spec: ThermalExperiment.fits[0], ols: u2Fit };
    if (Math.abs(u1Fit.b / Math.max(1e-12, Math.abs(u2Fit.b))) > 0.05) {
      diagnostics.push(`区间内 U1 仍有显著趋势（|斜率 U1/U2|=${(Math.abs(u1Fit.b / u2Fit.b)).toPrecision(3)}），准稳态近似可能不成立`);
    }
    if (Math.abs(u2Fit.r) < 0.995) {
      diagnostics.push(`U2–τ 线性拟合 |r|=${Math.abs(u2Fit.r).toPrecision(4)} 偏低，温升未达近似线性区间`);
    }

    // qc
    if ([scope.Ubefore, scope.Uafter, Fm2, rOhm].every(Number.isFinite) && Fm2 > 0 && rOhm > 0) {
      const Uheat = ((scope.Ubefore ?? 0) + (scope.Uafter ?? 0)) / 2;
      const qc = (Uheat * Uheat) / (2 * Fm2 * rOhm);
      results.push(makeResult({
        id: 'qc',
        title: '加热面热流密度 qc',
        symbol: 'q_c',
        unit: 'W/m²',
        finalText: qc.toPrecision(8),
        steps: [
          {
            formulaLatex: 'U_{heat} = \\frac{U_{前}+U_{后}}{2},\\quad q_c = \\frac{U_{heat}^2}{2 F r}',
            substitution: `Uheat=${Uheat.toPrecision(8)} V，F=${Fm2.toPrecision(8)} m²，r=${rOhm.toPrecision(8)} Ω`,
            unrounded: `qc = ${qc.toPrecision(12)} W/m²`,
          },
        ],
        provenance: { status: 'source-explicit', document: DOC },
      }));

      // λ
      // U1c 单位 μV；Δt = U1c[μV] / 40 [μV/℃]
      const dtCourse = u1Mean / 40;
      if (Number.isFinite(Rm) && Rm > 0 && dtCourse !== 0) {
        const lambda = (qc * Rm) / (2 * dtCourse);
        results.push(makeResult({
          id: 'lambda',
          title: '导热系数 λ',
          symbol: '\\lambda',
          unit: 'W/(m·K)',
          finalText: lambda.toPrecision(8),
          steps: [
            {
              formulaLatex: '\\Delta t = \\frac{U_1^{corr}}{S},\\quad \\lambda = \\frac{q_c R}{2\\Delta t}',
              substitution: `U1c 均值=${u1Mean.toPrecision(8)} μV（区间 ${useRows.length} 行），S=40 μV/℃，R=${Rm.toPrecision(6)} m`,
              unrounded: `Δt=${dtCourse.toPrecision(8)} ℃，λ = ${lambda.toPrecision(12)} W/(m·K)`,
            },
          ],
          provenance: { status: 'source-explicit', document: DOC },
        }));
        // c
        const dTdt = (u2Fit.b / 40); // ℃/s（μV/s ÷ 40 μV/℃）
        if (Number.isFinite(rho) && rho > 0 && dTdt !== 0) {
          const c = qc / (rho * Rm * dTdt);
          results.push(makeResult({
            id: 'specific-heat',
            title: '比热 c',
            symbol: 'c',
            unit: 'J/(kg·K)',
            finalText: c.toPrecision(8),
            steps: [
              {
                formulaLatex: 'q_c F = c\\,\\rho\\, R\\, F\\,\\frac{dt}{d\\tau} \\;\\Rightarrow\\; c = \\frac{q_c}{\\rho R\\,(dt/d\\tau)}',
                substitution: `dt/dτ = U2 斜率/40 = ${u2Fit.b.toPrecision(8)}/40 = ${dTdt.toPrecision(8)} ℃/s（r=${u2Fit.r.toPrecision(6)}）`,
                unrounded: `c = ${c.toPrecision(12)} J/(kg·K)（分母含半厚度 R，AGENTS §21.5）`,
              },
            ],
            provenance: { status: 'source-explicit', document: DOC },
          }));
          // 85% 修正
          if ((scope.power85 ?? 0) >= 0.5) {
            const qc85 = 0.85 * qc;
            const lambda85 = (qc85 * Rm) / (2 * dtCourse);
            const c85 = qc85 / (rho * Rm * dTdt);
            results.push(makeResult({
              id: 'lambda85',
              title: '85% 电功率修正（并列显示）',
              finalText: `λ′=${lambda85.toPrecision(8)} W/(m·K)，c′=${c85.toPrecision(8)} J/(kg·K)`,
              steps: [{
                formulaLatex: "q_c' = 0.85\\,q_c",
                substitution: `qc′=${qc85.toPrecision(8)} W/m²`,
                unrounded: `λ′=${lambda85.toPrecision(10)}，c′=${c85.toPrecision(10)}`,
              }],
              provenance: { status: 'source-explicit', document: DOC },
            }));
          }
        } else {
          diagnostics.push('需要有效 ρ 与 U2 斜率才能计算 c');
        }
      } else {
        diagnostics.push('需要有效半厚度 R 与非零 Δt 才能计算 λ');
      }
    } else {
      diagnostics.push('需要 U前/U后/F/r 参数计算 qc');
    }
    return { results, fits, custom, diagnostics };
  },
};
