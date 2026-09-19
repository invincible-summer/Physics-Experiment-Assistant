/**
 * core/statistics — 统计核心 + Student-t / 正态分位数（自实现并经表值验证）。
 *
 * AGENTS.md §14：核心统计公式自行实现并用表值/性质交叉验证。
 * plan.md §6.4：全部基础统计量。
 */

export function sum(xs: number[]): number {
  let s = 0;
  for (const x of xs) s += x;
  return s;
}

export function mean(xs: number[]): number {
  if (xs.length === 0) throw new Error('mean：数据为空');
  return sum(xs) / xs.length;
}

export function weightedMean(xs: number[], ws: number[]): number {
  if (xs.length === 0) throw new Error('weightedMean：数据为空');
  if (xs.length !== ws.length) throw new Error('weightedMean：数据与权重长度不一致');
  let sw = 0;
  let s = 0;
  for (let i = 0; i < xs.length; i++) {
    if (ws[i] < 0) throw new Error('weightedMean：权重不能为负');
    sw += ws[i];
    s += ws[i] * xs[i];
  }
  if (sw === 0) throw new Error('weightedMean：权重和为 0');
  return s / sw;
}

/** 权重和（用于 u(x̄w)=1/√Σwi 报告） */
export function weightSum(ws: number[]): number {
  return sum(ws);
}

export function geometricMean(xs: number[]): number {
  if (xs.length === 0) throw new Error('geometricMean：数据为空');
  if (xs.some((x) => x <= 0)) throw new Error('geometricMean：仅支持正数');
  let s = 0;
  for (const x of xs) s += Math.log(x);
  return Math.exp(s / xs.length);
}

export function median(xs: number[]): number {
  if (xs.length === 0) throw new Error('median：数据为空');
  const sorted = [...xs].sort((a, b) => a - b);
  const n = sorted.length;
  if (n % 2 === 1) return sorted[(n - 1) / 2];
  return (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
}

/** 样本方差（贝塞尔，n-1） */
export function sampleVariance(xs: number[]): number {
  const n = xs.length;
  if (n < 2) throw new Error('样本方差至少需要 2 个数据（n=1 时无法计算样本标准差）');
  const m = mean(xs);
  let s = 0;
  for (const x of xs) s += (x - m) * (x - m);
  return s / (n - 1);
}

export function sampleStd(xs: number[]): number {
  return Math.sqrt(sampleVariance(xs));
}

/** 平均值标准偏差 S_x̄ = S/√n */
export function stdErrorOfMean(xs: number[]): number {
  return sampleStd(xs) / Math.sqrt(xs.length);
}

export function minOf(xs: number[]): number {
  return Math.min(...xs);
}
export function maxOf(xs: number[]): number {
  return Math.max(...xs);
}
export function rangeOf(xs: number[]): number {
  return maxOf(xs) - minOf(xs);
}
/** 半极差（区间测量中心值的误差宽度） */
export function halfRange(xs: number[]): number {
  return rangeOf(xs) / 2;
}
/** 两端点的中心值 */
export function centerOfRange(xs: number[]): number {
  return (maxOf(xs) + minOf(xs)) / 2;
}

/** 样本协方差（n-1） */
export function covariance(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n !== ys.length || n < 2) throw new Error('covariance：需要两组等长且 n≥2 的数据');
  const mx = mean(xs);
  const my = mean(ys);
  let s = 0;
  for (let i = 0; i < n; i++) s += (xs[i] - mx) * (ys[i] - my);
  return s / (n - 1);
}

export function correlation(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n !== ys.length || n < 2) throw new Error('correlation：需要两组等长且 n≥2 的数据');
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  const mx = mean(xs);
  const my = mean(ys);
  for (let i = 0; i < n; i++) {
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
    sxy += (xs[i] - mx) * (ys[i] - my);
  }
  if (sxx === 0 || syy === 0) throw new Error('correlation：某组数据无变化，相关系数无定义');
  return sxy / Math.sqrt(sxx * syy);
}

