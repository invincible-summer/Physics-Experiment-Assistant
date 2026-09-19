/** 边界与补充覆盖测试（推高 core 覆盖率至目标） */
import { describe, expect, it } from 'vitest';
import {
  parseNumericText, makeDatum, HIGH_PRECISION, nearlyEqual, relativelyClose,
} from '../core/numeric';
import {
  formatSigDigitsPercent, toFixedSig, fitParameterDisplay, formatScientificNotation,
  shouldUseScientific, roundUncertainty, GBT_SIGFIG, countSignificantDigits, roundToDecimalPlace,
} from '../core/sigfig';
import {
  median, geometricMean, covariance, correlation, minOf, maxOf, rangeOf, halfRange, centerOfRange,
  tCDF, normalCDF, tQuantile, normalQuantile, erfc, incompleteBeta, weightSum, logGamma,
} from '../core/statistics';
import {
  normalizeUnit, unitsOfFamily, families, unitZh, displayUnit, qToSI, qConvert,
  siBaseUnitOf, dimPow, dimDivide, dimIsDimensionless, UnknownUnitError, convert, getUnitDef,
} from '../core/quantity';
import { olsThroughOrigin, weightedOLS, swappedFitDiagnostic } from '../core/regression';

describe('numeric 边界', () => {
  it('千分位与全角负号容错', () => {
    expect(parseNumericText('1,234').value).toBe(1234);
    expect(parseNumericText('1,234.5').value).toBeCloseTo(1234.5, 12);
    expect(parseNumericText('−5').value).toBe(-5);
    expect(parseNumericText('  3e0 ').value).toBe(3);
    expect(parseNumericText('1,23').ok).toBe(false); // 非千分位逗号
  });
  it('守卫与工具', () => {
    expect(nearlyEqual(0.1 + 0.2, 0.3)).toBe(true);
    expect(relativelyClose(1e10, 1e10 * (1 + 1e-12))).toBe(true);
    expect(HIGH_PRECISION.pi).toBeCloseTo(Math.PI, 15);
    expect(makeDatum('15.0', 15, { significantDigits: 3 }).significantDigits).toBe(3);
  });
});

describe('sigfig 补充', () => {
  it('相对不确定度与科学记数', () => {
    expect(formatSigDigitsPercent(0.0085, 2)).toBe('0.85%');
    expect(formatSigDigitsPercent(NaN, 2)).toBe('—');
    expect(formatScientificNotation(9.42e-7, 2)).toBe('9.4 \\times 10^{-7}');
    expect(shouldUseScientific(9e7, { ...GBT_SIGFIG, sciUpper: 1e7, sciLower: 1e-5 })).toBe(true);
    expect(shouldUseScientific(0, GBT_SIGFIG)).toBe(false);
  });
  it('GB/T 不做首位压缩', () => {
    const r = roundUncertainty(0.084, GBT_SIGFIG);
    expect(r.digits).toBe(2);
    expect(r.value).toBeCloseTo(0.084, 12);
  });
  it('toFixedSig 与负 place', () => {
    expect(toFixedSig(1234, 2)).toBe('1200');
    expect(toFixedSig(0.00012345, 3)).toBe('0.000123');
    expect(roundToDecimalPlace(-1234, -2)).toBe(-1200);
  });
  it('拟合参数显示（绪论课规则）', () => {
    const { aText, bText } = fitParameterDisplay(2.34567, 0.12345, ['1.0', '2.0', '3.0'], ['5.12', '5.10', '5.07']);
    // a 末位与 yi 末位(2位)取齐；b 至少与 xi 有效位数(2位)一致
    expect((aText.split('.')[1] ?? '').length).toBe(2);
    expect(bText.replace(/^-/, '').replace('.', '').replace(/^0+/, '').length).toBeGreaterThanOrEqual(2);
  });
  it('无效文本返回 undefined', () => {
    expect(countSignificantDigits('abc')).toBeUndefined();
  });
});

