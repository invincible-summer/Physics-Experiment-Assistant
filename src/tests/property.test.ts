/** 属性测试（fast-check，AGENTS.md §17.3 / plan §17） */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { convert, convertDeltaTemperature } from '../core/quantity';
import { propagateUncertainty } from '../core/uncertainty';
import { weightedMean } from '../core/statistics';
import { formatMeasurement, roundToSigDigits, COURSE_SIGFIG } from '../core/sigfig';

describe('属性测试（fast-check）', () => {
  it('单位换算往返不改变物理量', () => {
    const unitPairs: [string, string][] = [
      ['m', 'mm'], ['m', 'cm'], ['V', 'mV'], ['V', 'μV'], ['A', 'mA'],
      ['T', 'mT'], ['g', 'kg'], ['s', 'ms'], ['Hz', 'kHz'], ['Ω', 'kΩ'],
      ['degC', 'K'],
    ];
    fc.assert(
      fc.property(
        fc.double({ min: 1e-4, max: 1e4, noNaN: true }),
        fc.constantFrom(...unitPairs),
        (v, [from, to]) => {
          const round = from === 'degC' || to === 'degC'
            ? convertDeltaTemperature(convertDeltaTemperature(v, from, to), to, from)
            : convert(convert(v, from, to), to, from);
          expect(round).toBeCloseTo(v, 8);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('不确定度分量增大时 RSS 合成不确定度不减小', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.01, max: 10, noNaN: true }),
        fc.double({ min: 0.01, max: 10, noNaN: true }),
        fc.double({ min: 0, max: 0.9, noNaN: true }),
        (u1, u2, bump) => {
          const base = propagateUncertainty('x + y', [
            { symbol: 'x', value: 1, uncertainty: u1 },
            { symbol: 'y', value: 1, uncertainty: u2 },
          ], COURSE_SIGFIG);
          const bigger = propagateUncertainty('x + y', [
            { symbol: 'x', value: 1, uncertainty: u1 * (1 + bump) },
            { symbol: 'y', value: 1, uncertainty: u2 },
          ], COURSE_SIGFIG);
          expect(bigger.combined).toBeGreaterThanOrEqual(base.combined - 1e-12);
        },
      ),
      { numRuns: 300 },
    );
  });

  it('线性缩放的传播结果满足尺度关系（f=cx → Δ_f=|c|Δx）', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -100, max: 100, noNaN: true }),
        fc.double({ min: 0.01, max: 10, noNaN: true }),
        fc.double({ min: -50, max: 50, noNaN: true, noDefaultInfinity: true }),
        (c, u, x) => {
          const r = propagateUncertainty('c * x', [
            { symbol: 'c', value: c, uncertainty: 0 },
            { symbol: 'x', value: x, uncertainty: u },
          ], COURSE_SIGFIG);
          expect(r.combined).toBeCloseTo(Math.abs(c) * u, 9);
        },
      ),
      { numRuns: 300 },
    );
  });

  it('加权平均落在输入值凸包内（权重均为正时）', () => {
    fc.assert(
      fc.property(
        fc.array(fc.double({ min: -100, max: 100, noNaN: true }), { minLength: 2, maxLength: 12 }),
        (xs) => {
          const ws = xs.map((_, i) => i + 1);
          const m = weightedMean(xs, ws);
          expect(m).toBeGreaterThanOrEqual(Math.min(...xs) - 1e-9);
          expect(m).toBeLessThanOrEqual(Math.max(...xs) + 1e-9);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('格式化后估计值末位与不确定度末位对齐', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.double({ min: 1e-4, max: 1e5, noNaN: true, noDefaultInfinity: true }),
          fc.boolean(),
        ),
        fc.double({ min: 1e-6, max: 10, noNaN: true }),
        ([mag, neg], u) => {
          const v = neg ? -mag : mag;
          const f = formatMeasurement(v, u, COURSE_SIGFIG);
          // 用格式化文本判定（保留尾随 0，不用 Number 的科学记数形式）
          const [vText, uText] = f.text.split(' ± ');
          const decU = (uText.split('.')[1] ?? '').length;
          const decV = (vText.split('.')[1] ?? '').length;
          expect(decV).toBe(decU);
          expect(f.uncertainty).toBeGreaterThan(0);
        },
      ),
      { numRuns: 500 },
    );
  });

  it('roundToSigDigits 结果有效数字位数正确（浮点容差内）', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 1e-8, max: 1e8, noNaN: true }),
        fc.integer({ min: 1, max: 8 }),
        (v, n) => {
          const r = roundToSigDigits(v, n);
          if (r === 0) return;
          const digits = Math.abs(r).toExponential().split('e')[0].replace(/0+$/, '').replace('.', '').length;
          expect(digits).toBeLessThanOrEqual(n);
          expect(Math.abs(r - v)).toBeLessThanOrEqual(Math.abs(v) * 0.6 * Math.pow(10, -(n - 1)) + 1e-300);
        },
      ),
      { numRuns: 300 },
    );
  });
});
