/**
 * core/uncertainty — 不确定度引擎（策略模式，AGENTS.md §5、plan.md §6.6）。
 *
 * 课程模式（tsinghua-a1-2026）：
 *   ΔA = t_P(ν)·S_x̄；ΔB = Δ仪；Δ = √(ΔA²+ΔB²)；
 *   ΔA<Δ仪/3 简化；单次测量 Δ=Δ仪；已定系统误差先修正。
 * GB/T 模式：
 *   A 类 = 平均值标准不确定度（不加 t）；B 类按分布换算；
 *   独立/相关合成；Welch–Satterthwaite 有效自由度；扩展不确定度 U=k·u_c 或 t_p(νeff)·u_c。
 * 两种模式在类型与配置层面隔离，禁止混算。
 */
import { mean, sampleStd, tQuantile, normalQuantile, combinedStandardUncertainty, welchSatterthwaite } from '../statistics';
import { compileExpression, derivativeOf, evaluateExpression, CompiledExpression } from '../expression';
import { FormattedMeasurement, formatMeasurement, formatSigDigitsPercent, SigFigOptions } from '../sigfig';
import { StandardProfile } from '../../standards/types';

// ---------------------------------------------------------------------------
// 直接测量
// ---------------------------------------------------------------------------

export interface DirectMeasurementInput {
  /** 重复读数（SI 单位数值）。n=1 表示单次测量 */
  readings: number[];
  /** 仪器误差限 Δ仪（课程）或 B 类半宽输入（GB/T 由 distribution 换算） */
  instrumentError?: number;
  /** 已定系统误差修正值（估计值 = mean + correction） */
  correction?: number;
  /** 置信概率（默认取 profile） */
  confidence?: number;
  /** GB/T：B 类分布。课程模式忽略 */
  distribution?: 'normal' | 'rectangular' | 'triangular';
  /** GB/T：正态 B 类给定包含因子 k（如证书 U=±a, k=2 → u=a/2） */
  bTypeCoverageFactor?: number;
  symbol?: string;
  unit?: string;
}

export interface UncertaintyComponent {
  symbol: string;
  label: string;
  /** 分量数值（课程：ΔA/ΔB；GB/T：u 各分量） */
  value: number;
  formulaLatex: string;
  substitution: string;
}

export interface DirectUncertaintyResult {
  n: number;
  rawMean: number;
  correctedMean: number;
  sampleStd: number;
  stdError: number;
  /** 课程 ΔA；GB/T u_A */
  typeA: number;
  /** 课程 ΔB；GB/T u_B */
  typeB: number;
  /** 课程 Δ；GB/T u_c */
  combined: number;
  relative: number;
  /** 课程 t 因子；GB/T 恒 1 */
  tFactor: number;
  dof: number;
  /** ΔA<Δ仪/3 简化是否触发（课程模式） */
  simplified: boolean;
  simplificationNote?: string;
  components: UncertaintyComponent[];
  formatted: FormattedMeasurement;
  /** 规则说明（结果检查器展示） */
  ruleNotes: string[];
  mode: 'course' | 'gbt';
}