describe('statistics 补充', () => {
  it('中位数/几何平均/极差', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([3, 1, 2])).toBe(2);
    expect(geometricMean([2, 8])).toBeCloseTo(4, 12);
    expect(() => geometricMean([1, -2])).toThrow();
    expect(minOf([3, 1, 2])).toBe(1);
    expect(maxOf([3, 1, 2])).toBe(3);
    expect(rangeOf([3, 1, 2])).toBe(2);
    expect(halfRange([3, 1])).toBe(1);
    expect(centerOfRange([3, 1])).toBe(2);
    expect(weightSum([1, 2, 3])).toBe(6);
  });
  it('协方差/相关系数', () => {
    const x = [1, 2, 3, 4];
    const y = [2, 4, 6, 8];
    expect(covariance(x, y)).toBeCloseTo(10 / 3, 10);
    expect(correlation(x, y)).toBeCloseTo(1, 12);
    expect(() => correlation([1, 1, 1], y)).toThrow();
  });
  it('t 分布 CDF 已知值', () => {
    expect(tCDF(0, 5)).toBeCloseTo(0.5, 12);
    expect(tCDF(2.77645, 4)).toBeCloseTo(0.975, 4);
    expect(tCDF(-2.77645, 4)).toBeCloseTo(0.025, 4);
    expect(normalCDF(0)).toBeCloseTo(0.5, 12);
    expect(normalCDF(1.959964)).toBeCloseTo(0.975, 6);
    expect(erfc(1)).toBeCloseTo(0.157299207050285, 10);
  });
  it('P=0.99 t 因子抽查', () => {
    expect(tQuantile(10, 0.99)).toBeCloseTo(3.16927, 4); // 教科书表值
    expect(tQuantile(5, 0.99)).toBeCloseTo(4.03214, 4);
  });
  it('logGamma 反射与 incompleteBeta 边界', () => {
    expect(logGamma(1.5)).toBeCloseTo(-0.1207822376352452, 10);
    expect(incompleteBeta(0, 2, 3)).toBe(0);
    expect(incompleteBeta(1, 2, 3)).toBe(1);
  });
  it('normalQuantile 极端概率', () => {
    expect(normalQuantile(0.001)).toBeCloseTo(-3.090232, 5);
    expect(normalQuantile(0.999)).toBeCloseTo(3.090232, 5);
    expect(() => normalQuantile(1)).toThrow();
  });
});

describe('quantity 补充', () => {
  it('别名归一化', () => {
    expect(normalizeUnit('℃')).toBe('degC');
    expect(normalizeUnit('°')).toBe('deg');
    expect(normalizeUnit('°C')).toBe('degC');
    expect(normalizeUnit('uV')).toBe('μV');
    expect(normalizeUnit('um')).toBe('μm');
    expect(() => normalizeUnit('lightyear')).toThrow(UnknownUnitError);
  });
  it('族与显示', () => {
    expect(unitsOfFamily('length')).toContain('mm');
    expect(families().length).toBeGreaterThan(10);
    expect(unitZh('mV')).toBe('毫伏');
    expect(displayUnit('m2')).toContain('m²');
  });
  it('Quantity 工具', () => {
    expect(qToSI({ value: 250, unit: 'ms' }).value).toBeCloseTo(0.25, 15);
    expect(qConvert({ value: 1, unit: 'm' }, 'cm').value).toBeCloseTo(100, 12);
    expect(siBaseUnitOf({ M: 1, T: -2, I: -1 })).toContain('kg');
    expect(dimIsDimensionless(dimDivide({ L: 1 }, { L: 1 }))).toBe(true);
    expect(dimPow({ L: 1 }, 3)).toEqual({ L: 3 });
    expect(getUnitDef('K').isTemperatureScale).toBeFalsy();
    expect(() => convert(1, 'degC', 'm')).toThrow();
  });
});

describe('regression 补充', () => {
  it('过原点与加权错误路径', () => {
    expect(() => olsThroughOrigin([0, 0, 0], [1, 2, 3])).toThrow();
    expect(() => weightedOLS([1, 2], [1, 2], [1, 1])).toThrow();
    expect(() => weightedOLS([1, 2, 3], [1, 2, 3], [1, -1, 1])).toThrow(/权重必须为正/);
  });
  it('对调诊断', () => {
    const x = [1, 2, 3, 4, 5];
    const y = [2, 4, 5, 4, 5];
    const d = swappedFitDiagnostic(x, y);
    expect(d.r).toBeCloseTo(0.7745966692, 10);
    expect(d.slopeXY).toBeCloseTo(0.6, 10); // y 对 x 回归斜率
    expect(d.slopeYX).toBeCloseTo(1, 10);   // 1/(x 对 y 回归斜率) = Syy/Sxy
  });
});
