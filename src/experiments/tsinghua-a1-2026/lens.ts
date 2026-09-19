/** 实验：透镜焦距测量（plan §10.6）— 共轭法 / 焦距仪 / 凹透镜自准法 */
import { ExperimentDefinition, ExperimentState, ExperimentComputation } from '../types';
import { parseTable, parseParams } from '../engine';
import { makeResult } from '../../core/results';
import { mean, sampleStd, tQuantile } from '../../core/statistics';
import { formatMeasurement } from '../../core/sigfig';
import { StandardProfile } from '../../standards/types';
import { CONJUGATE_ERRORS, FOCIMETER_POSITION_ERROR_MM, OPTICAL_BENCH_POSITION_ERROR_CM, COLLIMATOR_FOCAL_REL_ERROR } from '../../instruments';

const DOC = '2026秋物理实验A(1)教学资料';

export const LensExperiment: ExperimentDefinition = {
  id: 'lens',
  version: 1,
  title: '透镜焦距测量',
  subtitle: '共轭法 · 焦距仪 · 凹透镜自准法',
  category: '光学',
  tags: ['光学位置', '重复测量', '间接量不确定度'],
  reportType: 'minimal',
  safety: ['勿用手触摸光学表面，持镜边操作', '光学元件跌落风险：稳固安装于光具座后再调光路'],
  provenance: { status: 'source-explicit', document: DOC, section: '实验六 透镜焦距测量' },
  metadataFields: [
    { id: 'name', label: '姓名', kind: 'text' },
    { id: 'studentId', label: '学号', kind: 'text' },
    { id: 'date', label: '实验日期', kind: 'text' },
  ],
  params: [
    { id: 'b', label: '共轭法：物屏-像屏距离 b', unit: 'cm', defaultText: '', hint: 'b > 4f' },
    { id: 'da', label: '共轭法 Δa（课程给定可编辑）', unit: 'cm', defaultText: '0.25', instrumentErrorNote: '课程给定 Δa=0.25 cm' },
    { id: 'db', label: '共轭法 Δb（课程给定可编辑）', unit: 'cm', defaultText: '0.20', instrumentErrorNote: '课程给定 Δb=0.20 cm' },
    { id: 'f0', label: '焦距仪：平行光管焦距 f', unit: 'mm', defaultText: '400', hint: '用所用仪器标称值，不可硬编码', instrumentErrorNote: '相对不确定度 0.3%' },
    { id: 'y', label: '焦距仪：玻罗板线距 y', unit: 'mm', defaultText: '', instrumentErrorNote: '相对不确定度 0.02%，讲义默认可忽略' },
  ],
  datasets: [
    {
      id: 'conjugate',
      title: '共轭法：6 次透镜位置',
      hint: 'O1、O2 为两次成像的透镜位置（cm）；a=|O2−O1| 自动派生。',
      defaultRows: 6,
      columns: [
        { id: 'O1', header: 'O1', unit: 'cm' },
        { id: 'O2', header: 'O2', unit: 'cm' },
        { id: 'a', header: 'a', unit: 'cm', kind: 'derived', expression: 'abs(O2 - O1)', formulaLatex: 'a = |O_2 - O_1|' },
      ],
    },
    {
      id: 'focimeter',
      title: '焦距仪：6 次测微目镜读数',
      hint: "y1′、y2′ 为玻罗板像的两线位置（mm）；y′=|y1′−y2′| 派生。fx=(y′/y)f 逐行计算。",
      defaultRows: 6,
      columns: [
        { id: 'y1p', header: "y1′", unit: 'mm' },
        { id: 'y2p', header: "y2′", unit: 'mm' },
        { id: 'yp', header: "y′", unit: 'mm', kind: 'derived', expression: 'abs(y2p - y1p)', formulaLatex: "y' = |y_1' - y_2'|" },
        { id: 'fx', header: 'fx', unit: 'mm', kind: 'derived', expression: 'yp / y * f0', formulaLatex: "f_x = \\frac{y'}{y} f" },
      ],
    },
    {
      id: 'concave',
      title: '凹透镜自准法：位置读数',
      hint: "O2′、O2″ 为凹透镜转 180° 前后位置（cm），O2 取平均消除光心装配系统误差；F2 为焦点位置。",
      defaultRows: 6,
      columns: [
        { id: 'O2a', header: "O2′", unit: 'cm' },
        { id: 'O2b', header: "O2″", unit: 'cm' },
        { id: 'F2', header: 'F2', unit: 'cm' },
        { id: 'O2', header: 'O2', unit: 'cm', kind: 'derived', expression: '(O2a + O2b) / 2', formulaLatex: "O_2 = \\frac{O_2' + O_2''}{2}" },
        { id: 'f', header: 'f', unit: 'cm', kind: 'derived', expression: '-abs(F2 - O2)', formulaLatex: 'f = -|F_2 - O_2|' },
      ],
    },
  ],
  fits: [],
  plots: [],
  steps: [
    {
      id: 'conj-data', title: '共轭法数据',
      blocks: [
        { type: 'params', fields: ['b', 'da', 'db'], title: '共轭法参数' },
        { type: 'table', tableId: 'conjugate' },
      ],
    },
    {
      id: 'conj-result', title: '共轭法结果',
      blocks: [
        { type: 'results', resultIds: ['conjugate-f'], title: '共轭法焦距（6 次测量）' },
      ],
    },
    {
      id: 'foc-data', title: '焦距仪数据',
      blocks: [
        { type: 'params', fields: ['f0', 'y'], title: '焦距仪参数' },
        { type: 'table', tableId: 'focimeter' },
      ],
    },
    {
      id: 'foc-result', title: '焦距仪结果',
      blocks: [
        { type: 'results', resultIds: ['focimeter-f'], title: '焦距仪测焦距' },
      ],
    },
    {
      id: 'cav-data', title: '凹透镜自准法数据',
      blocks: [{ type: 'table', tableId: 'concave' }],
    },
    {
      id: 'cav-result', title: '凹透镜结果',
      blocks: [
        { type: 'results', resultIds: ['concave-f'], title: '凹透镜焦距（负值）' },
      ],
    },
  ],
  compute: (state: ExperimentState, profile: StandardProfile): ExperimentComputation => {
    const results = [];
    const diagnostics: string[] = [];
    const { scope } = parseParams(
      [{ id: 'b' }, { id: 'da' }, { id: 'db' }, { id: 'f0' }, { id: 'y' }],
      state.params,
    );

    // --- 共轭法 ---
    const conj = parseTable(LensExperiment.datasets[0], state, { y: scope.y ?? NaN, f0: scope.f0 ?? NaN });
    const aValues = conj.rows.map((r) => r.a).filter(Number.isFinite);
    const bCm = scope.b ?? NaN;
    if (aValues.length >= 1 && Number.isFinite(bCm)) {
      const aMean = mean(aValues);
      const f = (bCm * bCm - aMean * aMean) / (4 * bCm);
      const dA = scope.da ?? CONJUGATE_ERRORS.a;
      const dB = scope.db ?? CONJUGATE_ERRORS.b;
      // ∂f/∂a = −a/(2b)；∂f/∂b = 1/4 + a²/(4b²)
      const cA = Math.abs(aMean) / (2 * bCm);
      const cB = 0.25 + (aMean * aMean) / (4 * bCm * bCm);
      const df = Math.sqrt((cA * dA) ** 2 + (cB * dB) ** 2);
      results.push(makeResult({
        id: 'conjugate-f',
        title: '共轭法焦距',
        symbol: 'f',
        unit: 'cm',
        finalText: formatMeasurement(f, df, profile.sigfig).text,
        steps: [
          {
            formulaLatex: 'f = \\frac{b^2 - a^2}{4b}',
            substitution: `b=${bCm} cm，ā=${aMean.toPrecision(8)} cm（${aValues.length} 次平均）`,
            unrounded: `f = ${f.toPrecision(12)} cm`,
          },
          {
            formulaLatex: '\\frac{\\partial f}{\\partial a} = -\\frac{a}{2b},\\quad \\frac{\\partial f}{\\partial b} = \\frac{1}{4} + \\frac{a^2}{4b^2}',
            substitution: `Δa=${dA} cm，Δb=${dB} cm（课程给定，可编辑） → Δf = √[(a/2b·Δa)² + ((1/4+a²/4b²)·Δb)²]`,
            unrounded: `Δf = ${df.toPrecision(10)} cm`,
          },
        ],
        provenance: { status: 'source-explicit', document: DOC, section: '共轭法' },
        ruleNotes: aValues.length < 6 ? [`课程要求 6 次测量，当前仅 ${aValues.length} 次`] : ['6 次测量齐全'],
      }));
      if (bCm <= 4 * Math.abs(f)) diagnostics.push(`b=${bCm} cm 未明显大于 4f≈${(4 * f).toPrecision(4)} cm，可能无法两次成像`);
    } else {
      diagnostics.push('共轭法：需填写 b 与至少一次 O1/O2 数据');
    }

    // --- 焦距仪 ---
    const foc = parseTable(LensExperiment.datasets[1], state, { y: scope.y ?? NaN, f0: scope.f0 ?? NaN });
    const fxValues = foc.rows.map((r) => r.fx).filter(Number.isFinite);
    const ypValues = foc.rows.map((r) => r.yp).filter(Number.isFinite);
    if (fxValues.length >= 2 && Number.isFinite(scope.y) && scope.y > 0 && Number.isFinite(scope.f0)) {
      const fxMean = mean(fxValues);
      const n = ypValues.length;
      // yp 的 A 分量
      const t = tQuantile(n - 1, profile.confidence ?? 0.95);
      const dAyp = t * (sampleStd(ypValues) / Math.sqrt(n));
      // yp 的 B 分量：两位置作差 √2×0.004 mm
      const dByp = Math.SQRT2 * FOCIMETER_POSITION_ERROR_MM;
      const dyp = Math.sqrt(dAyp ** 2 + dByp ** 2);
      const ypMean = mean(ypValues);
      const relYp = dyp / ypMean;
      const relF0 = COLLIMATOR_FOCAL_REL_ERROR;
      // relY 0.02% 默认忽略（讲义）
      const relFx = Math.sqrt(relYp ** 2 + relF0 ** 2);
      const dfx = relFx * fxMean;
      results.push(makeResult({
        id: 'focimeter-f',
        title: '焦距仪法焦距',
        symbol: 'f_x',
        unit: 'mm',
        finalText: formatMeasurement(fxMean, dfx, profile.sigfig).text,
        steps: [
          {
            formulaLatex: "f_x = \\frac{y'}{y}\\, f",
            substitution: `y′̄=${ypMean.toPrecision(8)} mm（${n} 次），y=${scope.y} mm，f=${scope.f0} mm`,
            unrounded: `fx = ${fxMean.toPrecision(12)} mm`,
          },
          {
            formulaLatex: "\\frac{\\Delta f_x}{f_x} = \\sqrt{\\left(\\frac{\\Delta y'}{y'}\\right)^2 + \\left(\\frac{\\Delta f}{f}\\right)^2}",
            substitution: `Δy′=√[(t·S/√n)² + (√2×0.004)²]=${dyp.toPrecision(6)} mm（A=${dAyp.toPrecision(4)}，B=${dByp.toPrecision(4)}）；Δf/f=0.3%；Δy/y=0.02% 讲义默认忽略`,
            unrounded: `相对 ${relFx.toPrecision(6)} → Δfx = ${dfx.toPrecision(8)} mm`,
          },
        ],
        provenance: { status: 'source-explicit', document: DOC, section: '焦距仪' },
      }));
    } else if (fxValues.length > 0) {
      diagnostics.push('焦距仪：需要 y 与 f0 参数及至少 2 次读数');
    }

    // --- 凹透镜自准法 ---
    const cav = parseTable(LensExperiment.datasets[2], state, {});
    const fValues = cav.rows.map((r) => r.f).filter(Number.isFinite);
    const o2Values = cav.rows.map((r) => r.O2).filter(Number.isFinite);
    const f2Values = cav.rows.map((r) => r.F2).filter(Number.isFinite);
    if (fValues.length >= 2) {
      const n = fValues.length;
      const t = tQuantile(n - 1, profile.confidence ?? 0.95);
      const dA = t * (sampleStd(fValues) / Math.sqrt(n));
      // 位置误差传播：f = -|F2 - O2|；Δf ≥ √(ΔF2² + ΔO2²)
      // O2 为两次平均：ΔO2 = √2×0.05/2；F2 单位置 0.05
      const dO2 = (Math.SQRT2 * OPTICAL_BENCH_POSITION_ERROR_CM) / 2;
      const dF2 = OPTICAL_BENCH_POSITION_ERROR_CM;
      const dB = Math.sqrt(dF2 ** 2 + dO2 ** 2);
      const fMean = mean(fValues);
      const dfTotal = Math.sqrt(dA ** 2 + dB ** 2);
      results.push(makeResult({
        id: 'concave-f',
        title: '凹透镜焦距（自准法，负值）',
        symbol: 'f',
        unit: 'cm',
        finalText: formatMeasurement(fMean, dfTotal, profile.sigfig).text,
        steps: [
          {
            formulaLatex: 'f = -|F_2 - O_2|,\\quad O_2 = \\frac{O_2\'+ + O_2\'\'}{2}',
            substitution: `${n} 次测量，f̄=${fMean.toPrecision(8)} cm`,
            unrounded: `Δf(A)=${dA.toPrecision(6)}，Δf(B)=√(ΔF2²+ΔO2²)=${dB.toPrecision(6)}，合成 ${dfTotal.toPrecision(8)} cm`,
          },
        ],
        provenance: { status: 'source-explicit', document: DOC, section: '自准法' },
        ruleNotes: ['O2 取转动 180° 两次平均消除光心装配系统误差', '光具座每位置读数仪器误差 0.05 cm'],
      }));
      if (fMean >= 0) diagnostics.push('凹透镜 f 应为负值（f=-|F2-O2|），请检查位置关系');
      void o2Values; void f2Values;
    }
    return { results, fits: {}, custom: {}, diagnostics };
  },
};