/** 课程模式直接量 */
export function courseDirect(
  input: DirectMeasurementInput,
  profile: StandardProfile,
): DirectUncertaintyResult {
  const n = input.readings.length;
  if (n === 0) throw new Error('直接测量：没有读数');
  const p = input.confidence ?? profile.confidence ?? 0.95;
  const rawMean = mean(input.readings);
  const correction = input.correction ?? 0;
  const correctedMean = rawMean + correction; // 已定系统误差先修正
  const ruleNotes: string[] = [];

  let typeA: number;
  let s = 0;
  let sem = 0;
  let tFactor = 1;
  let dof = 0;
  if (n >= 2) {
    s = sampleStd(input.readings);
    sem = s / Math.sqrt(n);
    dof = n - 1;
    tFactor = tQuantile(dof, p);
    typeA = tFactor * sem;
  } else {
    typeA = 0;
    ruleNotes.push('单次测量：无法计算 A 类分量，按课程规则取 Δ = Δ仪');
  }

  const dInstrument = input.instrumentError ?? 0;
  const typeB = dInstrument; // 课程：ΔB = Δ仪

  let combined: number;
  let simplified = false;
  const components: UncertaintyComponent[] = [];
  if (n === 1) {
    combined = dInstrument;
  } else if (typeA < dInstrument / 3 && profile.simplification?.enabled) {
    combined = dInstrument;
    simplified = true;
    ruleNotes.push(
      `ΔA = ${typeA.toPrecision(4)} < Δ仪/3 = ${(dInstrument / 3).toPrecision(4)}，采用课程简化规则：Δ = Δ仪`,
    );
  } else {
    combined = Math.sqrt(typeA * typeA + typeB * typeB);
  }
  if (n >= 2 && !simplified) {
    components.push({
      symbol: 'ΔA',
      label: 'A 类分量',
      value: typeA,
      formulaLatex: '\\Delta_A = t_{0.95}(\\nu)\\,S_{\\bar{x}}',
      substitution: `t=${tFactor.toFixed(4)}，ν=${dof}，S_x̄=${sem.toPrecision(6)}`,
    });
  }
  if (dInstrument > 0) {
    components.push({
      symbol: 'ΔB',
      label: 'B 类分量（仪器误差限）',
      value: typeB,
      formulaLatex: '\\Delta_B = \\Delta_{仪}',
      substitution: `Δ仪=${dInstrument.toPrecision(6)}`,
    });
  }
  const relative = correctedMean !== 0 ? combined / Math.abs(correctedMean) : NaN;
  if (correction !== 0) {
    ruleNotes.push(`已定系统误差修正：x̄(修正) = ${rawMean.toPrecision(8)} + (${correction}) = ${correctedMean.toPrecision(8)}`);
  }
  return {
    n, rawMean, correctedMean, sampleStd: s, stdError: sem,
    typeA, typeB, combined, relative, tFactor, dof, simplified,
    simplificationNote: simplified ? profile.simplification?.label : undefined,
    components,
    formatted: formatMeasurement(correctedMean, combined, profile.sigfig),
    ruleNotes,
    mode: 'course',
  };
}

/** GB/T 模式直接量 */
export function gbtDirect(
  input: DirectMeasurementInput,
  profile: StandardProfile,
): DirectUncertaintyResult {
  const n = input.readings.length;
  if (n === 0) throw new Error('直接测量：没有读数');
  const rawMean = mean(input.readings);
  const correctedMean = rawMean + (input.correction ?? 0);
  const ruleNotes: string[] = [];
  const components: UncertaintyComponent[] = [];

  // A 类：平均值的标准不确定度（不加 t 因子）
  let typeA = 0;
  let s = 0;
  let sem = 0;
  let dof = n - 1;
  if (n >= 2) {
    s = sampleStd(input.readings);
    sem = s / Math.sqrt(n);
    typeA = sem;
    dof = n - 1;
    components.push({
      symbol: 'u_A',
      label: 'A 类标准不确定度',
      value: typeA,
      formulaLatex: 'u_A = S_{\\bar{x}} = S/\\sqrt{n}',
      substitution: `S=${s.toPrecision(6)}，n=${n}`,
    });
  } else {
    dof = 0;
    ruleNotes.push('单次测量：无 A 类分量，B 类按分布换算');
  }

  // B 类：按分布换算
  const a = input.instrumentError ?? 0;
  let typeB = 0;
  if (a > 0) {
    const dist = input.distribution ?? 'rectangular';
    if (dist === 'rectangular') {
      typeB = a / Math.sqrt(3);
      components.push({
        symbol: 'u_B', label: 'B 类（矩形分布）', value: typeB,
        formulaLatex: 'u_B = a/\\sqrt{3}',
        substitution: `a=${a.toPrecision(6)}`,
      });
    } else if (dist === 'triangular') {
      typeB = a / Math.sqrt(6);
      components.push({
        symbol: 'u_B', label: 'B 类（三角分布）', value: typeB,
        formulaLatex: 'u_B = a/\\sqrt{6}',
        substitution: `a=${a.toPrecision(6)}`,
      });
    } else {
      const k = input.bTypeCoverageFactor ?? 2;
      typeB = a / k;
      components.push({
        symbol: 'u_B', label: 'B 类（正态，给定 k）', value: typeB,
        formulaLatex: 'u_B = a/k',
        substitution: `a=${a.toPrecision(6)}，k=${k}`,
      });
    }
  }

  const combined = Math.sqrt(typeA * typeA + typeB * typeB);
  const relative = correctedMean !== 0 ? combined / Math.abs(correctedMean) : NaN;
  ruleNotes.push('GB/T：合成结果 u_c 是合成标准不确定度（一倍标准差）；如需高包含概率请显式计算扩展不确定度 U');

  return {
    n, rawMean, correctedMean, sampleStd: s, stdError: sem,
    typeA, typeB, combined, relative, tFactor: 1, dof, simplified: false,
    components,
    formatted: formatMeasurement(correctedMean, combined, profile.sigfig),
    ruleNotes,
    mode: 'gbt',
  };
}

