/** 实验：示波器原理和使用、声速测量（plan §10.5） */
import { ExperimentDefinition, ExperimentState, ExperimentComputation, ComputedFit } from '../types';
import { parseTable, runFit, parseParams } from '../engine';
import { makeResult } from '../../core/results';
import { mean } from '../../core/statistics';
import { formatMeasurement } from '../../core/sigfig';
import { StandardProfile } from '../../standards/types';
import { SOUND_FREQUENCY_ERROR } from '../../instruments';
import { linearInterpolation } from '../../core/statistics';

const DOC = '2026秋物理实验A(1)教学资料';

/** 饱和水蒸气压表（kPa，标准物理常数表；用于线性插值） */
const PSAT_TABLE: [number, number][] = [
  [0, 0.611], [2, 0.706], [4, 0.813], [6, 0.935], [8, 1.072], [10, 1.228],
  [12, 1.403], [14, 1.599], [16, 1.818], [18, 2.064], [20, 2.339],
  [22, 2.645], [24, 2.985], [26, 3.363], [28, 3.781], [30, 4.246],
  [32, 4.758], [34, 5.324], [36, 5.946], [38, 6.628], [40, 7.381],
];

export const ScopeSoundExperiment: ExperimentDefinition = {
  id: 'scope-sound',
  version: 1,
  title: '示波器原理和使用、声速测量',
  subtitle: '分度法测量 · 利萨如 · 20 点同相法声速 · 理论声速对比 · RC/RLC',
  category: '电磁学/波动',
  tags: ['20 点拟合', '相位法', '理论对比'],
  reportType: 'minimal',
  safety: ['示波器输入电压不得超过额定值', '信号发生器输出不得短接', '声速测量换能器勿施加机械冲击'],
  provenance: { status: 'source-explicit', document: DOC, section: '实验五 示波器原理和使用、声速测量' },
  metadataFields: [
    { id: 'name', label: '姓名', kind: 'text' },
    { id: 'studentId', label: '学号', kind: 'text' },
    { id: 'date', label: '实验日期', kind: 'text' },
  ],
  params: [
    { id: 'fmin', label: '信号频率下限 fmin（Hz，可选）', unit: 'Hz', defaultText: '' },
    { id: 'fmax', label: '信号频率上限 fmax（Hz，可选）', unit: 'Hz', defaultText: '' },
    { id: 'f', label: '信号频率 f（Hz；上两项填写时自动平均）', unit: 'Hz', defaultText: '' , instrumentErrorNote: '课程指定 Δf = 10 Hz' },
    { id: 't1c', label: '实验前温度 t1', unit: '℃', defaultText: '' },
    { id: 't2c', label: '实验后温度 t2', unit: '℃', defaultText: '' },
    { id: 'rh1', label: '实验前相对湿度 RH1（%）', unit: '%', defaultText: '' },
    { id: 'rh2', label: '实验后相对湿度 RH2（%）', unit: '%', defaultText: '' },
    { id: 'nx', label: '利萨如：水平切点数 nx', unit: '', defaultText: '' },
    { id: 'ny', label: '利萨如：垂直切点数 ny', unit: '', defaultText: '' },
    { id: 'fx', label: '利萨如：已知频率 fx', unit: 'Hz', defaultText: '' },
    { id: 'vdiv', label: '示波器：V/div', unit: 'V', defaultText: '' },
    { id: 'hdiv', label: '示波器：纵向格数', unit: 'div', defaultText: '' },
    { id: 'tdiv', label: '示波器：s/div', unit: 's', defaultText: '' },
    { id: 'wdiv', label: '示波器：横向周期格数', unit: 'div', defaultText: '' },
    { id: 'dtPhase', label: '示波器：两信号时间差 Δt', unit: 's', defaultText: '' },
    { id: 'R', label: 'RC/RLC：电阻 R', unit: 'Ω', defaultText: '' },
    { id: 'C', label: 'RC/RLC：电容 C', unit: 'μF', defaultText: '' },
    { id: 'L', label: 'RLC：电感 L', unit: 'mH', defaultText: '' },
  ],
  datasets: [
    {
      id: 'sound',
      title: '声速：20 个同相点位置',
      hint: 'n 为同相点序号（1..20），x 为换能器位置（mm）。拟合 x=a+bn，λ=b。',
      defaultRows: 20,
      columns: [
        { id: 'n', header: 'n' },
        { id: 'x', header: 'x', unit: 'mm' },
      ],
    },
  ],
  fits: [
    { id: 'sound-fit', title: '同相点 x–n 拟合', tableId: 'sound', xCol: 'n', yCol: 'x', mode: 'ols', modelLatex: 'x = a + b\\,n,\\quad \\lambda = b' },
  ],
  plots: [
    { id: 'sound-plot', title: '同相点位置 x–n', tableId: 'sound', xCol: 'n', yCol: 'x', xLabel: 'n', yLabel: 'x (mm)', fitId: 'sound-fit', fitLabel: 'x = a + bn' },
  ],
  steps: [
    {
      id: 'sound-data', title: '声速数据（20 同相点）',
      blocks: [
        { type: 'safety', items: ['换能器勿机械冲击', '信号发生器输出勿短接'] },
        { type: 'table', tableId: 'sound' },
        { type: 'fits', fitIds: ['sound-fit'] },
        { type: 'plot', plotId: 'sound-plot' },
      ],
    },
    {
      id: 'sound-result', title: '声速结果',
      blocks: [
        { type: 'params', fields: ['fmin', 'fmax', 'f'], title: '频率（课程 Δf=10 Hz）' },
        { type: 'results', resultIds: ['lambda', 'v'] },
      ],
    },
    {
      id: 'theory', title: '理论声速对比',
      blocks: [
        { type: 'params', fields: ['t1c', 't2c', 'rh1', 'rh2'], title: '温湿度（前后平均；饱和蒸气压线性插值）' },
        { type: 'results', resultIds: ['v-theory'] },
      ],
    },
    {
      id: 'scope', title: '示波器快速测量',
      blocks: [
        { type: 'params', fields: ['vdiv', 'hdiv', 'tdiv', 'wdiv', 'dtPhase'], title: '分度法读数' },
        { type: 'results', resultIds: ['scope-quick'] },
      ],
    },
    {
      id: 'lissajous', title: '利萨如图形',
      blocks: [
        { type: 'params', fields: ['nx', 'ny', 'fx'] },
        { type: 'results', resultIds: ['lissajous'] },
      ],
    },
    {
      id: 'rc', title: 'RC / RLC 电路（选做）',
      blocks: [
        { type: 'params', fields: ['R', 'C', 'L'] },
        { type: 'results', resultIds: ['rc-rlc'] },
      ],
    },
  ],
  compute: (state: ExperimentState, profile: StandardProfile): ExperimentComputation => {
    const results = [];
    const fits: Record<string, ComputedFit> = {};
    const diagnostics: string[] = [];
    const { scope } = parseParams(ScopeSoundExperiment.params.map((p) => ({ id: p.id })), state.params);

    // --- 声速 ---
    const tbl = parseTable(ScopeSoundExperiment.datasets[0], state, {});
    const fitRes = runFit(ScopeSoundExperiment.fits[0], tbl);
    let lamM = NaN;
    let dLam = NaN;
    if ('ols' in fitRes && fitRes.ols) {
      fits['sound-fit'] = fitRes;
      const f = fitRes.ols;
      lamM = (f.b * 1e-3); // mm→m
      dLam = f.deltaB * 1e-3;
      results.push(makeResult({
        id: 'lambda',
        title: '波长 λ（同相点拟合斜率）',
        symbol: '\\lambda',
        unit: 'm',
        finalText: formatMeasurement(lamM, dLam, profile.sigfig).text,
        steps: [
          {
            formulaLatex: 'x = a + b\\,n,\\quad \\lambda = b',
            substitution: `b=${f.b.toPrecision(8)} mm，r=${f.r.toPrecision(6)}，n=${f.n}`,
            unrounded: `Δλ = t·Sb = ${f.t.toPrecision(6)}（ν=${f.dof}=n−2）× ${f.sb.toPrecision(6)} mm = ${f.deltaB.toPrecision(8)} mm`,
          },
        ],
        provenance: { status: 'source-explicit', document: DOC, note: '自由度 n−2（AGENTS §21.7）' },
      }));
    }
    // 频率
    let fHz = scope.f ?? NaN;
    let fNote = '用户输入';
    if (Number.isFinite(scope.fmin) && Number.isFinite(scope.fmax) && !Number.isFinite(scope.f)) {
      fHz = (scope.fmin + scope.fmax) / 2;
      fNote = `前后平均 (${scope.fmin}+${scope.fmax})/2`;
    }
    if (Number.isFinite(lamM) && Number.isFinite(fHz) && fHz > 0) {
      const v = fHz * lamM;
      const dv = Math.sqrt((fHz * dLam) ** 2 + (lamM * SOUND_FREQUENCY_ERROR) ** 2);
      results.push(makeResult({
        id: 'v',
        title: '声速 v = fλ',
        symbol: 'v',
        unit: 'm/s',
        finalText: formatMeasurement(v, dv, profile.sigfig).text,
        steps: [
          {
            formulaLatex: 'v = f\\lambda',
            substitution: `f=${fHz.toPrecision(8)} Hz（${fNote}，Δf=${SOUND_FREQUENCY_ERROR} Hz），λ=${lamM.toPrecision(8)} m`,
            unrounded: `v = ${v.toPrecision(12)} m/s，Δv = √[(f·Δλ)² + (λ·Δf)²] = ${dv.toPrecision(8)} m/s`,
          },
        ],
        provenance: { status: 'source-explicit', document: DOC },
      }));

      // --- 理论声速 ---
      if (Number.isFinite(scope.t1c) && Number.isFinite(scope.t2c)) {
        const tAvg = (scope.t1c + scope.t2c) / 2;
        const vDry = 331.45 * Math.sqrt(1 + tAvg / 273.15);
        const rhAvg = Number.isFinite(scope.rh1) && Number.isFinite(scope.rh2) ? (scope.rh1 + scope.rh2) / 2 : NaN;
        let vTheory = vDry;
        let humidNote = '按干燥空气处理（未填湿度）';
        if (Number.isFinite(rhAvg)) {
          const psat = linearInterpolation(tAvg, PSAT_TABLE.map((p) => p[0]), PSAT_TABLE.map((p) => p[1])); // kPa
          const e = (rhAvg / 100) * psat * 1000; // Pa
          const p0 = 101325;
          vTheory = vDry / Math.sqrt(1 - (0.378 * e) / p0);
          humidNote = `湿空气：RH=${rhAvg.toPrecision(4)}%，psat(${tAvg.toPrecision(4)}℃)=${psat.toPrecision(6)} kPa（线性插值），e=${e.toPrecision(6)} Pa`;
        }
        const relDev = Math.abs(v - vTheory) / vTheory;
        results.push(makeResult({
          id: 'v-theory',
          title: '理论声速与相对偏差',
          finalText: `v理论 = ${vTheory.toPrecision(8)} m/s，相对偏差 ${(relDev * 100).toPrecision(3)}%`,
          steps: [
            {
              formulaLatex: 'v_{dry} = 331.45\\sqrt{1+\\frac{t}{273.15}},\\quad v_{humid} = \\frac{v_{dry}}{\\sqrt{1-0.378\\,e/p}}',
              substitution: `t̄=${tAvg.toPrecision(6)} ℃（前后平均）。${humidNote}`,
              unrounded: `相对偏差 = |v−v理论|/v理论 = ${relDev.toPrecision(6)}`,
            },
          ],
          provenance: {
            status: 'source-derived',
            document: DOC,
            note: '湿空气因子由混合气体摩尔质量推导（M_v/M_d≈0.622）；饱和蒸气压表为标准物理常数表',
          },
        }));
      }
    }

    // --- 示波器快速测量 ---
    if (Number.isFinite(scope.vdiv) && Number.isFinite(scope.hdiv)) {
      const u = scope.vdiv * scope.hdiv;
      let note = '峰峰值 Up-p';
      results.push(makeResult({
        id: 'scope-volt',
        title: '示波器分度法',
        finalText: `Up-p = ${u.toPrecision(8)} V`,
        steps: [{
          formulaLatex: 'U = \\text{格数}\\times\\text{V/div}',
          substitution: `${scope.hdiv} div × ${scope.vdiv} V/div`,
          note,
        }],
        provenance: { status: 'source-explicit', document: DOC },
      }));
      void note;
      if (Number.isFinite(scope.tdiv) && Number.isFinite(scope.wdiv)) {
        const T = scope.tdiv * scope.wdiv;
        results.push(makeResult({
          id: 'scope-period',
          title: '周期与频率',
          finalText: `T = ${T.toPrecision(8)} s，f = ${(1 / T).toPrecision(8)} Hz`,
          steps: [{
            formulaLatex: 'T = \\text{格数}\\times\\text{s/div},\\quad f = 1/T',
            substitution: `${scope.wdiv} div × ${scope.tdiv} s/div`,
          }],
          provenance: { status: 'source-explicit', document: DOC },
        }));
        if (Number.isFinite(scope.dtPhase)) {
          const phi = (2 * Math.PI * scope.dtPhase) / T;
          results.push(makeResult({
            id: 'scope-phase',
            title: '两信号相位差',
            finalText: `φ = ${phi.toPrecision(8)} rad = ${((phi * 180) / Math.PI).toPrecision(8)}°`,
            steps: [{
              formulaLatex: '\\varphi = 2\\pi\\,\\frac{\\Delta t}{T}',
              substitution: `Δt=${scope.dtPhase} s，T=${T.toPrecision(8)} s`,
            }],
            provenance: { status: 'source-explicit', document: DOC },
          }));
        }
      }
    }

    // --- 利萨如 ---
    if ([scope.nx, scope.ny, scope.fx].every((v) => Number.isFinite(v) && v > 0)) {
      const fy = (scope.fx * scope.nx) / scope.ny;
      results.push(makeResult({
        id: 'lissajous',
        title: '利萨如图形频率比',
        finalText: `fy = ${fy.toPrecision(8)} Hz`,
        steps: [{
          formulaLatex: '\\frac{f_y}{f_x} = \\frac{n_x}{n_y}',
          substitution: `nx=${scope.nx}，ny=${scope.ny}，fx=${scope.fx} Hz`,
          note: '端点相切按 1/2 计数的规则以教师现场确认为准',
        }],
        provenance: { status: 'source-explicit', document: DOC },
      }));
    }

    // --- RC/RLC ---
    if (Number.isFinite(scope.R) && Number.isFinite(scope.C)) {
      const CF = scope.C * 1e-6;
      const tau = scope.R * CF;
      const steps = [{
        formulaLatex: '\\tau = R C',
        substitution: `R=${scope.R} Ω，C=${CF.toPrecision(8)} F`,
        unrounded: `τ = ${tau.toPrecision(10)} s（充电 uC=E(1−e^(−t/τ))；RC≪T 时微分近似 uR≈RC·du/dt）`,
      }];
      let title = 'RC 电路';
      if (Number.isFinite(scope.L)) {
        const LH = scope.L * 1e-3;
        const f0 = 1 / (2 * Math.PI * Math.sqrt(LH * CF));
        title = 'RC / RLC 电路';
        steps.push({
          formulaLatex: 'f_0 = \\frac{1}{2\\pi\\sqrt{LC}}',
          substitution: `L=${LH.toPrecision(8)} H，C=${CF.toPrecision(8)} F`,
          unrounded: `f0 = ${f0.toPrecision(10)} Hz（串联谐振）`,
        });
      }
      results.push(makeResult({ id: 'rc-rlc', title, finalText: `τ = ${tau.toPrecision(8)} s`, steps, provenance: { status: 'source-explicit', document: DOC } }));
    }

    return { results, fits, custom: {}, diagnostics };
  },
};
