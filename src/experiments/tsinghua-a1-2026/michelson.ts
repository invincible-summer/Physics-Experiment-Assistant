/** 实验：迈克尔逊干涉实验（plan §10.7）— 调节流程 checklist + 计算工具 + 常驻安全条 */
import { ExperimentDefinition, ExperimentState, ExperimentComputation } from '../types';
import { parseParams } from '../engine';
import { makeResult } from '../../core/results';
import { formatMeasurement } from '../../core/sigfig';
import { StandardProfile } from '../../standards/types';

const DOC = '2026秋物理实验A(1)教学资料';

/** 光路调节 checklist（每步含讲义操作要点） */
export const MICHELSON_CHECKLIST: { id: string; label: string; tip: string }[] = [
  { id: 'laser-level', label: '激光调水平', tip: '等高共轴，光斑打在分光板中心' },
  { id: 'spatial-filter', label: '空间滤波（小孔+短焦透镜）', tip: '扩束并滤除高频，得到均匀亮斑' },
  { id: 'collimate', label: '准直', tip: '出射为平行光，光斑大小随距离基本不变' },
  { id: 'beam-split', label: '分光与两臂调节', tip: '两反射镜回光亮点与光源像重合' },
  { id: 'mirror-return', label: '两反射镜回光', tip: '微调两镜背后螺钉，使最亮的亮点重合' },
  { id: 'spot-coincide', label: '光斑重合', tip: '重合后视场中出现干涉条纹' },
  { id: 'fringes', label: '出现干涉条纹', tip: '微调拉成适当大小的圆环（等倾）' },
  { id: 'point-source', label: '点光源非定域条纹', tip: '观察屏上同心圆环；改变 d 看条纹吞吐' },
  { id: 'sodium-equal', label: '（可选）钠光等倾条纹', tip: '钠灯扩展光源，调到等倾圆环清晰' },
  { id: 'white-light', label: '（可选）白光干涉', tip: '缓慢移动动镜寻找零光程差彩色条纹' },
];

const MICHELSON_SAFETY = [
  '激光高压电源危险：接线与调节必须在断电时进行',
  '严禁激光直射眼睛，也不可通过光学元件直视光源',
  '钠灯工作时高温，冷却前勿触摸、勿频繁开关',
  '光学表面（分光板、补偿板、反射镜）勿用手触摸，灰尘用洗耳球清除',
  '磁座拆装双手操作，防止砸落',
];