// ---------------------------------------------------------------------------
// GB/T B 类换算器（plan §20 GB/T 公式族）
// ---------------------------------------------------------------------------

export function rectangularToStandard(a: number): number {
  return a / Math.sqrt(3);
}
export function triangularToStandard(a: number): number {
  return a / Math.sqrt(6);
}
/** 正态：给定包含概率 p（如证书 95%）→ u = a/z_p 双侧 */
export function normalCoverageToStandard(a: number, p: number, quantile: (p: number) => number): number {
  const z = quantile(0.5 + p / 2);
  return a / z;
}

// ---------------------------------------------------------------------------
// 间接测量传播（课程：ΔY = √(Σ(∂f/∂xi·Δxi)²)；GB/T 同形但 u 语义）
// ---------------------------------------------------------------------------

export interface PropagationInput {
  symbol: string;
  value: number;
  uncertainty: number;
  unit?: string;
}

export interface PropagationTerm {
  symbol: string;
  /** 灵敏度系数 ci = ∂f/∂xi（在取值点） */
  sensitivity: number;
  /** |ci|·Δxi */
  contribution: number;
  /** term²/ΔY² 贡献率 */
  fraction: number;
  derivativeLatex: string;
}

export interface PropagationResult {
  /** 函数值 */
  value: number;
  combined: number;
  relative: number;
  terms: PropagationTerm[];
  formatted: FormattedMeasurement;
  /** 相对形式（积商幂时展示对数微分等价式） */
  relativeNote?: string;
  latexExpression: string;
}

/** 偏导方和根传播（独立输入）。课程模式传 Δxi；GB/T 传 u(xi)。 */
export function propagateUncertainty(
  expressionSource: string,
  inputs: PropagationInput[],
  sigfigOpts: SigFigOptions,
  symbolMap: Record<string, string> = {},
): PropagationResult {
  const compiled = compileExpression(expressionSource);
  const scope: Record<string, number> = {};
  for (const inp of inputs) scope[inp.symbol] = inp.value;
  const value = evaluateExpression(compiled, scope);

  const terms: PropagationTerm[] = [];
  let sumSq = 0;
  for (const inp of inputs) {
    if (inp.uncertainty === 0) {
      terms.push({
        symbol: inp.symbol, sensitivity: 0, contribution: 0, fraction: 0,
        derivativeLatex: '0',
      });
      continue;
    }
    const d = derivativeOf(compiled, inp.symbol);
    const ci = evaluateExpression(d, scope);
    const contribution = Math.abs(ci) * inp.uncertainty;
    sumSq += contribution * contribution;
    terms.push({
      symbol: inp.symbol,
      sensitivity: ci,
      contribution,
      fraction: 0, // 稍后归一
      derivativeLatex: `\\frac{\\partial f}{\\partial ${symbolMap[inp.symbol] ?? inp.symbol}}`,
    });
  }
  const combined = Math.sqrt(sumSq);
  for (const t of terms) {
    t.fraction = combined > 0 ? (t.contribution * t.contribution) / sumSq : 0;
  }
  const relative = value !== 0 ? combined / Math.abs(value) : NaN;
  return {
    value,
    combined,
    relative,
    terms,
    formatted: formatMeasurement(value, combined, sigfigOpts),
    latexExpression: compiled.node.toTex({ parenthesis: 'auto' }),
  };
}

// ---------------------------------------------------------------------------
// GB/T：相关输入合成 + 有效自由度 + 扩展不确定度
// ---------------------------------------------------------------------------

export interface GBTComponent {
  symbol: string;
  estimate: number;
  standardUncertainty: number;
  distribution?: 'normal' | 'rectangular' | 'triangular' | 'custom';
  dof?: number; // 缺省视为 ∞
  source: 'A' | 'B';
}

export interface GBTCorrelationPair {
  i: string;
  j: string;
  /** 相关系数 r(xi, xj)，|r|≤1 */
  r: number;
}

