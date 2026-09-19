import { describe, expect, it } from 'vitest';
import {
  courseDirect, gbtDirect, propagateUncertainty, gbtCombine,
  rectangularToStandard, triangularToStandard,
} from '../core/uncertainty';
import { TSINGHUA_A1_2026, GBT_27418_2017 } from '../standards/registry';
import { compileExpression, evaluateExpression, derivativeOf, solveNumeric, toLatex, ExpressionError } from '../core/expression';
import { normalQuantile } from '../core/statistics';

describe('课程模式直接测量不确定度', () => {
  it('重复测量：ΔA=tSx̄，ΔB=Δ仪，方和根合成', () => {
    // n=5, x̄=5.10, S≈0.0187 (构造：微小差异)
    const readings = [5.12, 5.10, 5.07, 5.11, 5.10];
    const r = courseDirect({ readings, instrumentError: 0.02 }, TSINGHUA_A1_2026);
    expect(r.n).toBe(5);
    expect(r.dof).toBe(4);
    expect(r.tFactor).toBeCloseTo(2.77645, 4);
    const s = Math.sqrt(
      ((5.12 - 5.1) ** 2 + 0 + (5.07 - 5.1) ** 2 + (5.11 - 5.1) ** 2 + 0) / 4,
    );
    expect(r.sampleStd).toBeCloseTo(s, 12);
    expect(r.typeA).toBeCloseTo(2.7764451051977987 * (s / Math.sqrt(5)), 10);
    expect(r.typeB).toBe(0.02);
    expect(r.combined).toBeCloseTo(Math.sqrt(r.typeA ** 2 + 0.02 ** 2), 12);
  });
  it('ΔA < Δ仪/3 触发课程简化规则', () => {
    // 数据非常一致 → S 很小 → ΔA 远小于 Δ仪/3
    const readings = [10.001, 10.000, 10.001, 10.000, 10.001, 10.000];
    const r = courseDirect({ readings, instrumentError: 0.05 }, TSINGHUA_A1_2026);
    expect(r.simplified).toBe(true);
    expect(r.combined).toBe(0.05);
    expect(r.ruleNotes.join()).toContain('课程简化规则');
  });
  it('单次测量 Δ = Δ仪', () => {
    const r = courseDirect({ readings: [42.5], instrumentError: 0.5 }, TSINGHUA_A1_2026);
    expect(r.combined).toBe(0.5);
    expect(r.formatted.text).toBe('42.5 ± 0.5');
  });
  it('已定系统误差先修正', () => {
    const r = courseDirect(
      { readings: [3.21, 3.22, 3.20], instrumentError: 0.01, correction: -0.01 },
      TSINGHUA_A1_2026,
    );
    expect(r.correctedMean).toBeCloseTo(mean3() - 0.01, 12);
    function mean3() {
      return (3.21 + 3.22 + 3.20) / 3;
    }
  });
  it('末位对齐与有效数字（典型输出格式）', () => {
    const r = courseDirect(
      { readings: [9.42, 9.44, 9.40, 9.43], instrumentError: 0.05 },
      TSINGHUA_A1_2026,
    );
    // Δ 首位 ≥3 → 1 位
    expect([1, 2]).toContain(r.formatted.uncertaintyDigits);
    const [v, u] = r.formatted.text.split(' ± ');
    const decU = (u.split('.')[1] ?? '').length;
    const decV = (v.split('.')[1] ?? '').length;
    expect(decV).toBe(decU);
  });
});

