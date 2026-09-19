import { describe, expect, it } from 'vitest';
import { parseNumericText, assertFinite, safeDivide } from '../core/numeric';
import {
  countSignificantDigits, roundToSigDigits, roundToDecimalPlace, roundUncertainty,
  formatMeasurement, COURSE_SIGFIG, leadingSignificantDigit, toFixedPlace,
} from '../core/sigfig';
import {
  mean, sampleStd, stdErrorOfMean, tQuantile, logGamma, erf, normalQuantile,
  incompleteBeta, weightedMean, linearInterpolation, percentDeviation, percentDifference,
} from '../core/statistics';
import { ols, olsThroughOrigin, weightedOLS } from '../core/regression';
import {
  convert, convertTemperature, convertDeltaTemperature, dimensionOf, dimEqual,
  DimensionMismatchError, UnknownUnitError, toSIValue, fromSIValue, dimMul, dimensionToString,
} from '../core/quantity';

describe('parseNumericText 有效数字元数据', () => {
  it.each([
    ['15.0', 15, 3, 1],
    ['15', 15, 2, 0],
    ['0.00980', 0.0098, 3, 5],
    ['980', 980, 2, 0],
    ['980.', 980, 3, 0],
    ['1.0000', 1.0, 5, 4],
    ['-12.30', -12.3, 4, 2],
    ['0', 0, 1, 0],
    ['1.2e3', 1200, 2, undefined],
    ['1.20e-3', 0.0012, 3, undefined],
    ['.5', 0.5, 1, 1],
  ])('%s → value=%v sig=%v', (raw, value, sig, place) => {
    const p = parseNumericText(raw);
    expect(p.ok).toBe(true);
    expect(p.value).toBeCloseTo(value as number, 12);
    expect(p.sigDigits).toBe(sig);
    if (place !== undefined && p.decimalPlace !== undefined) {
      expect(p.decimalPlace).toBe(place);
    }
  });

  it('拒绝非法输入', () => {
    expect(parseNumericText('abc').ok).toBe(false);
    expect(parseNumericText('').ok).toBe(false);
    expect(parseNumericText('1.2.3').ok).toBe(false);
  });

  it('15.0 与 15 的有效数字不同（AGENTS §21.1）', () => {
    expect(countSignificantDigits('15.0')).toBe(3);
    expect(countSignificantDigits('15')).toBe(2);
  });
});

describe('sigfig 修约', () => {
  it('roundToSigDigits 四舍五入（含进位）', () => {
    expect(roundToSigDigits(0.0785, 2)).toBeCloseTo(0.079, 12); // 跨十位? 0.0785→0.079
    expect(roundToSigDigits(9.999, 2)).toBe(10); // 跨数量级进位
    expect(roundToSigDigits(1234.5, 2)).toBe(1200);
    expect(roundToSigDigits(-0.0445, 1)).toBeCloseTo(-0.04, 12); // 0.0445 < 0.045
    expect(roundToSigDigits(0.045, 1)).toBeCloseTo(0.05, 12); // 恰在半点，HALF_UP 进位
    expect(roundToSigDigits(2.5, 1)).toBe(3);
    expect(roundToSigDigits(0, 3)).toBe(0);
  });
  it('roundToDecimalPlace', () => {
    expect(roundToDecimalPlace(9.4248, 2)).toBe(9.42);
    expect(roundToDecimalPlace(9.425, 2)).toBe(9.43); // half-up
    expect(roundToDecimalPlace(1234, -2)).toBe(1200);
    expect(roundToDecimalPlace(1250, -2)).toBe(1300);
  });
  it('不确定度位数规则：首位≥3 取 1 位', () => {
    expect(roundUncertainty(0.084, COURSE_SIGFIG).value).toBeCloseTo(0.08, 12);
    expect(roundUncertainty(0.084, COURSE_SIGFIG).digits).toBe(1);
    expect(roundUncertainty(0.0264, COURSE_SIGFIG).value).toBeCloseTo(0.026, 12);
    expect(roundUncertainty(0.0264, COURSE_SIGFIG).digits).toBe(2);
    expect(leadingSignificantDigit(0.0264)).toBe(2);
    expect(leadingSignificantDigit(300)).toBe(3);
  });
  it('formatMeasurement 末位对齐', () => {
    const f = formatMeasurement(9.4248, 0.0783, COURSE_SIGFIG);
    expect(f.value).toBeCloseTo(9.42, 12);
    expect(f.uncertainty).toBeCloseTo(0.08, 12);
    expect(f.text).toBe('9.42 ± 0.08');
    const f2 = formatMeasurement(2.8465, 0.0264, COURSE_SIGFIG);
    expect(f2.text).toBe('2.847 ± 0.026');
  });
  it('toFixedPlace 去除 -0', () => {
    expect(toFixedPlace(-0.0001, 2)).toBe('0.00');
  });
});

