/** 跨页面共享的计算结果模型（结果检查器、导出共用） */
import { Provenance } from '../standards/types';

export interface ResultStep {
  /** 公式 LaTeX */
  formulaLatex?: string;
  /** 数值代入（mono 文本） */
  substitution?: string;
  /** 未修约值（全精度） */
  unrounded?: string;
  note?: string;
}

export interface ResultComponent {
  symbol: string;
  label: string;
  value: number;
  formulaLatex?: string;
  substitution?: string;
  /** 贡献率 0~1（传播类） */
  fraction?: number;
}

export interface ResultItem {
  id: string;
  title: string;
  symbol?: string;
  unit?: string;
  /** 最终显示文本（已修约），如 "9.42 ± 0.08" */
  finalText?: string;
  finalValue?: number;
  /** 不确定度文本（若与 finalText 分开显示） */
  uncertaintyText?: string;
  /** 相对不确定度百分文本 */
  relativeText?: string;
  steps: ResultStep[];
  components?: ResultComponent[];
  roundingNote?: string;
  ruleNotes?: string[];
  provenance?: Provenance;
  warnings?: string[];
}

export function makeResult(partial: Omit<ResultItem, 'steps'> & { steps?: ResultStep[] }): ResultItem {
  return { steps: [], ...partial };
}