describe('GB/T 模式（严格隔离验证）', () => {
  it('同一组输入在课程/GB/T 下产生不同结果（AGENTS §19.10）', () => {
    const readings = [5.12, 5.10, 5.07, 5.11, 5.10];
    const course = courseDirect({ readings, instrumentError: 0.02 }, TSINGHUA_A1_2026);
    const gbt = gbtDirect({ readings, instrumentError: 0.02, distribution: 'rectangular' }, GBT_27418_2017);
    // 课程 ΔB=Δ仪=0.02；GB/T uB=0.02/√3≈0.0115
    expect(course.typeB).toBe(0.02);
    expect(gbt.typeB).toBeCloseTo(0.02 / Math.sqrt(3), 12);
    // 课程 ΔA 带 t 因子；GB/T uA=Sx̄
    expect(course.typeA).toBeGreaterThan(gbt.typeA);
    expect(course.mode).toBe('course');
    expect(gbt.mode).toBe('gbt');
  });
  it('A 类不加 t 因子（禁止 t 化后混算）', () => {
    const readings = [1.0, 1.1, 1.05, 0.95, 1.02];
    const gbt = gbtDirect({ readings }, GBT_27418_2017);
    const s = Math.sqrt(
      [1.0, 1.1, 1.05, 0.95, 1.02].reduce((acc, x) => acc + (x - 1.024) ** 2, 0) / 4,
    );
    expect(gbt.typeA).toBeCloseTo(s / Math.sqrt(5), 10);
  });
  it('矩形 a/√3、三角 a/√6', () => {
    expect(rectangularToStandard(0.03)).toBeCloseTo(0.03 / Math.sqrt(3), 12);
    expect(triangularToStandard(0.03)).toBeCloseTo(0.03 / Math.sqrt(6), 12);
  });
});

describe('偏导传播（课程间接量）', () => {
  it('环体积 golden 传播：V=(9.44±0.08) cm³', () => {
    // V = pi/4 (D^2 - d^2) h
    const r = propagateUncertainty(
      'pi/4 * (D^2 - d^2) * h',
      [
        { symbol: 'D', value: 4.002, uncertainty: 0.006 },
        { symbol: 'd', value: 1.998, uncertainty: 0.006 },
        { symbol: 'h', value: 1.000, uncertainty: 0.007 },
      ],
      TSINGHUA_A1_2026.sigfig,
    );
    expect(r.value).toBeGreaterThan(9.43);
    expect(r.value).toBeLessThan(9.45);
    expect(r.combined).toBeGreaterThan(0.074);
    expect(r.combined).toBeLessThan(0.085);
    expect(r.formatted.text).toBe('9.44 ± 0.08');
    // 灵敏度：∂V/∂D = pi/2·D·h ≈ 6.286
    const termD = r.terms.find((t) => t.symbol === 'D');
    expect(termD?.sensitivity).toBeCloseTo((Math.PI / 2) * 4.002 * 1.0, 9);
  });
  it('积商幂等价式一致：Y=x^2 y / z', () => {
    const r = propagateUncertainty(
      'x^2 * y / z',
      [
        { symbol: 'x', value: 2, uncertainty: 0.02 },
        { symbol: 'y', value: 3, uncertainty: 0.03 },
        { symbol: 'z', value: 4, uncertainty: 0.04 },
      ],
      TSINGHUA_A1_2026.sigfig,
    );
    expect(r.value).toBe(3);
    // 相对：2·(0.01) + 0.01 + 0.01 → RSS: sqrt((0.02)^2+0.01^2+0.01^2)=0.0245
    expect(r.relative).toBeCloseTo(Math.sqrt(0.02 ** 2 + 0.01 ** 2 + 0.01 ** 2), 9);
  });
  it('分量增大时 RSS 合成不减小（AGENTS §17.3）', () => {
    const base = propagateUncertainty(
      'a + b',
      [
        { symbol: 'a', value: 1, uncertainty: 0.1 },
        { symbol: 'b', value: 1, uncertainty: 0.2 },
      ],
      TSINGHUA_A1_2026.sigfig,
    );
    const bigger = propagateUncertainty(
      'a + b',
      [
        { symbol: 'a', value: 1, uncertainty: 0.15 },
        { symbol: 'b', value: 1, uncertainty: 0.2 },
      ],
      TSINGHUA_A1_2026.sigfig,
    );
    expect(bigger.combined).toBeGreaterThanOrEqual(base.combined);
  });
});

