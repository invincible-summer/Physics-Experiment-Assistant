/**
 * core/regression — 最小二乘拟合（plan.md §6.5，AGENTS.md §6）。
 *
 * 输出 a、b、r、R²、残差、SSE、Sa、Sb、ν=n-2 的 t 置信区间；
 * 课程公式视图 Sb/b = sqrt((1/r²-1)/(n-2))，Sa = Sb·sqrt(Σx²/n)。
 * 中间值一律保留完整浮点精度。
 */
import { correlation, mean, tQuantile } from '../statistics';

export interface OLSResult {
  n: number;
  a: number; // 截距
  b: number; // 斜率
  r: number; // 相关系数（课程首选）
  r2: number; // R²（工程扩展指标）
  xbar: number;
  ybar: number;
  sxx: number;
  syy: number;
  sxy: number;
  sse: number; // 残差平方和
  residuals: number[];
  fitted: number[];
  /** 回归标准差 S = sqrt(SSE/(n-2)) */
  s: number;
  /** 斜率标准误 Sb */
  sb: number;
  /** 截距标准误 Sa */
  sa: number;
  dof: number; // n-2
  /** Δb = t·Sb（默认 P=0.95） */
  deltaB: number;
  /** Δa = t·Sa */
  deltaA: number;
  t: number;
  /** 课程公式路径计算的 Sb（应与 sb 一致，用于交叉验证） */
  sbCourse: number;
  saCourse: number;
}

export function ols(x: number[], y: number[], p = 0.95): OLSResult {
  const n = x.length;
  if (n !== y.length) throw new Error('OLS：x 与 y 长度不一致');
  if (n < 3) throw new Error(`线性拟合至少需要 3 个数据点（当前 n=${n}，自由度 n-2 需为正）`);
  const xbar = mean(x);
  const ybar = mean(y);
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  let sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sxx += (x[i] - xbar) ** 2;
    syy += (y[i] - ybar) ** 2;
    sxy += (x[i] - xbar) * (y[i] - ybar);
    sumX2 += x[i] * x[i];
  }
  if (sxx === 0) throw new Error('OLS：所有 x 值相同，无法拟合');
  const b = sxy / sxx;
  const a = ybar - b * xbar;
  const r = sxy / Math.sqrt(sxx * syy);
  const fitted = x.map((xi) => a + b * xi);
  const residuals = y.map((yi, i) => yi - fitted[i]);
  let sse = 0;
  for (const e of residuals) sse += e * e;
  const dof = n - 2;
  const s = Math.sqrt(sse / dof);
  // 规范式：Sb = S/√Sxx
  const sbNorm = s / Math.sqrt(sxx);
  const sa = sbNorm * Math.sqrt(sumX2 / n);
  const t = tQuantile(dof, p);

  // 课程公式视图（AGENTS.md §6）：Sb = |b|·sqrt((1/r²-1)/(n-2))
  const sbCourse = Math.abs(r) > 0 ? Math.abs(b) * Math.sqrt((1 / (r * r) - 1) / dof) : Infinity;
  const saCourse = sbCourse * Math.sqrt(sumX2 / n);

  return {
    n, a, b, r, r2: r * r, xbar, ybar, sxx, syy, sxy, sse, residuals, fitted,
    s, sb: sbNorm, sa, dof, deltaB: t * sbNorm, deltaA: t * sa, t, sbCourse, saCourse,
  };
}

export interface ThroughOriginResult {
  n: number;
  b: number; // y = b·x
  /** 原点回归的 R² = 1 - SSE/Σy²（与普通 r 语义不同，标注展示） */
  r2: number;
  residuals: number[];
  fitted: number[];
  sse: number;
  s: number; // sqrt(SSE/(n-1))
  sb: number;
  dof: number; // n-1
  deltaB: number;
  t: number;
}

