/** 力学 · 摩擦（domain: mechanics / topic: friction）— 摩擦系数实验课程公式 */
import { F, FormulaDefinition } from '../types';
import { COURSE_DEFAULT_G } from '../../physics/constants';

const DOC = '2026秋物理实验A(1)教学资料';

export const FRICTION_FORMULAS: FormulaDefinition[] = [
  F({
    id: 'weight-from-mass',
    title: '重力（由砝码质量求力）',
    domain: 'mechanics',
    topic: 'friction',
    tags: ['重力', '砝码'],
    latex: 'W = M_W\\, g,\\quad P = M_P\\, g',
    expression: 'm * g',
    result: { symbol: 'W', label: '重力', unit: 'N' },
    variables: [
      { name: 'm', label: '砝码质量 M（g 或 kg，与 g 单位制一致）', unit: 'kg' },
      { name: 'g', label: '重力加速度', unit: 'm/s2', defaultValue: COURSE_DEFAULT_G },
    ],
    solveFor: ['m'],
    solutions: { m: 'W / g' },
    provenance: { status: 'source-explicit', document: DOC, section: '摩擦系数测量' },
    examples: [
      { title: '800 g 砝码、g=9.8', inputs: { m: 0.8, g: 9.8 }, expect: 7.84 },
    ],
  }),
  F({
    id: 'capstan',
    title: 'Capstan 摩擦关系（绳绕圆柱）',
    aliases: ['欧拉摩擦公式', '绞盘公式'],
    domain: 'mechanics',
    topic: 'friction',
    tags: ['摩擦系数', '包角', '绞盘'],
    latex: 'P = W\\, e^{-\\mu\\theta} \\quad\\Leftrightarrow\\quad \\mu = -\\frac{\\ln(P/W)}{\\theta}',
    expression: 'W * exp(-mu * theta)',
    result: { symbol: 'P', label: '临界张力', unit: 'N' },
    variables: [
      { name: 'W', label: '一侧张力 W', unit: 'N' },
      { name: 'mu', label: '摩擦系数 μ', unit: '' },
      { name: 'theta', label: '包角 θ（rad）', unit: 'rad' },
    ],
    solveFor: ['mu', 'W', 'theta'],
    solutions: {
      mu: '-ln(P / W) / theta',
      W: 'P * exp(mu * theta)',
      theta: '-ln(P / W) / mu',
    },
    provenance: {
      status: 'source-derived',
      document: DOC,
      section: '摩擦系数测量',
      note: '由实验任务意图（临界平衡）与通用柔索摩擦模型推导，非讲义原式',
    },
    conditions: 'θ 为绳与圆柱接触的包角（弧度）；μ 为静摩擦系数',
    examples: [
      { title: 'θ=π 临界平衡', inputs: { W: 7.848, mu: 0.2, theta: Math.PI }, expect: 7.848 * Math.exp(-0.2 * Math.PI) },
    ],
  }),
];