describe('统计与特殊函数', () => {
  it('mean/std/SEM', () => {
    const xs = [5.12, 5.10, 5.07, 5.11, 5.10];
    expect(mean(xs)).toBeCloseTo(5.10, 12);
    expect(stdErrorOfMean(xs)).toBeCloseTo(sampleStd(xs) / Math.sqrt(5), 12);
  });
  it('tQuantile 与教科书表值一致（双侧 P=0.95）', () => {
    const table: [number, number][] = [
      [1, 12.7062], [2, 4.30265], [3, 3.18245], [4, 2.77645], [5, 2.57058],
      [6, 2.44691], [7, 2.36462], [8, 2.30600], [9, 2.26216], [10, 2.22814],
      [11, 2.20099], [12, 2.17881], [13, 2.16037], [14, 2.14479], [15, 2.13145],
      [16, 2.11991], [17, 2.10982], [18, 2.10092], [19, 2.09302], [20, 2.08596],
      [30, 2.04227], [40, 2.02108], [60, 2.00030], [120, 1.97993],
    ];
    for (const [nu, tv] of table) {
      expect(tQuantile(nu, 0.95)).toBeCloseTo(tv, 4);
    }
    expect(tQuantile(1e6, 0.95)).toBeCloseTo(1.959964, 4);
  });
  it('logGamma / erf / normalQuantile 已知值', () => {
    expect(logGamma(0.5)).toBeCloseTo(0.5723649429247001, 13);
    expect(logGamma(5)).toBeCloseTo(Math.log(24), 13);
    expect(erf(1)).toBeCloseTo(0.8427007929497149, 13);
    expect(erf(0.5)).toBeCloseTo(0.5204998778130465, 13);
    expect(erf(2)).toBeCloseTo(0.9953222650189527, 13);
    expect(incompleteBeta(0.5, 2, 2)).toBeCloseTo(0.5, 12);
    expect(normalQuantile(0.975)).toBeCloseTo(1.959963984540054, 9);
    expect(normalQuantile(0.5)).toBeCloseTo(0, 9);
  });
  it('加权平均与插值', () => {
    expect(weightedMean([1, 2, 3], [1, 1, 2])).toBeCloseTo(2.25, 12);
    expect(weightedMean([3, 3], [1, 1])).toBe(3);
    expect(linearInterpolation(1.5, [1, 2], [10, 20])).toBe(15);
    expect(linearInterpolation(0, [1, 2], [10, 20])).toBe(10); // 端点外
    expect(percentDeviation(9.42, 9.44)).toBeCloseTo(0.02 / 9.44, 12);
    expect(percentDifference(9.9, 10.1)).toBeCloseTo(0.2 / 10, 12);
  });
});

