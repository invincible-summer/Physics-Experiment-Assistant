/**
 * 列聚合派生（AGENTS §11）：把原始数据列换算为公式所需聚合变量。
 * 派生结果保持完整浮点精度，不修约；数据不足返回 null。
 */
import { mean, sampleStd, sum } from '../core/statistics';

/** 单列 → { S: Σxi, n }（算术平均值公式 x̄=S/n） */
export function deriveSumCount(cols: number[][]): Record<string, number> | null {
  const xs = cols[0] ?? [];
  if (xs.length === 0) return null;
  return { S: sum(xs), n: xs.length };
}

/** 单列 → { Q: Σ(xi−x̄)², n }（贝塞尔公式 S=√(Q/(n−1))） */
export function deriveResidualSquareCount(cols: number[][]): Record<string, number> | null {
  const xs = cols[0] ?? [];
  if (xs.length < 2) return null;
  const m = mean(xs);
  const q = xs.reduce((acc, x) => acc + (x - m) * (x - m), 0);
  return { Q: q, n: xs.length };
}

/** 单列 → { S: 样本标准偏差, n }（平均值标准偏差 S_x̄=S/√n） */
export function deriveStdCount(cols: number[][]): Record<string, number> | null {
  const xs = cols[0] ?? [];
  if (xs.length < 2) return null;
  return { S: sampleStd(xs), n: xs.length };
}

/** 双列 (x, y) → { Sxx, Sxy, Syy }（相关系数 r） */
export function deriveCrossSquares(cols: number[][]): Record<string, number> | null {
  const xs = cols[0] ?? [];
  const ys = cols[1] ?? [];
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return null;
  const mx = mean(xs.slice(0, n));
  const my = mean(ys.slice(0, n));
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    sxx += dx * dx;
    sxy += dx * dy;
    syy += dy * dy;
  }
  return { Sxx: sxx, Sxy: sxy, Syy: syy };
}