/** 线性插值（端点外取端点值） */
export function linearInterpolation(x: number, xs: number[], ys: number[]): number {
  if (xs.length !== ys.length || xs.length < 2) throw new Error('线性插值：至少需要 2 个插值节点');
  // 检查 x 单调
  for (let i = 1; i < xs.length; i++) {
    if (xs[i] === xs[i - 1]) throw new Error('线性插值：节点 x 有重复');
  }
  const ascending = xs.every((v, i, a) => i === 0 || v > a[i - 1]);
  const descending = xs.every((v, i, a) => i === 0 || v < a[i - 1]);
  if (!ascending && !descending) throw new Error('线性插值：节点 x 必须单调');
  if (x <= Math.min(xs[0], xs[xs.length - 1])) return ys[0];
  if (x >= Math.max(xs[0], xs[xs.length - 1])) return ys[ys.length - 1];
  for (let i = 1; i < xs.length; i++) {
    const [x0, x1] = [xs[i - 1], xs[i]];
    if ((ascending && x >= x0 && x <= x1) || (descending && x <= x0 && x >= x1)) {
      const t = (x - x0) / (x1 - x0);
      return ys[i - 1] + t * (ys[i] - ys[i - 1]);
    }
  }
  return ys[ys.length - 1];
}

/** 相对偏差：|测量值 - 参考值| / 参考值 */
export function percentDeviation(measured: number, reference: number): number {
  if (reference === 0) throw new Error('percentDeviation：参考值为 0');
  return Math.abs(measured - reference) / Math.abs(reference);
}

/** 百分差（两值之差与平均值之比） */
export function percentDifference(a: number, b: number): number {
  if (a + b === 0) throw new Error('percentDifference：两数之和为 0');
  return Math.abs(a - b) / (Math.abs(a + b) / 2);
}

// ---------------------------------------------------------------------------
// 特殊函数：logGamma / 正则化不完全贝塔 / t 分布 / 正态分位数
// ---------------------------------------------------------------------------

/** Lanczos 近似 log Γ(z)，z>0，精度 ~1e-15 */
export function logGamma(z: number): number {
  const g = [
    676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012,
    9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (z < 0.5) {
    // 反射公式
    return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z);
  }
  const x = z - 1;
  let a = 0.99999999999980993;
  const t = x + 7.5;
  for (let i = 0; i < g.length; i++) {
    a += g[i] / (x + i + 1);
  }
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

/** 连分式求不完全贝塔（Numerical Recipes betacf） */
function betacf(a: number, b: number, x: number): number {
  const MAXIT = 300;
  const EPS = 3e-16;
  const FPMIN = 1e-300;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

/** 正则化不完全贝塔 I_x(a,b) */
export function incompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const lbeta = logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x);
  const bt = Math.exp(lbeta);
  if (x < (a + 1) / (a + b + 2)) {
    return (bt * betacf(a, b, x)) / a;
  }
  return 1 - (bt * betacf(b, a, 1 - x)) / b;
}

/** t 分布 CDF：P(Tν ≤ t) */
export function tCDF(t: number, nu: number): number {
  if (nu <= 0) throw new Error('t 分布自由度必须为正');
  const x = nu / (nu + t * t);
  const pTail = 0.5 * incompleteBeta(x, nu / 2, 0.5); // P(T > |t|)
  return t >= 0 ? 1 - pTail : pTail;
}

/**
 * Student-t 双侧分位数：求 t 使 P(|Tν| ≤ t) = p（课程 t_P(ν)，P=0.95）。
 * 用 I_x(ν/2,1/2) 与 t 的单调关系做牛顿迭代 + 二分保底。
 */
export function tQuantile(nu: number, p: number): number {
  if (nu <= 0) throw new Error('tQuantile：自由度必须为正');
  if (!(p > 0 && p < 1)) throw new Error('tQuantile：p 必须在 (0,1)');
  if (p <= 0.5) throw new Error('tQuantile：双侧置信概率 p 必须 > 0.5');
  // 目标：I_x(nu/2, 1/2) = 1 - p（双侧尾部），其中 x = nu/(nu+t²)，t 随 x 递减
  const target = 1 - p;
  const f = (t: number) => incompleteBeta(nu / (nu + t * t), nu / 2, 0.5) - target;

  // 初值：正态近似 + 小自由度修正
  let t = normalQuantile(0.5 + p / 2);
  if (nu < 10) t *= 1 + 3.0 / (4 * nu - 1);

  // 牛顿（数值导数），失败退化为二分
  for (let i = 0; i < 60; i++) {
    const fv = f(t);
    if (Math.abs(fv) < 1e-14) break;
    const h = 1e-7 * Math.max(1, t);
    const dv = (f(t + h) - f(t - h)) / (2 * h);
    if (!Number.isFinite(dv) || dv === 0) break;
    let step = fv / dv;
    // 限制步长防止跳到负数
    if (t - step <= 0) step = t / 2;
    t -= step;
    if (t <= 0) t = 1e-8;
  }
  // 二分精修兜底
  if (Math.abs(f(t)) > 1e-10) {
    let lo = 0;
    let hi = Math.max(t * 4, 1);
    while (f(hi) > 0 && hi < 1e6) hi *= 2; // f 递减：f(hi) 应 ≤ 0
    for (let i = 0; i < 200; i++) {
      const mid = (lo + hi) / 2;
      if (f(mid) > 0) lo = mid;
      else hi = mid;
    }
    t = (lo + hi) / 2;
  }
  return t;
}

