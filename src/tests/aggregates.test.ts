/** 列聚合派生（公式页「从数据列自动计算」）的数值正确性 */
import { describe, expect, it } from 'vitest';
import {
  deriveCrossSquares, deriveResidualSquareCount, deriveStdCount, deriveSumCount,
} from '../formulas/aggregates';
import { mean, sampleStd, sum } from '../core/statistics';

describe('deriveSumCount（mean 公式 S/n）', () => {
  it('求和与计数正确', () => {
    const r = deriveSumCount([[1.5, 2.5, 3.0, 4]]);
    expect(r).not.toBeNull();
    expect(r!.S).toBeCloseTo(11, 12);
    expect(r!.n).toBe(4);
    expect(r!.S / r!.n).toBeCloseTo(mean([1.5, 2.5, 3.0, 4]), 12);
  });
  it('空列返回 null', () => {
    expect(deriveSumCount([[]])).toBeNull();
  });
});

describe('deriveResidualSquareCount（sample-std 公式 Q/n）', () => {
  it('Q = Σ(xi−x̄)² 与贝塞尔标准差自洽', () => {
    const xs = [9.42, 9.44, 9.46, 9.44, 9.43];
    const r = deriveResidualSquareCount([xs])!;
    expect(r.n).toBe(5);
    // Q/(n-1) 的平方根应等于贝塞尔样本标准差
    expect(Math.sqrt(r.Q / (r.n - 1))).toBeCloseTo(sampleStd(xs), 12);
  });
  it('单个数据无法派生（返回 null）', () => {
    expect(deriveResidualSquareCount([[9.42]])).toBeNull();
  });
});

describe('deriveStdCount（sem 公式 S/n）', () => {
  it('S 为贝塞尔样本标准差', () => {
    const xs = [1, 2, 3, 4, 5];
    const r = deriveStdCount([xs])!;
    expect(r.S).toBeCloseTo(sampleStd(xs), 12);
    expect(r.n).toBe(5);
  });
});

describe('deriveCrossSquares（相关系数 r 的 Sxx/Sxy/Syy）', () => {
  it('完全线性数据 r = 1', () => {
    const xs = [1, 2, 3, 4, 5];
    const ys = [2, 4, 6, 8, 10];
    const r = deriveCrossSquares([xs, ys])!;
    expect(r.Sxx).toBeCloseTo(10, 12);
    expect(r.Sxy).toBeCloseTo(20, 12);
    expect(r.Syy).toBeCloseTo(40, 12);
    expect(r.Sxy / Math.sqrt(r.Sxx * r.Syy)).toBeCloseTo(1, 12);
  });
  it('两列长度不一致时按较短列配对', () => {
    // 配对 (1,10),(2,20)：mx=1.5, my=15 → Sxx=0.5, Sxy=5
    const r = deriveCrossSquares([[1, 2, 3], [10, 20]])!;
    expect(r.Sxx).toBeCloseTo(0.5, 12);
    expect(r.Sxy).toBeCloseTo(5, 12);
  });
  it('配对不足返回 null', () => {
    expect(deriveCrossSquares([[1], [2]])).toBeNull();
  });
});

describe('与 core/statistics 的一致性', () => {
  it('deriveSumCount.S 等于 core sum', () => {
    const xs = [0.1, 0.2, 0.3, 0.4];
    expect(deriveSumCount([xs])!.S).toBeCloseTo(sum(xs), 12);
  });
});