export const MichelsonExperiment: ExperimentDefinition = {
  id: 'michelson',
  version: 1,
  title: '迈克尔逊干涉实验',
  subtitle: '光路流程 checklist · 波长测量 · 玻片参数',
  category: '光学',
  tags: ['干涉计数', 'checklist 流程', '安全常驻'],
  reportType: 'minimal',
  safety: MICHELSON_SAFETY,
  provenance: { status: 'source-explicit', document: DOC, section: '实验七 迈克尔逊干涉实验' },
  metadataFields: [
    { id: 'name', label: '姓名', kind: 'text' },
    { id: 'studentId', label: '学号', kind: 'text' },
    { id: 'date', label: '实验日期', kind: 'text' },
  ],
  params: [
    { id: 'dk', label: '波长测量：条纹变化数 Δk', unit: '', defaultText: '100' },
    { id: 'lam', label: '已知波长 λ（反算 Δd 时填写）', unit: 'nm', defaultText: '632.8' },
    { id: 'dStart', label: '动镜起点位置 d1', unit: 'mm', defaultText: '' },
    { id: 'dEnd', label: '动镜终点位置 d2', unit: 'mm', defaultText: '' },
    { id: 'dInst', label: '位置读数仪器误差限 Δ仪', unit: 'mm', defaultText: '0.0005', hint: '按仪器说明书；常见 0.0005 mm' },
    { id: 'nPlate', label: '白光玻片折射率 n（解 l 时填写）', unit: '', defaultText: '1.5' },
    { id: 'lPlate', label: '白光玻片厚度 l（解 n 时填写）', unit: 'mm', defaultText: '' },
    { id: 'ddPlate', label: '白光实验：出现条纹的 Δd', unit: 'mm', defaultText: '' },
    { id: 'thetaObs', label: '等倾光程差计算：出射角 θ', unit: 'deg', defaultText: '0' },
    { id: 'dObs', label: '等倾光程差计算：空气膜厚 d', unit: 'mm', defaultText: '' },
  ],
  datasets: [],
  fits: [],
  plots: [],
  steps: [
    {
      id: 'safety-checklist', title: '安全与光路流程',
      blocks: [
        { type: 'safety', items: MICHELSON_SAFETY },
        { type: 'custom', component: 'michelson-checklist' },
        { type: 'note', text: '以上要点来自讲义，但操作规范以教师现场要求为准。' },
      ],
    },
    {
      id: 'wavelength', title: '波长测量 λ=2Δd/Δk',
      blocks: [
        { type: 'params', fields: ['dk', 'dStart', 'dEnd', 'dInst'], title: '动镜位置与条纹计数' },
        { type: 'results', resultIds: ['wavelength'] },
        { type: 'params', fields: ['lam'], title: '反算 Δd（已知 λ）' },
        { type: 'results', resultIds: ['dd-from-lam'] },
      ],
    },
    {
      id: 'path-diff', title: '等倾光程差',
      blocks: [
        { type: 'params', fields: ['thetaObs', 'dObs'] },
        { type: 'results', resultIds: ['path-diff'] },
        { type: 'note', text: '等倾 δ=2d·cosθ；中心条纹 2d=kλ；等厚近轴 δ≈2d−dθ²，近交线 δ≈2d。' },
      ],
    },
    {
      id: 'white-light', title: '白光干涉：玻片参数',
      blocks: [
        { type: 'params', fields: ['ddPlate', 'nPlate', 'lPlate'], title: 'Δd=l(n−1)：填 n 解 l，或填 l 解 n' },
        { type: 'results', resultIds: ['plate'] },
      ],
    },
  ],
  compute: (state: ExperimentState, profile: StandardProfile): ExperimentComputation => {
    const results = [];
    const diagnostics: string[] = [];
    const { scope } = parseParams(MichelsonExperiment.params.map((p) => ({ id: p.id })), state.params);

    // 波长
    if ([scope.dk, scope.dStart, scope.dEnd].every((v) => Number.isFinite(v)) && scope.dk > 0) {
      const dd = Math.abs(scope.dEnd - scope.dStart) * 1e-3; // mm→m
      const lam = (2 * dd) / scope.dk;
      const dInst = (scope.dInst ?? 0.0005) * 1e-3;
      // Δd 是两位置之差：B 分量 √2×Δ仪；Δk 无误差（整数计数）
      const ddd = Math.SQRT2 * dInst;
      const dlam = (2 * ddd) / scope.dk;
      results.push(makeResult({
        id: 'wavelength',
        title: '光源波长 λ',
        symbol: '\\lambda',
        unit: 'm',
        finalText: formatMeasurement(lam, dlam, profile.sigfig).text,
        steps: [
          {
            formulaLatex: '\\lambda = \\frac{2\\,\\Delta d}{\\Delta k}',
            substitution: `Δd=|${scope.dEnd}−${scope.dStart}| mm=${dd.toPrecision(8)} m，Δk=${scope.dk}`,
            unrounded: `λ = ${lam.toPrecision(12)} m；Δ(Δd)=√2×${scope.dInst} mm → Δλ=${dlam.toPrecision(10)} m`,
          },
        ],
        provenance: { status: 'source-explicit', document: DOC },
      }));
      if (lam > 400e-9 && lam < 700e-9) {
        // 合理范围
      } else {
        diagnostics.push(`λ=${lam.toExponential(3)} m 超出可见光范围，检查 Δk 与位置读数`);
      }
    }
    // 反算 Δd
    if (Number.isFinite(scope.lam) && Number.isFinite(scope.dk) && scope.dk > 0) {
      const lamM = scope.lam * 1e-9;
      const dd = (lamM * scope.dk) / 2;
      results.push(makeResult({
        id: 'dd-from-lam',
        title: '已知 λ 反算动镜行程 Δd',
        finalText: `Δd = ${dd.toPrecision(8)} m = ${(dd * 1e3).toPrecision(8)} mm`,
        steps: [{
          formulaLatex: '\\Delta d = \\frac{\\lambda\\,\\Delta k}{2}',
          substitution: `λ=${scope.lam} nm，Δk=${scope.dk}`,
        }],
        provenance: { status: 'source-explicit', document: DOC },
      }));
    }
    // 等倾光程差
    if (Number.isFinite(scope.dObs)) {
      const dM = scope.dObs * 1e-3;
      const thetaRad = ((scope.thetaObs ?? 0) * Math.PI) / 180;
      const delta = 2 * dM * Math.cos(thetaRad);
      results.push(makeResult({
        id: 'path-diff',
        title: '等倾干涉光程差 δ',
        symbol: '\\delta',
        unit: 'm',
        finalText: delta.toPrecision(8),
        steps: [{
          formulaLatex: '\\delta = 2 d \\cos\\theta',
          substitution: `d=${scope.dObs} mm，θ=${scope.thetaObs}°=${thetaRad.toPrecision(6)} rad`,
          unrounded: `δ = ${delta.toPrecision(12)} m；中心 θ=0 时 δ=2d`,
        }],
        provenance: { status: 'source-explicit', document: DOC },
      }));
    }
    // 白光玻片
    if (Number.isFinite(scope.ddPlate) && scope.ddPlate !== 0) {
      const dd = scope.ddPlate * 1e-3;
      if (Number.isFinite(scope.nPlate) && scope.nPlate > 1 && !Number.isFinite(scope.lPlate)) {
        const l = dd / (scope.nPlate - 1);
        results.push(makeResult({
          id: 'plate',
          title: '白光干涉：玻片厚度 l',
          symbol: 'l',
          unit: 'm',
          finalText: (l * 1e3).toPrecision(8) + ' mm',
          steps: [{
            formulaLatex: "\\delta' = 2\\,l(n-1),\\quad \\Delta d = l(n-1)",
            substitution: `Δd=${scope.ddPlate} mm，n=${scope.nPlate}`,
            unrounded: `l = ${l.toPrecision(10)} m`,
          }],
          provenance: { status: 'source-explicit', document: DOC },
        }));
      } else if (Number.isFinite(scope.lPlate) && scope.lPlate > 0) {
        const l = scope.lPlate * 1e-3;
        const n = 1 + dd / l;
        results.push(makeResult({
          id: 'plate',
          title: '白光干涉：玻片折射率 n',
          symbol: 'n',
          finalText: n.toPrecision(8),
          steps: [{
            formulaLatex: 'n = 1 + \\frac{\\Delta d}{l}',
            substitution: `Δd=${scope.ddPlate} mm，l=${scope.lPlate} mm`,
            unrounded: `n = ${n.toPrecision(10)}`,
          }],
          provenance: { status: 'source-explicit', document: DOC },
        }));
      }
    }
    return { results, fits: {}, custom: {}, diagnostics };
  },
};
