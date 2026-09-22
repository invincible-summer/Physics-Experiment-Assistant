/** 实验：霍尔效应及磁电阻测量（plan §10.2） */
import { ExperimentDefinition, ExperimentState, ExperimentComputation, ComputedFit } from '../types';
import { parseTable, runFit, parseParams } from '../engine';
import { makeResult } from '../../core/results';
import { mean, sampleStd, tQuantile } from '../../core/statistics';
import { ELEMENTARY_CHARGE as E_CHARGE } from '../../physics/constants';
import { formatMeasurement } from '../../core/sigfig';
import { StandardProfile } from '../../standards/types';

const DOC = '2026秋物理实验A(1)教学资料';

export const HallExperiment: ExperimentDefinition = {
  id: 'hall',
  version: 1,
  title: '霍尔效应及磁电阻测量',
  subtitle: '四换向组合、霍尔参数、电磁铁标定与磁阻',
  category: '电磁学',
  tags: ['多列表格', '换向组合', '线性拟合', '间接量不确定度'],
  reportType: 'minimal',
  safety: ['电磁铁通电时间不宜过长，防止过热', '工作电流不得超过霍尔片额定电流，防止烧毁元件', '换向动作应在断电或确认接线后进行'],
  provenance: { status: 'source-explicit', document: DOC, section: '实验二 霍尔效应及磁电阻测量' },
  metadataFields: [
    { id: 'name', label: '姓名', kind: 'text' },
    { id: 'studentId', label: '学号', kind: 'text' },
    { id: 'date', label: '实验日期', kind: 'text' },
  ],
  params: [
    { id: 'd', label: '霍尔片厚度 d', unit: 'mm', defaultText: '0.50', hint: '换算到内部 SI 计算' },
    { id: 'B', label: 'UH–I 测量时的磁感应强度 B', unit: 'mT', defaultText: '500', hint: '电磁铁标称/标定值' },
    { id: 'Ical', label: '磁场标定时的工作电流 I', unit: 'mA', defaultText: '10.0' },
    { id: 'R0', label: '磁阻测量：零场电阻 R(0)', unit: 'Ω', defaultText: '' },
    { id: 'KH', label: '已标定的霍尔灵敏度 KH（可留空 → 自动采用拟合值）', unit: 'V/(A·T)', defaultText: '' },
  ],
  datasets: [
    {
      id: 'uhI',
      title: 'UH–I 数据表（四换向）',
      hint: 'I 用 mA，U1~U4 用 mV。UH=(U1−U2+U3−U4)/4，自动派生（mV）。',
      defaultRows: 8,
      columns: [
        { id: 'I', header: 'I', unit: 'mA' },
        { id: 'U1', header: 'U1', unit: 'mV' },
        { id: 'U2', header: 'U2', unit: 'mV' },
        { id: 'U3', header: 'U3', unit: 'mV' },
        { id: 'U4', header: 'U4', unit: 'mV' },
        { id: 'UH', header: 'UH', unit: 'mV', kind: 'derived', expression: '(U1 - U2 + U3 - U4) / 4', formulaLatex: 'U_H = \\frac{U_1 - U_2 + U_3 - U_4}{4}' },
      ],
    },
    {
      id: 'calib',
      title: '电磁铁标定（固定 I，改变 IM）',
      hint: 'IM 用 A，U1~U4 用 mV；B 自动按 B=UH/(KH·I) 派生（T）。mV/mA 数值上等于 V/A。',
      defaultRows: 8,
      columns: [
        { id: 'IM', header: 'IM', unit: 'A' },
        { id: 'U1', header: 'U1', unit: 'mV' },
        { id: 'U2', header: 'U2', unit: 'mV' },
        { id: 'U3', header: 'U3', unit: 'mV' },
        { id: 'U4', header: 'U4', unit: 'mV' },
        { id: 'UH', header: 'UH', unit: 'mV', kind: 'derived', expression: '(U1 - U2 + U3 - U4) / 4' },
        { id: 'Bcal', header: 'B', unit: 'T', kind: 'derived', expression: 'UH / (KH * Ical)', formulaLatex: 'B = \\frac{U_H}{K_H I}' },
      ],
    },
    {
      id: 'mr',
      title: '磁阻数据（AC 恒流）',
      hint: 'B 用 mT；UAC、IAC 用 mV、mA → R=UAC/IAC（Ω）；MR=ΔR/R(0)。BD 按讲义要求短路。',
      defaultRows: 8,
      columns: [
        { id: 'Bm', header: 'B', unit: 'mT' },
        { id: 'UAC', header: 'UAC', unit: 'mV' },
        { id: 'IAC', header: 'IAC', unit: 'mA' },
        { id: 'R', header: 'R(B)', unit: 'Ω', kind: 'derived', expression: 'UAC / IAC', formulaLatex: 'R(B) = U_{AC}/I_{AC}' },
        { id: 'MR', header: 'ΔR/R(0)', unit: '', kind: 'derived', expression: '(R - R0) / R0', formulaLatex: '\\frac{\\Delta R}{R(0)} = \\frac{R(B)-R(0)}{R(0)}' },
        { id: 'Bsq', header: 'B²', unit: 'mT²', kind: 'derived', expression: 'Bm^2' },
      ],
    },
  ],
  fits: [
    { id: 'uhI-fit', title: 'UH–I 线性拟合（固定 B）', tableId: 'uhI', xCol: 'I', yCol: 'UH', mode: 'ols', modelLatex: 'U_H = a + b\\,I' },
    { id: 'mr-low', title: '弱磁场：MR–B² 拟合', tableId: 'mr', xCol: 'Bsq', yCol: 'MR', mode: 'ols', modelLatex: '\\Delta R/R(0) = a + b\\,B^2' },
    { id: 'mr-high', title: '强磁场：MR–B 拟合', tableId: 'mr', xCol: 'Bm', yCol: 'MR', mode: 'ols', modelLatex: '\\Delta R/R(0) = a + b\\,B' },
  ],
  plots: [
    { id: 'uhI-plot', title: 'UH–I 特性曲线', tableId: 'uhI', xCol: 'I', yCol: 'UH', xLabel: 'I (mA)', yLabel: 'UH (mV)', fitId: 'uhI-fit', fitLabel: 'y = a + bx' },
    { id: 'calib-plot', title: 'B–IM 电磁铁标定曲线', tableId: 'calib', xCol: 'IM', yCol: 'Bcal', xLabel: 'IM (A)', yLabel: 'B (T)' },
    { id: 'mr-plot', title: '磁阻 MR–B', tableId: 'mr', xCol: 'Bm', yCol: 'MR', xLabel: 'B (mT)', yLabel: 'ΔR/R(0)' },
    { id: 'mr-b2-plot', title: '弱场 MR–B²', tableId: 'mr', xCol: 'Bsq', yCol: 'MR', xLabel: 'B² (mT²)', yLabel: 'ΔR/R(0)', fitId: 'mr-low', fitLabel: '线性段' },
  ],
  steps: [
    {
      id: 'setup', title: '仪器与几何参数',
      blocks: [
        { type: 'safety', items: ['工作电流不得超过额定值', '电磁铁避免长时间通电过热'] },
        { type: 'params', fields: ['d', 'B'], title: '霍尔片与磁场参数' },
        { type: 'note', text: '内部统一 SI 计算：mm→m、mT→T、mV→V、mA→A。mV/mA 数值上等于 V/A，避免数量级错误（AGENTS §21.4）。' },
      ],
    },
    {
      id: 'uh-i', title: 'UH–I 数据',
      blocks: [
        { type: 'table', tableId: 'uhI' },
        { type: 'fits', fitIds: ['uhI-fit'] },
        { type: 'plot', plotId: 'uhI-plot' },
      ],
    },
    {
      id: 'hall-params', title: '霍尔参数',
      blocks: [
        { type: 'results', resultIds: ['KH', 'RH', 'n', 'carrier-type'], title: '由拟合斜率求霍尔参数' },
      ],
    },
    {
      id: 'carrier', title: '载流子类型判断',
      blocks: [
        { type: 'note', text: '按讲义规定：由 UH（四换向组合后）与 I、B 的方向关系判断载流子类型——若电流沿 X、磁场沿 Z，UH 沿 Y 的正负与 RH 符号一致：RH<0 为电子型（n 型），RH>0 为空穴型（p 型）。请在报告中结合实测方向记录判断过程，本工具不替你做实验判断。' },
        { type: 'results', resultIds: ['carrier-type'] },
      ],
    },
    {
      id: 'calibration', title: '电磁铁标定',
      blocks: [
        { type: 'params', fields: ['Ical', 'KH'], title: '标定参数（KH 留空则自动用拟合值）' },
        { type: 'table', tableId: 'calib' },
        { type: 'plot', plotId: 'calib-plot' },
        { type: 'results', resultIds: ['KH-used'] },
      ],
    },
    {
      id: 'field-dist', title: '磁场分布（选做）',
      blocks: [
        { type: 'note', text: '选做内容：可在"数据处理 → 线性拟合"中粘贴 (位置, B) 数据进行观察。本模板不预设唯一处理方式。' },
      ],
    },
    {
      id: 'mobility', title: '迁移率（开放设计）',
      blocks: [
        { type: 'note', text: '讲义要求自行设计迁移率测量方案，未给固定计算式（v1 标为"开放设计"）。可用"数据处理 → 不确定度传播"输入自定义公式，如 μ = |RH|/ρ（需测电导率）等，自行论证。' },
      ],
    },
    {
      id: 'mr', title: '磁阻测量',
      blocks: [
        { type: 'params', fields: ['R0'], title: '零场电阻' },
        { type: 'table', tableId: 'mr' },
        { type: 'plot', plotId: 'mr-plot' },
        { type: 'plot', plotId: 'mr-b2-plot' },
        { type: 'fits', fitIds: ['mr-low', 'mr-high'] },
        { type: 'results', resultIds: ['mr-summary'] },
      ],
    },
  ],
  compute: (state: ExperimentState, profile: StandardProfile): ExperimentComputation => {
    const results = [];
    const fits: Record<string, ComputedFit> = {};
    const diagnostics: string[] = [];
    const { scope, missing } = parseParams(
      [{ id: 'd' }, { id: 'B' }, { id: 'Ical' }, { id: 'R0' }, { id: 'KH' }],
      state.params,
    );
    const dM = (scope.d ?? NaN) * 1e-3; // mm → m
    const BT = (scope.B ?? NaN) * 1e-3; // mT → T
    const Ical = scope.Ical ?? NaN; // mA（与 UH mV 配套）

    // --- UH–I 拟合 ---
    const uhI = parseTable(HallExperiment.datasets[0], state, {});
    let KHfit: number | null = null;
    let KHfromFit = false;
    const fitRes = runFit(HallExperiment.fits[0], uhI);
    if ('ols' in fitRes && fitRes.ols) {
      fits['uhI-fit'] = fitRes;
      const f = fitRes.ols;
      // b 数值 = mV/mA = V/A → KH = b/B (m³/C)
      KHfit = f.b / BT;
      KHfromFit = true;
      const dKH = f.deltaB / BT; // B 视为常数时 ΔKH = Δb/B
      results.push(makeResult({
        id: 'KH',
        title: '霍尔灵敏度 KH（由拟合斜率）',
        symbol: 'K_H',
        unit: 'm³/C',
        finalText: formatMeasurement(KHfit, dKH, profile.sigfig).text,
        steps: [
          {
            formulaLatex: 'K_H = \\frac{b}{B}',
            substitution: `b=${f.b.toPrecision(8)} mV/mA（=V/A），B=${BT.toPrecision(6)} T`,
            unrounded: `KH = ${KHfit.toPrecision(10)} m³/C`,
          },
        ],
        components: [
          { symbol: '\\Delta b', label: `拟合斜率不确定度（t=${f.t.toPrecision(6)}, ν=${f.dof}）`, value: f.deltaB },
        ],
        provenance: { status: 'source-explicit', document: DOC, section: '霍尔效应' },
      }));
      if (Number.isFinite(dM) && dM > 0) {
        const RH = KHfit * dM;
        const dRH = dKH * dM; // 厚度视为准确
        results.push(makeResult({
          id: 'RH',
          title: '霍尔系数 RH',
          symbol: 'R_H',
          unit: 'm³/C',
          finalText: formatMeasurement(RH, dRH, profile.sigfig).text,
          steps: [
            {
              formulaLatex: 'R_H = K_H\\, d',
              substitution: `KH=${KHfit.toPrecision(8)} m³/C，d=${dM.toPrecision(4)} m`,
              unrounded: `RH = ${RH.toPrecision(10)} m³/C`,
            },
          ],
          provenance: { status: 'source-explicit', document: DOC },
        }));
        const n = 1 / (E_CHARGE * Math.abs(RH));
        // Δn = |dn/dRH|·ΔRH = ΔRH/(e·RH²)
        const dn = dRH / (E_CHARGE * RH * RH);
        results.push(makeResult({
          id: 'n',
          title: '载流子浓度 n（A≈1 近似）',
          symbol: 'n',
          unit: 'm⁻³',
          finalText: formatMeasurement(n, Math.abs(dn), profile.sigfig).text,
          steps: [
            {
              formulaLatex: 'n = \\frac{1}{|e|\\, R_H}',
              substitution: `e=${E_CHARGE} C（精确），RH=${RH.toPrecision(8)} m³/C`,
              unrounded: `n = ${n.toExponential(8)} m⁻³`,
            },
          ],
          ruleNotes: ['课程实验近似取霍尔因子 A≈1'],
          provenance: { status: 'source-explicit', document: DOC },
        }));
      }
      results.push(makeResult({
        id: 'carrier-type',
        title: '载流子类型（按 RH 符号）',
        finalText: '',
        steps: [{
          formulaLatex: 'R_H = \\frac{U_H d}{I B}',
          substitution: `拟合截距 a=${f.a.toPrecision(6)} mV（理论上≈0，偏大提示残余附加电压）`,
          note: Number.isFinite(KHfit) ? (KHfit < 0 ? 'KH<0 → 电子导电（n 型）。请结合讲义规定的方向约定在报告中确认。' : 'KH>0 → 空穴导电（p 型）。请结合讲义规定的方向约定在报告中确认。') : '',
        }],
        provenance: { status: 'source-explicit', document: DOC },
      }));
      if (Math.abs(f.a) > 3 * f.sa) {
        diagnostics.push(`UH–I 拟合截距 |a|=${f.a.toPrecision(4)} mV 相对 Sa=${f.sa.toPrecision(3)} 偏大，提示四换向组合未完全消除附加电压或零点漂移`);
      }
    }

    // --- 电磁铁标定 ---
    const KHused = scope.KH ?? KHfit ?? NaN;
    const calib = parseTable(HallExperiment.datasets[1], state, {
      KH: KHused,
      Ical,
    });
    const calibRows = calib.rows.filter((r) => Number.isFinite(r.Bcal));
    if (calibRows.length > 0 && Number.isFinite(KHused)) {
      results.push(makeResult({
        id: 'KH-used',
        title: '标定所用 KH',
        symbol: 'K_H',
        unit: 'm³/C',
        finalText: KHused.toPrecision(8),
        steps: [{
          formulaLatex: 'B = \\frac{U_H}{K_H I}',
          substitution: `已标定 ${calibRows.length} 个 B 点；KH 来源：${scope.KH !== undefined ? '用户输入' : KHfromFit ? 'UH–I 拟合斜率' : '—'}`,
          note: `I=${Ical} mA（固定）`,
        }],
        provenance: { status: 'source-explicit', document: DOC },
      }));
    }

    // --- 磁阻 ---
    const mr = parseTable(HallExperiment.datasets[2], state, { R0: scope.R0 ?? NaN });
    const mrRows = mr.rows.filter((r) => Number.isFinite(r.MR) && Number.isFinite(r.Bm));
    if (mrRows.length >= 3) {
      const fitLow = runFit(HallExperiment.fits[1], mr);
      const fitHigh = runFit(HallExperiment.fits[2], mr);
      if ('ols' in fitLow && fitLow.ols) fits['mr-low'] = fitLow;
      if ('ols' in fitHigh && fitHigh.ols) fits['mr-high'] = fitHigh;
      results.push(makeResult({
        id: 'mr-summary',
        title: '磁阻分析',
        finalText: '',
        steps: [
          {
            formulaLatex: '\\frac{\\Delta R}{R(0)} \\propto B^2 \\;(\\text{弱场}),\\quad \\propto B\\;(\\text{强场})',
            substitution: `有效数据 ${mrRows.length} 点；弱场拟合 r=${(fits['mr-low'] as { ols?: { r: number } })?.ols?.r.toPrecision(4) ?? '—'}，强场拟合 r=${(fits['mr-high'] as { ols?: { r: number } })?.ols?.r.toPrecision(4) ?? '—'}`,
            note: '工作条件：AC 恒流源供电，BD 短路（按讲义）',
          },
        ],
        provenance: { status: 'source-explicit', document: DOC, section: '磁电阻测量' },
      }));
      if (mrRows.length >= 3) {
        const lo = (fits['mr-low'] as { ols?: { r: number } })?.ols;
        if (lo && Math.abs(lo.r) < 0.99) diagnostics.push('弱场 MR–B² 线性度 |r| 偏低，检查是否混入强场数据点');
      }
    }

    if (missing.includes('d')) diagnostics.push('未填写霍尔片厚度 d，无法计算 RH 与 n');
    return { results, fits, custom: {}, diagnostics };
  },
};