/** 过原点最小二乘 y = bx */
export function olsThroughOrigin(x: number[], y: number[], p = 0.95): ThroughOriginResult {
  const n = x.length;
  if (n !== y.length) throw new Error('过原点拟合：x 与 y 长度不一致');
  if (n < 2) throw new Error('过原点拟合至少需要 2 个数据点');
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxx += x[i] * x[i];
    sxy += x[i] * y[i];
    syy += y[i] * y[i];
  }
  if (sxx === 0) throw new Error('过原点拟合：x 全为 0');
  const b = sxy / sxx;
  const fitted = x.map((xi) => b * xi);
  const residuals = y.map((yi, i) => yi - fitted[i]);
  let sse = 0;
  for (const e of residuals) sse += e * e;
  const dof = n - 1;
  const s = Math.sqrt(sse / dof);
  const sb = s / Math.sqrt(sxx);
  const t = tQuantile(dof, p);
  return {
    n, b, r2: 1 - sse / syy, residuals, fitted, sse, s, sb, dof, deltaB: t * sb, t,
  };
}

export interface WeightedOLSResult {
  n: number;
  a: number;
  b: number;
  /** 加权残差平方和 */
  chi2: number;
  s: number; // sqrt(chi2/(n-2))
  sb: number;
  sa: number;
  dof: number;
  t: number;
  deltaB: number;
  deltaA: number;
  residuals: number[];
  fitted: number[];
}

/** 加权线性拟合（通用扩展，不冒充课程必需）。权重需为正。 */
export function weightedOLS(x: number[], y: number[], w: number[], p = 0.95): WeightedOLSResult {
  const n = x.length;
  if (n !== y.length || n !== w.length) throw new Error('加权拟合：x/y/w 长度不一致');
  if (n < 3) throw new Error('加权拟合至少需要 3 个数据点');
  if (w.some((wi) => !(wi > 0))) throw new Error('加权拟合：所有权重必须为正');
  let S = 0, Sx = 0, Sy = 0, Sxx = 0, Sxy = 0;
  for (let i = 0; i < n; i++) {
    S += w[i];
    Sx += w[i] * x[i];
    Sy += w[i] * y[i];
    Sxx += w[i] * x[i] * x[i];
    Sxy += w[i] * x[i] * y[i];
  }
  const delta = S * Sxx - Sx * Sx;
  if (delta === 0) throw new Error('加权拟合：退化（x 无变化）');
  const a = (Sxx * Sy - Sx * Sxy) / delta;
  const b = (S * Sxy - Sx * Sy) / delta;
  const fitted = x.map((xi) => a + b * xi);
  const residuals = y.map((yi, i) => yi - fitted[i]);
  let chi2 = 0;
  for (let i = 0; i < n; i++) chi2 += w[i] * residuals[i] * residuals[i];
  const dof = n - 2;
  const s = Math.sqrt(chi2 / dof);
  const sb = Math.sqrt(s * s * S / delta);
  const sa = Math.sqrt(s * s * Sxx / delta);
  const t = tQuantile(dof, p);
  return { n, a, b, chi2, s, sb, sa, dof, t, deltaB: t * sb, deltaA: t * sa, residuals, fitted };
}

/** 预测值 */
export function predict(fit: { a: number; b: number }, x: number): number {
  return fit.a + fit.b * x;
}

/** 加权拟合 x/y 对调后的斜率倒数校正（几何平均正交建议，仅诊断用） */
export function swappedFitDiagnostic(x: number[], y: number[]): { slopeXY: number; slopeYX: number; r: number } {
  return { slopeXY: ols(x, y).b, slopeYX: 1 / ols(y, x).b, r: correlation(x, y) };
}

/** 常用变换（数据处理页用） */
export const TRANSFORMS: Record<string, (v: number) => number> = {
  identity: (v) => v,
  ln: Math.log,
  log10: Math.log10,
  square: (v) => v * v,
  reciprocal: (v) => 1 / v,
  sqrt: Math.sqrt,
};