/** 标准正态 CDF（erf 形式） */
export function normalCDF(z: number): number {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

/** 正则化下不完全贝塔的配套：下不完全 gamma P(a,x) 的级数 */
function gser(a: number, x: number): number {
  let ap = a;
  let sum = 1 / a;
  let del = sum;
  for (let n = 1; n < 500; n++) {
    ap += 1;
    del *= x / ap;
    sum += del;
    if (Math.abs(del) < Math.abs(sum) * 1e-16) break;
  }
  return sum * Math.exp(-x + a * Math.log(x) - logGamma(a));
}

/** 上不完全 gamma Q(a,x) 的连分式（Lentz） */
function gcf(a: number, x: number): number {
  const FPMIN = 1e-300;
  let b = x + 1 - a;
  let c = 1 / FPMIN;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i < 500; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = b + an / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-16) break;
  }
  return Math.exp(-x + a * Math.log(x) - logGamma(a)) * h;
}

/** 误差函数 erf，精度 ~1e-14（经不完全 gamma 实现） */
export function erf(x: number): number {
  if (x === 0) return 0;
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = ax * ax;
  const val = t < 1.5 ? gser(0.5, t) : 1 - gcf(0.5, t);
  return sign * val;
}

export function erfc(x: number): number {
  return 1 - erf(x);
}

/** 标准正态分位数（Acklam 逆推 + 一步 Halley 精化，精度 ~1e-9 以上） */
export function normalQuantile(p: number): number {
  if (!(p > 0 && p < 1)) throw new Error('normalQuantile：p 必须在 (0,1)');
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const pl = 0.02425;
  let q: number;
  let r: number;
  let z: number;
  if (p < pl) {
    q = Math.sqrt(-2 * Math.log(p));
    z = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else if (p <= 1 - pl) {
    q = p - 0.5;
    r = q * q;
    z = (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p));
    z = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  return refineNormalQuantile(z, p);
}

/** 在 Acklam 初值上做 Halley 精化，达到接近机器精度 */
function refineNormalQuantile(z: number, p: number): number {
  for (let i = 0; i < 2; i++) {
    const e = 0.5 * erfc(-z / Math.SQRT2) - p; // Φ(z) - p
    const u = e * Math.sqrt(2 * Math.PI) * Math.exp((z * z) / 2);
    z = z - u / (1 + (z * u) / 2);
  }
  return z;
}

/**
 * Welch–Satterthwaite 有效自由度（GB/T 模式）。
 * νeff = u_c⁴ / Σ (ci⁴ u_i⁴ / νi)。缺少自由度的 B 类分量按 ∞ 处理（贡献为 0）。
 */
export function welchSatterthwaite(
  components: { sensitivity: number; standardUncertainty: number; dof?: number }[],
): number {
  let denom = 0;
  for (const c of components) {
    const nu = c.dof;
    if (nu === undefined || !Number.isFinite(nu)) continue; // ∞
    const uci = c.sensitivity * c.standardUncertainty;
    denom += Math.pow(uci, 4) / nu;
  }
  const uc = combinedStandardUncertainty(components);
  if (denom === 0) return Infinity;
  const nuEff = Math.pow(uc, 4) / denom;
  return Math.max(nuEff, 1e-9);
}

/** 独立分量的合成标准不确定度（GB/T RSS） */
export function combinedStandardUncertainty(
  components: { sensitivity: number; standardUncertainty: number }[],
): number {
  let s = 0;
  for (const c of components) {
    const uci = c.sensitivity * c.standardUncertainty;
    s += uci * uci;
  }
  return Math.sqrt(s);
}
