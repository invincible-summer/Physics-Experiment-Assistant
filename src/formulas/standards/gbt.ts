/** 测量标准 · GB/T 27418-2017（domain: standards / topic: gbt） */
import { F, FormulaDefinition } from '../types';
import { tQuantile } from '../../core/statistics';

const DOC = 'GB/T 27418-2017 测量不确定度评定和表示';

export const GBT_FORMULAS: FormulaDefinition[] = [
  F({
    id: 'standard-uncertainty-type-a',
    title: 'A 类标准不确定度',
    domain: 'standards',
    topic: 'gbt',
    tags: ['GB/T', '不确定度', 'A 类'],
    latex: 'u_A = u(\\bar{x}) = \\frac{S}{\\sqrt{n}}',
    expression: 'S / sqrt(n)',
    result: { symbol: 'u_A', label: 'A 类标准不确定度', unit: '' },
    variables: [
      { name: 'S', label: '样本标准差 S（贝塞尔）', unit: '' },
      { name: 'n', label: '观测次数 n', unit: '' },
    ],
    solveFor: [],
    provenance: {
      status: 'source-explicit',
      document: DOC,
      note: 'GB/T：A 类即平均值的标准不确定度，不加 t 因子（与课程模式严格区分）',
    },
    examples: [
      { title: 'S=0.02、n=10', inputs: { S: 0.02, n: 10 }, expect: 0.02 / Math.sqrt(10) },
    ],
  }),
  F({
    id: 'rectangular-standard-uncertainty',
    title: '矩形分布 B 类换算',
    domain: 'standards',
    topic: 'gbt',
    tags: ['GB/T', '不确定度', 'B 类'],
    latex: 'u = \\frac{a}{\\sqrt{3}}',
    expression: 'a / sqrt(3)',
    result: { symbol: 'u', label: '标准不确定度', unit: '' },
    variables: [{ name: 'a', label: '半宽 a（界限之半）', unit: '' }],
    solveFor: [],
    provenance: { status: 'source-explicit', document: DOC },
    examples: [
      { title: 'a=0.1 → 0.0577', inputs: { a: 0.1 }, expect: 0.1 / Math.sqrt(3) },
    ],
  }),
  F({
    id: 'triangular-standard-uncertainty',
    title: '三角分布 B 类换算',
    domain: 'standards',
    topic: 'gbt',
    tags: ['GB/T', '不确定度', 'B 类'],
    latex: 'u = \\frac{a}{\\sqrt{6}}',
    expression: 'a / sqrt(6)',
    result: { symbol: 'u', label: '标准不确定度', unit: '' },
    variables: [{ name: 'a', label: '半宽 a', unit: '' }],
    solveFor: [],
    provenance: { status: 'source-explicit', document: DOC },
    examples: [
      { title: 'a=0.1 → 0.0408', inputs: { a: 0.1 }, expect: 0.1 / Math.sqrt(6) },
    ],
  }),
  F({
    id: 'normal-coverage-to-standard',
    title: '正态信息换算标准不确定度',
    domain: 'standards',
    topic: 'gbt',
    tags: ['GB/T', '不确定度', '包含因子'],
    latex: 'u = \\frac{U}{k} \\quad (\\text{给定包含因子 } k)',
    expression: 'a / k',
    result: { symbol: 'u', label: '标准不确定度', unit: '' },
    variables: [
      { name: 'a', label: '扩展区间半宽 U（证书 ±a）', unit: '' },
      { name: 'k', label: '包含因子 k（k=2 ≈ 95%）', unit: '', defaultValue: 2 },
    ],
    solveFor: [],
    provenance: { status: 'source-explicit', document: DOC },
    examples: [
      { title: '证书 ±0.1（k=2）', inputs: { a: 0.1, k: 2 }, expect: 0.05 },
    ],
  }),
  F({
    id: 'combined-standard-uncertainty-independent',
    title: '合成标准不确定度（独立输入）',
    domain: 'standards',
    topic: 'gbt',
    tags: ['GB/T', '合成不确定度'],
    latex: 'u_c^2(y) = \\sum_i c_i^2\\, u^2(x_i)',
    expression: 'sqrt((c1*u1)^2 + (c2*u2)^2 + (c3*u3)^2)',
    result: { symbol: 'u_c', label: '合成标准不确定度', unit: '' },
    variables: [
      { name: 'c1', label: '灵敏度系数 c1', unit: '' },
      { name: 'u1', label: 'u(x1)', unit: '' },
      { name: 'c2', label: '灵敏度系数 c2', unit: '' },
      { name: 'u2', label: 'u(x2)', unit: '' },
      { name: 'c3', label: '灵敏度系数 c3（无第三项填 0）', unit: '' },
      { name: 'u3', label: 'u(x3)', unit: '' },
    ],
    solveFor: [],
    provenance: { status: 'source-explicit', document: DOC, note: '任意表达式请用"数据处理 → 不确定度传播"（GB/T 模式）' },
    examples: [
      { title: '3-4-5 合成', inputs: { c1: 1, u1: 3, c2: 1, u2: 4, c3: 0, u3: 0 }, expect: 5 },
    ],
  }),
  F({
    id: 'combined-standard-uncertainty-correlated',
    title: '合成标准不确定度（相关输入，两项）',
    domain: 'standards',
    topic: 'gbt',
    tags: ['GB/T', '合成不确定度', '相关'],
    latex: 'u_c^2 = c_1^2 u_1^2 + c_2^2 u_2^2 + 2\\, c_1 c_2 r\\, u_1 u_2',
    expression: 'sqrt((c1*u1)^2 + (c2*u2)^2 + 2*c1*c2*r*u1*u2)',
    result: { symbol: 'u_c', label: '合成标准不确定度', unit: '' },
    variables: [
      { name: 'c1', label: '灵敏度系数 c1', unit: '' },
      { name: 'u1', label: 'u(x1)', unit: '' },
      { name: 'c2', label: '灵敏度系数 c2', unit: '' },
      { name: 'u2', label: 'u(x2)', unit: '' },
      { name: 'r', label: '相关系数 r(x1,x2) ∈ [−1,1]', unit: '', defaultValue: 0 },
    ],
    solveFor: [],
    provenance: { status: 'source-explicit', document: DOC, note: 'u(xi,xj) = r·u(xi)·u(xj)' },
    examples: [
      { title: '完全相关 r=1：3+4=7', inputs: { c1: 1, u1: 3, c2: 1, u2: 4, r: 1 }, expect: 7 },
    ],
  }),
  F({
    id: 'effective-dof',
    title: 'Welch–Satterthwaite 有效自由度',
    domain: 'standards',
    topic: 'gbt',
    tags: ['GB/T', '自由度'],
    latex: '\\nu_{eff} = \\frac{u_c^4}{\\sum_i \\frac{c_i^4 u_i^4}{\\nu_i}}',
    expression: 'uc^4 / (u1c^4/nu1 + u2c^4/nu2)',
    result: { symbol: '\\nu_{eff}', label: '有效自由度', unit: '' },
    variables: [
      { name: 'uc', label: '合成标准不确定度 uc', unit: '' },
      { name: 'u1c', label: '分量贡献 c1·u1', unit: '' },
      { name: 'nu1', label: '分量 1 自由度 ν1（∞ 时该项贡献 0，填大数）', unit: '', defaultValue: 1e9 },
      { name: 'u2c', label: '分量贡献 c2·u2', unit: '' },
      { name: 'nu2', label: '分量 2 自由度 ν2', unit: '', defaultValue: 1e9 },
    ],
    solveFor: [],
    provenance: { status: 'source-explicit', document: DOC },
    examples: [
      { title: '单分量 ν=9 主导', inputs: { uc: 1, u1c: 1, nu1: 9, u2c: 0, nu2: 1e9 }, expect: 9 },
    ],
  }),
  F({
    id: 'expanded-uncertainty',
    title: '扩展不确定度',
    domain: 'standards',
    topic: 'gbt',
    tags: ['GB/T', '扩展不确定度'],
    latex: 'U = k\\, u_c \\quad \\text{或} \\quad U_p = t_p(\\nu_{eff})\\, u_c',
    expression: 'k * uc',
    result: { symbol: 'U', label: '扩展不确定度', unit: '' },
    variables: [
      { name: 'uc', label: '合成标准不确定度 uc', unit: '' },
      { name: 'k', label: '包含因子 k', unit: '', defaultValue: 2 },
      { name: 'nu', label: '有效自由度 νeff（用 t 因子时填写）', unit: '', defaultValue: 1e9 },
      { name: 'P', label: '包含概率 p（用 t 因子时）', unit: '', defaultValue: 0.95 },
    ],
    solveFor: [],
    customCompute: (inputs) => {
      const nu = inputs.nu;
      const p = inputs.P ?? 0.95;
      if (Number.isFinite(nu) && nu < 1e8) {
        return tQuantile(Math.max(1, Math.round(nu)), p) * inputs.uc;
      }
      return inputs.k * inputs.uc;
    },
    provenance: {
      status: 'source-explicit',
      document: DOC,
      note: 'νeff 有限时自动用 t_p(νeff)；报告必须注明 U 的含义（k 或 p）',
    },
    examples: [
      { title: 'k=2、uc=0.05', inputs: { uc: 0.05, k: 2, nu: 1e9, P: 0.95 }, expect: 0.1 },
    ],
  }),
];