describe('OLS 拟合', () => {
  // 经典数据集：x=1..5, y=[2,4,5,4,5] → a=2.2 b=0.6 r=0.7745966692
  const x = [1, 2, 3, 4, 5];
  const y = [2, 4, 5, 4, 5];
  it('a/b/r/Sb 与课程公式一致', () => {
    const fit = ols(x, y);
    expect(fit.a).toBeCloseTo(2.2, 12);
    expect(fit.b).toBeCloseTo(0.6, 12);
    expect(fit.r).toBeCloseTo(0.7745966692414834, 12);
    expect(fit.sse).toBeCloseTo(2.4, 12);
    expect(fit.sb).toBeCloseTo(Math.sqrt(0.08), 10); // S²=0.8, Sxx=10 → Sb=0.2828
    expect(fit.sbCourse).toBeCloseTo(fit.sb, 10); // 两种公式路径交叉验证
    expect(fit.sa).toBeCloseTo(fit.saCourse, 10);
    expect(fit.dof).toBe(3);
    expect(fit.t).toBeCloseTo(3.18245, 4);
    expect(fit.deltaB).toBeCloseTo(fit.t * fit.sb, 10);
  });
  it('过原点拟合', () => {
    const f = olsThroughOrigin([1, 2, 3], [2.1, 3.9, 6.0]);
    expect(f.b).toBeCloseTo((1 * 2.1 + 2 * 3.9 + 3 * 6.0) / 14, 12);
    expect(f.dof).toBe(2);
  });
  it('加权拟合', () => {
    const f = weightedOLS([1, 2, 3, 4], [1.1, 1.9, 3.2, 3.8], [1, 1, 1, 1]);
    const plain = ols([1, 2, 3, 4], [1.1, 1.9, 3.2, 3.8]);
    expect(f.a).toBeCloseTo(plain.a, 10);
    expect(f.b).toBeCloseTo(plain.b, 10);
  });
  it('数据点不足与 x 恒定时报错', () => {
    expect(() => ols([1, 2], [1, 2])).toThrow();
    expect(() => ols([3, 3, 3], [1, 2, 3])).toThrow();
  });
});

describe('单位换算（AGENTS §17.1）', () => {
  it('m/mm、V/mV/μV、A/mA、T/mT、℃与K', () => {
    expect(convert(1.5, 'm', 'mm')).toBeCloseTo(1500, 12);
    expect(convert(1000, 'mV', 'V')).toBeCloseTo(1, 12);
    expect(convert(40, 'μV', 'V')).toBeCloseTo(4e-5, 15);
    expect(convert(2.5, 'mA', 'A')).toBeCloseTo(0.0025, 15);
    expect(convert(0.5, 'T', 'mT')).toBeCloseTo(500, 12);
    expect(convert(1000, 'g', 'kg')).toBeCloseTo(1, 12);
    expect(convert(1, 'g/cm3', 'kg/m3')).toBeCloseTo(1000, 10);
  });
  it('摄氏温度：绝对值带偏置，温差只缩放（AGENTS §21.3）', () => {
    expect(convertTemperature(25, 'degC', 'K')).toBeCloseTo(298.15, 12);
    expect(convertTemperature(0, 'degC', 'K')).toBeCloseTo(273.15, 12);
    expect(convertDeltaTemperature(5.5, 'degC', 'K')).toBeCloseTo(5.5, 12);
  });
  it('维度检查拒绝不相容换算', () => {
    expect(() => convert(1, 'm', 'kg')).toThrow(DimensionMismatchError);
    expect(() => convert(1, 's', 'V')).toThrow(DimensionMismatchError);
    expect(() => convert(1, 'm', 'lightyear')).toThrow(UnknownUnitError);
  });
  it('toSIValue / fromSIValue 往返', () => {
    expect(toSIValue(250, 'ms')).toBeCloseTo(0.25, 15);
    expect(fromSIValue(0.25, 'ms')).toBeCloseTo(250, 12);
  });
  it('维度代数与显示', () => {
    const force = dimMul(dimensionOf('m'), dimMul(dimensionOf('kg'), { T: -2 }));
    expect(dimEqual(force, dimensionOf('N'))).toBe(true);
    expect(dimensionToString(force)).toContain('kg');
  });
});

describe('数值守卫', () => {
  it('除零与 NaN 防护', () => {
    expect(() => safeDivide(1, 0)).toThrow('除数为 0');
    expect(() => assertFinite(NaN)).toThrow();
    expect(assertFinite(3.14)).toBe(3.14);
  });
});
