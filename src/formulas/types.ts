/** 公式系统类型（AGENTS.md §8：公式不得散落在 JSX 中，由版本化注册表驱动） */
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

export interface FormulaDefinition {
  id: string;
  version: number;
  title: string;
  aliases: string[];
  category: FormulaCategory;
  /** 公式 LaTeX（等式形式） */
  latex: string;
  /** 安全表达式来源（对 solveFor[0] 解出） */
  expression: string;
  variables: VariableDefinition[];
  constants?: ConstantDefinition[];
  /** 可解目标变量 */
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

export type FormulaCategory =
  | 'measurement' | 'instruments' | 'friction' | 'hall' | 'thermal'
  | 'oscillation' | 'waves' | 'optics' | 'gbt';

export const CATEGORY_LABELS: Record<FormulaCategory, string> = {
  measurement: '测量与统计',
  instruments: '电学仪器',
  friction: '摩擦',
  hall: '霍尔/磁学',
  thermal: '热学',
  oscillation: '振动',
  waves: '示波器/声速/电路',
  optics: '光学',
  gbt: 'GB/T 27418',
};

/** 构造辅助：默认 version=1、空别名 */
export function F(def: Omit<FormulaDefinition, 'version' | 'aliases'> & { version?: number; aliases?: string[] }): FormulaDefinition {
  return { version: 1, aliases: [], ...def };
}

export const E_CHARGE = 1.602176634e-19; // C（SI 定义值，精确）
export const R_GAS = 8.314462618; // J/(mol·K)
export const G_STANDARD = 9.8; // m/s²（课程默认，可编辑）
