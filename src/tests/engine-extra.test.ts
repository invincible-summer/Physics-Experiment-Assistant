/** expression / uncertainty 模块补充覆盖 */
import { describe, expect, it } from 'vitest';
import {
  compileExpression, evaluateExpression, derivativeOf, extractVariables, toLatex,
  solveNumeric, ExpressionError, ALLOWED_CONSTANTS,
} from '../core/expression';
import {
  gbtDirect, courseDirect, strategyFor, courseStrategy, gbtStrategy, formatRelative,
  requireCompiled, rectangularToStandard, triangularToStandard, normalCoverageToStandard,
  gbtCombine,
} from '../core/uncertainty';
import { normalQuantile } from '../core/statistics';
import { GBT_27418_2017, TSINGHUA_A1_2026 } from '../standards/registry';

describe('expression 补充', () => {
  it('空/语法错误/非法变量名', () => {
    expect(() => compileExpression('')).toThrow(ExpressionError);
    expect(() => compileExpression('2 +* 3')).toThrow(/语法错误/);
    expect(() => compileExpression('1-中')).toThrow(ExpressionError); // mathjs 语法层拒绝非 ASCII 符号
  });
  it('未赋值变量与定义域错误', () => {
    const c = compileExpression('sqrt(x)');
    expect(() => evaluateExpression(c, { x: 1 })).not.toThrow();
    expect(() => evaluateExpression(c, {})).toThrow(/未赋值/);
    expect(() => evaluateExpression(c, { x: -1 })).toThrow(ExpressionError);
    const d = compileExpression('1 / y');
    expect(() => evaluateExpression(d, { y: 0 })).toThrow(ExpressionError);
  });
  it('常量与度模式求值', () => {
    const c = compileExpression('sin(x)');
    expect(evaluateExpression(c, { x: Math.PI / 6 })).toBeCloseTo(0.5, 12);
    expect(evaluateExpression(c, { x: 30 }, { angleMode: 'deg' })).toBeCloseTo(0.5, 12);
    const inv = compileExpression('atan(x)');
    expect(evaluateExpression(inv, { x: 1 }, { angleMode: 'deg' })).toBeCloseTo(45, 12);
    expect(ALLOWED_CONSTANTS.pi).toBeCloseTo(Math.PI, 15);
  });
  it('求导错误路径与符号提取', () => {
    expect(() => derivativeOf(compileExpression('sin(x)'), 'y')).not.toThrow(); // mathjs 对无关变量导数为 0
    const compiled = compileExpression('a + b * pi');
    expect(extractVariables(compiled.node).sort()).toEqual(['a', 'b']);
  });
  it('toLatex 与 solveNumeric', () => {
    const c = compileExpression('x^2 - 4');
    expect(toLatex(c)).toContain('x');
    // 正根扫描
    const root = solveNumeric(c, 'x', {}, 1);
    expect(Math.abs(root)).toBeCloseTo(2, 6);
    // 负根可达（扫描网格含负数）
    expect(Number.isFinite(root)).toBe(true);
    const noRoot = solveNumeric(compileExpression('x^2 + 1'), 'x', {}, 1);
    expect(noRoot).toBeNaN();
  });
  it('禁止赋值/块/函数定义', () => {
    expect(() => compileExpression('x = 1')).toThrow();
    expect(() => compileExpression('f(x) = x + 1')).toThrow();
  });
  it('requireCompiled', () => {
    expect(requireCompiled('1 + 1').variables).toEqual([]);
  });
});

describe('uncertainty 补充', () => {
  it('GB/T 单次测量（无 A 类）', () => {
    const r = gbtDirect({ readings: [100], instrumentError: 0.03, distribution: 'rectangular' }, GBT_27418_2017);
    expect(r.typeA).toBe(0);
    expect(r.combined).toBeCloseTo(0.03 / Math.sqrt(3), 12);
  });
  it('GB/T 正态与三角 B 类', () => {
    const rN = gbtDirect({ readings: [1, 1.1, 0.9], instrumentError: 0.02, distribution: 'normal', bTypeCoverageFactor: 2 }, GBT_27418_2017);
    expect(rN.typeB).toBeCloseTo(0.01, 12);
    const rT = gbtDirect({ readings: [1, 1.1, 0.9], instrumentError: 0.02, distribution: 'triangular' }, GBT_27418_2017);
    expect(rT.typeB).toBeCloseTo(0.02 / Math.sqrt(6), 12);
  });
  it('课程简化规则禁用时不简化', () => {
    const readings = [10.001, 10.000, 10.001, 10.000, 10.001, 10.000];
    const on = courseDirect({ readings, instrumentError: 0.05 }, TSINGHUA_A1_2026);
    expect(on.simplified).toBe(true);
    const profileNoSimp = { ...TSINGHUA_A1_2026, simplification: { enabled: false, threshold: 1 / 3, label: '禁用' } };
    const off = courseDirect({ readings, instrumentError: 0.05 }, profileNoSimp);
    expect(off.simplified).toBe(false);
    // 方和根合成：略大于 Δ仪（不简化）
    expect(off.combined).toBeGreaterThan(0.05);
    expect(off.combined).toBeLessThan(0.0501);
  });
  it('策略接口', () => {
    const cs = strategyFor(TSINGHUA_A1_2026);
    expect(cs.profile.id).toBe('tsinghua-a1-2026');
    const gs = strategyFor(GBT_27418_2017);
    expect(gs.profile.kind).toBe('gbt');
    const direct = courseStrategy(TSINGHUA_A1_2026).evaluateDirect({ readings: [1, 2, 3], instrumentError: 0.1 });
    expect(direct.mode).toBe('course');
    const gdirect = gbtStrategy(GBT_27418_2017).evaluateDirect({ readings: [1, 2, 3] });
    expect(gdirect.mode).toBe('gbt');
    expect(typeof courseStrategy(TSINGHUA_A1_2026).format(direct)).toBe('string');
    expect(formatRelative(0.0085)).toBe('0.85%');
  });
  it('B 类换算器', () => {
    expect(rectangularToStandard(1)).toBeCloseTo(1 / Math.sqrt(3), 12);
    expect(triangularToStandard(1)).toBeCloseTo(1 / Math.sqrt(6), 12);
    expect(normalCoverageToStandard(2, 0.95, normalQuantile)).toBeCloseTo(2 / 1.959964, 6);
  });
  it('gbtCombine 校验：非法相关系数', () => {
    expect(() => gbtCombine('x + y', [
      { symbol: 'x', estimate: 1, standardUncertainty: 0.1, source: 'B' },
      { symbol: 'y', estimate: 1, standardUncertainty: 0.1, source: 'B' },
    ], [{ i: 'x', j: 'y', r: 1.5 }])).toThrow(/相关系数/);
    // 完全负相关的两同权反号分量（数学上协方差矩阵半正定，方差恰为 0 不报错）
    const degenerate = gbtCombine('x - y', [
      { symbol: 'x', estimate: 1, standardUncertainty: 0.1, source: 'B' },
      { symbol: 'y', estimate: 1, standardUncertainty: 0.1, source: 'B' },
    ], [{ i: 'x', j: 'y', r: 1 }]);
    expect(degenerate.uc).toBeCloseTo(0, 12);
  });
  it('n=1 课程单次 + 已定修正', () => {
    const r = courseDirect({ readings: [42.5], instrumentError: 0.5, correction: 0.1 }, TSINGHUA_A1_2026);
    expect(r.correctedMean).toBeCloseTo(42.6, 12);
    expect(r.combined).toBe(0.5);
  });
});
