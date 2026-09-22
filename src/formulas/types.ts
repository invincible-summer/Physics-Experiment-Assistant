/** 公式系统类型（AGENTS.md §8：公式不得散落在 JSX 中，由版本化注册表驱动；plan §5 domain/topic 架构） */
import { Provenance } from '../standards/types';

export interface VariableDefinition {
  /** 表达式符号（mathjs 变量名，如 UH） */
  name: string;
  /** 中文名 */
  label: string;
  /** 默认单位 */
  unit: string;
  /** 单位族（UI 下拉；空字符串为无量纲） */
  unitFamily?: string;
  /** 温差只缩放，绝对温度采用温标偏移。 */
  quantityKind?: 'temperature-difference';
  /** 物理约束说明 */
  constraint?: string;
  note?: string;
  /** 预填默认值 */
  defaultValue?: number;
}

export interface ConstantDefinition {
  name: string;
  label: string;
  value: number;
  isExact: boolean;
  unit?: string;
}

export interface FormulaConstraint {
  /** 校验表达式（用变量名，求值后需为真），如 "x > 0" */
  expression: string;
  message: string;
}

export interface UncertaintyCapability {
  /** 是否支持偏导传播 */
  propagatable: boolean;
  note?: string;
}

/**
 * 列聚合输入（AGENTS §11 数据处理工具化）：
 * 允许用户直接粘贴原始数据列，由系统派生出公式变量（如平均值的 S、n），
 * 而不是要求用户手工先求和。派生函数必须返回完整浮点值，不修约。
 */
export interface AggregateCapability {
  /** 数据列定义（1 或 2 列，用于 DataGrid 表头） */
  columns: { id: string; label: string }[];
  /** 由数据列派生变量值；数据不足返回 null */
  derive: (columns: number[][]) => Record<string, number> | null;
  /** UI 说明：将派生哪些变量 */
  note: string;
}

export interface FormulaExample {
  title: string;
  inputs: Record<string, number>;
  expect: number;
  note?: string;
}

/** 主结果显式元数据（plan §5.2：收回 FormulaDefinition，废除 result-units 双数据源） */
export interface FormulaResult {
  /** 主结果符号 LaTeX，如 '\\Delta_A' */
  symbol: string;
  /** 主结果中文名 */
  label: string;
  /** 主结果默认单位（'' 为无量纲） */
  unit: string;
  /** 温差语义标记 */
  quantityKind?: 'temperature-difference';
}

/** 一级学科域（plan §5.1：稳定、数量少） */
export type FormulaDomain =
  | 'measurement'
  | 'mechanics'
  | 'thermal'
  | 'electromagnetism'
  | 'oscillations-waves'
  | 'optics'
  | 'modern'
  | 'standards';

export const DOMAIN_LABELS: Record<FormulaDomain, string> = {
  measurement: '测量与数据处理',
  mechanics: '力学',
  thermal: '热学',
  electromagnetism: '电磁学',
  'oscillations-waves': '振动与波',
  optics: '光学',
  modern: '近代物理',
  standards: '测量标准',
};

export interface TopicDef {
  id: string;
  label: string;
}

/** 各域二级专题（plan §5.1：可扩展；未列出的公式不允许注册） */
export const DOMAIN_TOPICS: Record<FormulaDomain, TopicDef[]> = {
  measurement: [
    { id: 'statistics', label: '统计量' },
    { id: 'uncertainty', label: '不确定度' },
    { id: 'instruments', label: '仪器误差' },
    { id: 'data-processing', label: '数据处理' },
  ],
  mechanics: [
    { id: 'kinematics', label: '运动学' },
    { id: 'dynamics', label: '动力学' },
    { id: 'energy-momentum', label: '功、能与动量' },
    { id: 'rotation', label: '转动' },
    { id: 'gravity', label: '万有引力' },
    { id: 'elasticity', label: '弹性与模量' },
    { id: 'fluids', label: '流体' },
    { id: 'friction', label: '摩擦' },
  ],
  thermal: [
    { id: 'gas', label: '气体动理论' },
    { id: 'heat-transfer', label: '量热与传热' },
    { id: 'thermodynamics', label: '热力学定律' },
  ],
  electromagnetism: [
    { id: 'electrostatics', label: '静电场' },
    { id: 'potential-capacitance', label: '电势与电容' },
    { id: 'circuits', label: '直流与暂态电路' },
    { id: 'magnetism', label: '磁场' },
    { id: 'hall', label: '霍尔与磁阻' },
    { id: 'induction', label: '电磁感应与电感' },
    { id: 'ac', label: '交流电路' },
    { id: 'em-waves', label: '电磁波' },
  ],
  'oscillations-waves': [
    { id: 'oscillations', label: '振动' },
    { id: 'waves', label: '机械波' },
    { id: 'sound', label: '声学' },
    { id: 'oscilloscope', label: '示波器' },
  ],
  optics: [
    { id: 'geometric', label: '几何光学' },
    { id: 'interference', label: '干涉' },
    { id: 'diffraction', label: '衍射' },
    { id: 'polarization', label: '偏振' },
  ],
  modern: [
    { id: 'relativity', label: '狭义相对论' },
    { id: 'quantum', label: '量子基础' },
    { id: 'atomic', label: '原子' },
    { id: 'solid', label: '固体与半导体' },
    { id: 'nuclear', label: '原子核' },
  ],
  standards: [
    { id: 'gbt', label: 'GB/T 27418' },
  ],
};

export function topicLabel(domain: FormulaDomain, topic: string): string {
  return DOMAIN_TOPICS[domain].find((t) => t.id === topic)?.label ?? topic;
}

/**
 * 计算类型（plan §5.3）：
 * - computable：可填变量求值的标量公式（expression 必填）；
 * - reference：重要但不适合硬凑数值计算的积分/微分方程形式（无计算器，展示符号与适用条件）。
 */
export type FormulaKind = 'computable' | 'reference';

export interface FormulaDefinition {
  id: string;
  version: number;
  title: string;
  aliases: string[];
  /** 一级学科域 */
  domain: FormulaDomain;
  /** 二级专题（DOMAIN_TOPICS 中登记过的 id） */
  topic: string;
  /** 搜索辅助词 */
  tags?: string[];
  /** computable / reference */
  kind: FormulaKind;
  /** 公式 LaTeX（等式形式） */
  latex: string;
  /** 安全表达式来源（对 result.symbol 解出；computable 必填，reference 禁止） */
  expression?: string;
  /** 主结果元数据（computable 必填） */
  result?: FormulaResult;
  variables: VariableDefinition[];
  constants?: ConstantDefinition[];
  /** 可解目标变量（reference 恒为空） */
  solveFor: string[];
  /** 各目标的显式解表达式（缺失时退回数值求根） */
  solutions?: Record<string, string>;
  constraints?: FormulaConstraint[];
  uncertainty?: UncertaintyCapability;
  /** 可选：从原始数据列自动派生输入变量（如 S=Σxi、n=计数） */
  aggregates?: AggregateCapability;
  provenance: Provenance;
  examples?: FormulaExample[];
  /** 适用条件 */
  conditions?: string;
  /** 自定义计算（需要特殊函数如 tQuantile 的公式） */
  customCompute?: (inputs: Record<string, number>) => number;
}

/** 构造辅助：默认 version=1、空别名、computable */
export function F(def: Omit<FormulaDefinition, 'version' | 'aliases' | 'kind'> & {
  version?: number; aliases?: string[]; kind?: FormulaKind;
}): FormulaDefinition {
  return { version: 1, aliases: [], kind: 'computable', ...def };
}