describe('GB/T 合成与扩展', () => {
  it('独立合成 uc 与贡献率', () => {
    const r = gbtCombine(
      'R * I',
      [
        { symbol: 'R', estimate: 100, standardUncertainty: 1, source: 'B' },
        { symbol: 'I', estimate: 0.1, standardUncertainty: 0.001, source: 'B' },
      ],
    );
    expect(r.y).toBeCloseTo(10, 12);
    // ci: dU/dR = I = 0.1, dU/dI = R = 100 → 各贡献 0.1 → uc = √2·0.1
    expect(r.uc).toBeCloseTo(Math.SQRT2 * 0.1, 12);
    const fr = r.terms.map((t) => t.fraction);
    expect(fr[0]).toBeCloseTo(0.5, 10);
  });
  it('相关输入加入协方差项', () => {
    const r0 = gbtCombine('x + y', [
      { symbol: 'x', estimate: 1, standardUncertainty: 0.1, source: 'B' },
      { symbol: 'y', estimate: 1, standardUncertainty: 0.1, source: 'B' },
    ]);
    expect(r0.uc).toBeCloseTo(Math.sqrt(2) * 0.1, 12);
    const r1 = gbtCombine(
      'x + y',
      [
        { symbol: 'x', estimate: 1, standardUncertainty: 0.1, source: 'B' },
        { symbol: 'y', estimate: 1, standardUncertainty: 0.1, source: 'B' },
      ],
      [{ i: 'x', j: 'y', r: 0.5 }],
    );
    // Var = 0.02 + 2·0.5·0.01 = 0.03 → uc≈0.1732
    expect(r1.uc).toBeCloseTo(Math.sqrt(0.03), 12);
    expect(r1.covarianceContribution).toBeCloseTo(0.01, 12);
  });
  it('有效自由度与扩展不确定度', () => {
    const r = gbtCombine('x', [
      { symbol: 'x', estimate: 5, standardUncertainty: 0.1, dof: 9, source: 'A' },
    ]);
    expect(r.nuEff).toBe(9);
    expect(r.expandedForP(0.95)).toBeCloseTo(2.26216 * 0.1, 4);
    // ∞ 自由度 → 正态
    const r2 = gbtCombine('x', [
      { symbol: 'x', estimate: 5, standardUncertainty: 0.1, source: 'B' },
    ]);
    expect(r2.nuEff).toBe(Infinity);
    expect(r2.expandedForP(0.95)).toBeCloseTo(normalQuantile(0.975) * 0.1, 9);
  });
});

describe('表达式引擎安全与求导', () => {
  it('解析、求值、白名单', () => {
    const c = compileExpression('2*pi*r + h');
    expect(c.variables.sort()).toEqual(['h', 'r']);
    expect(evaluateExpression(c, { r: 1, h: 1 })).toBeCloseTo(2 * Math.PI + 1, 12);
    expect(() => compileExpression('alert(1)')).toThrow(ExpressionError);
    expect(() => compileExpression('f(x)=2*x')).toThrow(ExpressionError);
    expect(() => compileExpression('sinh(x)^2')).not.toThrow();
    expect(() => compileExpression('foo(x)')).toThrow(/不允许的函数/);
  });
  it('符号求导', () => {
    const c = compileExpression('x^2 * y');
    const d = derivativeOf(c, 'x');
    expect(evaluateExpression(d, { x: 3, y: 2 })).toBeCloseTo(12, 10);
    const d2 = derivativeOf(c, 'y');
    expect(evaluateExpression(d2, { x: 3, y: 2 })).toBeCloseTo(9, 10);
  });
  it('受限数值求根', () => {
    // x^2 - 16 = 0 → x=4
    const c = compileExpression('x^2 - 16');
    const root = solveNumeric(c, 'x', {}, 4);
    expect(Math.abs(root)).toBeCloseTo(4, 6);
  });
});

describe('golden: GB/T 矩形分布扩展不确定度报告', () => {
  it('u=a/√3 合成后 U=k·uc 数值正确', () => {
    const a = 0.03;
    const u1 = rectangularToStandard(a);
    const u2 = rectangularToStandard(a);
    const uc = Math.sqrt(u1 * u1 + u2 * u2);
    const U = 2 * uc;
    expect(u1).toBeCloseTo(0.017320508, 8);
    expect(U).toBeCloseTo(0.04898979, 8);
  });
});