export interface GBTCombinedResult {
  y: number;
  uc: number;
  terms: { symbol: string; ci: number; ui: number; cui: number; fraction: number }[];
  covarianceContribution: number; // 2Σ cicj u(xi,xj)
  nuEff: number;
  /** U_p = t_p(νeff)·uc */
  expandedForP: (p: number) => number;
  effectiveDof: number;
}

export function gbtCombine(
  expressionSource: string,
  components: GBTComponent[],
  correlations: GBTCorrelationPair[] = [],
): GBTCombinedResult {
  const compiled = compileExpression(expressionSource);
  const scope: Record<string, number> = {};
  for (const c of components) scope[c.symbol] = c.estimate;
  const y = evaluateExpression(compiled, scope);

  const sensitivities = new Map<string, number>();
  const cis: { symbol: string; ci: number; ui: number; cui: number; dof?: number }[] = [];
  for (const c of components) {
    const ci = evaluateExpression(derivativeOf(compiled, c.symbol), scope);
    sensitivities.set(c.symbol, ci);
    cis.push({ symbol: c.symbol, ci, ui: c.standardUncertainty, cui: ci * c.standardUncertainty, dof: c.dof });
  }
  let variance = 0;
  for (const c of cis) variance += c.cui * c.cui;
  // 相关项：u(xi,xj) = r·u(xi)·u(xj)
  let covContribution = 0;
  const bySymbol = new Map(cis.map((c) => [c.symbol, c]));
  for (const pair of correlations) {
    const a = bySymbol.get(pair.i);
    const b = bySymbol.get(pair.j);
    if (!a || !b) throw new Error(`相关对引用了未知分量：${pair.i}/${pair.j}`);
    if (Math.abs(pair.r) > 1) throw new Error(`相关系数必须在 [-1,1]：r(${pair.i},${pair.j})=${pair.r}`);
    const cov = pair.r * a.ui * b.ui;
    covContribution += 2 * a.ci * b.ci * cov;
  }
  variance += covContribution;
  if (variance < 0) throw new Error('协方差项使方差为负：请检查相关系数符号与数值');
  const uc = Math.sqrt(variance);

  const nuEff = welchSatterthwaite(cis.map((c) => ({ sensitivity: c.ci, standardUncertainty: c.ui, dof: c.dof })));
  const effectiveDof = Number.isFinite(nuEff) ? Math.floor(nuEff) : Infinity;

  return {
    y,
    uc,
    terms: cis.map((c) => ({ symbol: c.symbol, ci: c.ci, ui: c.ui, cui: c.cui, fraction: variance > 0 ? (c.cui * c.cui) / variance : 0 })),
    covarianceContribution: covContribution,
    nuEff,
    effectiveDof,
    expandedForP: (p: number) => {
      if (Number.isFinite(effectiveDof) && effectiveDof > 0) {
        return tQuantile(effectiveDof, p) * uc;
      }
      // νeff → ∞ 用正态
      return normalQuantile(0.5 + p / 2) * uc;
    },
  };
}

// ---------------------------------------------------------------------------
// 策略接口（plan §6.6）
// ---------------------------------------------------------------------------

export interface UncertaintyStrategy {
  readonly profile: StandardProfile;
  evaluateDirect(input: DirectMeasurementInput): DirectUncertaintyResult;
  format(result: DirectUncertaintyResult): string;
}

export function courseStrategy(profile: StandardProfile): UncertaintyStrategy {
  return {
    profile,
    evaluateDirect: (input) => courseDirect(input, profile),
    format: (result) => `${result.formatted.text}${' unit' in result ? '' : ''}`,
  };
}

export function gbtStrategy(profile: StandardProfile): UncertaintyStrategy {
  return {
    profile,
    evaluateDirect: (input) => gbtDirect(input, profile),
    format: (result) => result.formatted.text,
  };
}

export function strategyFor(profile: StandardProfile): UncertaintyStrategy {
  return profile.kind === 'gbt' ? gbtStrategy(profile) : courseStrategy(profile);
}

/** 相对不确定度展示（2 位有效数字） */
export function formatRelative(rel: number, digits: 1 | 2 = 2): string {
  return formatSigDigitsPercent(rel, digits);
}

export function requireCompiled(source: string): CompiledExpression {
  return compileExpression(source);
}
