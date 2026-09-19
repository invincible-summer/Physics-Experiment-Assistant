/**
 * 实验工作台类型（AGENTS.md §9 声明式定义驱动）。
 *
 * ExperimentDefinition 的 computationGraph 由各实验的 compute() 函数实现
 * （基于 core/ 模块的类型化 DAG 求值），steps/datasets/plots/resultBlocks
 * 驱动 UI 渲染。
 */
import { Provenance } from '../standards/types';
import { ResultItem } from '../core/results';
import { StandardProfile } from '../standards/types';
import { OLSResult, ThroughOriginResult } from '../core/regression';

export interface FieldDefinition {
  id: string;
  label: string;
  unit?: string;
  /** 预填文本 */
  defaultText?: string;
  hint?: string;
  /** 课程给定的仪器误差限说明（不自动等于分辨率） */
  instrumentErrorNote?: string;
  kind?: 'text' | 'number';
}

export interface DatasetColumn {
  id: string;
  header: string;
  unit?: string;
  /** 默认 input */
  kind?: 'input' | 'derived';
  /** 派生表达式：行内变量 = 本表其他列 id；参数用 params.id */
  expression?: string;
  formulaLatex?: string;
  decimals?: number;
}

export interface DatasetDefinition {
  id: string;
  title: string;
  columns: DatasetColumn[];
  defaultRows?: number;
  hint?: string;
}

export interface FitSpec {
  id: string;
  title: string;
  tableId: string;
  xCol: string;
  yCol: string;
  mode: 'ols' | 'origin';
  modelLatex: string;
}

export interface PlotSpec {
  id: string;
  title: string;
  tableId: string;
  xCol: string;
  yCol: string;
  xLabel: string;
  yLabel: string;
  /** 叠加拟合线 */
  fitId?: string;
  fitLabel?: string;
  /** 附加固定系列（compute 提供） */
  extraSeries?: 'none' | 'theory-line';
}

export type StepBlock =
  | { type: 'safety'; items: string[] }
  | { type: 'params'; fields: string[]; title?: string }
  | { type: 'table'; tableId: string }
  | { type: 'fits'; fitIds: string[] }
  | { type: 'plot'; plotId: string }
  | { type: 'results'; resultIds: string[]; title?: string }
  | { type: 'note'; text: string }
  | { type: 'custom'; component: string };

export interface ExperimentStep {
  id: string;
  title: string;
  blocks: StepBlock[];
}

export interface ExperimentState {
  params: Record<string, string>;
  tables: Record<string, string[][]>;
  excludedRows: Record<string, number[]>;
}

export interface ComputedFit {
  spec: FitSpec;
  ols?: OLSResult;
  origin?: ThroughOriginResult;
}

export interface ExperimentComputation {
  results: ResultItem[];
  fits: Record<string, ComputedFit | { error: string }>;
  /** 自定义块数据 */
  custom: Record<string, unknown>;
  diagnostics: string[];
}

export interface ExperimentDefinition {
  id: string;
  version: number;
  title: string;
  subtitle?: string;
  category: string;
  tags: string[];
  reportType: 'minimal' | 'full';
  safety: string[];
  provenance: Provenance;
  metadataFields: FieldDefinition[];
  params: FieldDefinition[];
  steps: ExperimentStep[];
  datasets: DatasetDefinition[];
  fits: FitSpec[];
  plots: PlotSpec[];
  compute: (state: ExperimentState, profile: StandardProfile) => ExperimentComputation;
}

/** 行数据解析（含派生列求值与排除行过滤） */
export interface ParsedTable {
  rows: Record<string, number>[];
  rawRows: Record<string, string>[];
  /** 有效数据行数 */
  n: number;
}
