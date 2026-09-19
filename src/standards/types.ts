/**
 * 标准配置（Standard Profile）类型定义。
 *
 * AGENTS.md §3：四个标准配置必须严格隔离，课程模式 ΔB=Δ仪 与 GB/T 矩形分布
 * 不得在同一次计算中混合。配置在类型层面区分 kind。
 */
import { SigFigOptions } from '../core/sigfig';

export type ProfileKind = 'course' | 'gbt' | 'custom';

export interface BTypeRule {
  /**
   * course: ΔB = Δ仪（仪器误差限直接作为 B 类分量）
   * gbt: 按分布换算为标准不确定度
   */
  mode: 'instrument-limit' | 'distribution';
}

export interface SimplificationRule {
  /** 课程允许 ΔA < Δ仪/3 时简化为 Δ=Δ仪（UI 必须显示提示） */
  enabled: boolean;
  threshold: number; // 默认 1/3
  label: string;
}

export interface StandardProfile {
  id: string;
  version: number;
  kind: ProfileKind;
  name: string;
  shortName: string;
  /** 默认置信概率（课程 P=0.95；GB/T 标准不确定度本身无置信概率，扩展时使用） */
  confidence?: number;
  /** 不确定度记号（课程 Δ；GB/T u/U）——严禁混用语义 */
  notation: { direct: string; combined: string; expanded?: string };
  bType: BTypeRule;
  /** ΔA<ΔB/3 简化规则；GB/T 无此规则 */
  simplification?: SimplificationRule;
  sigfig: SigFigOptions;
  /** 设置页摘要（逐条显示） */
  rulesSummary: string[];
  /** 规则来源说明 */
  source: string;
  description: string;
  /** 支持的实验（仅课程 profile 有） */
  supportsExperiments?: string[];
}

export interface Provenance {
  status: 'source-explicit' | 'source-derived' | 'general' | 'experimental';
  document?: string;
  section?: string;
  page?: number;
  equation?: string;
  note?: string;
}

export const PROVENANCE_LABELS: Record<Provenance['status'], string> = {
  'source-explicit': '资料原式',
  'source-derived': '由资料推导',
  general: '通用扩展',
  experimental: '实验性',
};
