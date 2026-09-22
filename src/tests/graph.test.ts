import { describe, expect, it } from 'vitest';
import { axisRange, sampleFunction } from '../core/graph';

describe('plot range and sampling', () => {
  it('accepts automatic, partial and scientific notation bounds', () => {
    expect(axisRange('', '', false)).toEqual({ min: undefined, max: undefined });
    expect(axisRange('1e-3', '', true).min).toBe(0.001);
    expect(axisRange('-2', '3', false)).toEqual({ min: -2, max: 3 });
  });
  it('rejects invalid, inverted and nonpositive logarithmic bounds', () => {
    for (const [a, b, log] of [['abc', '1', false], ['2', '1', false], ['1', '1', false], ['0', '10', true], ['1', 'Infinity', false]] as const) {
      expect(() => axisRange(a, b, log)).toThrow();
    }
  });
  it('samples endpoints at full precision and supports constants', () => {
    expect(sampleFunction('x^2', '-2', '2', '3').points).toEqual([{ x: -2, y: 4 }, { x: 0, y: 0 }, { x: 2, y: 4 }]);
    expect(sampleFunction('pi', '0', '1', '2').points[0].y).toBe(Math.PI);
  });
  it('breaks curves across undefined points rather than joining branches', () => {
    const sampled = sampleFunction('1/x', '-1', '1', '3');
    expect(sampled.points).toEqual([{ x: -1, y: -1 }, { x: 1, y: 1 }]);
    expect(sampled.breakBefore).toEqual([1]);
    expect(sampled.skipped).toBe(1);
  });
  it('counts log exclusions and uses geometrically spaced x samples', () => {
    const sampled = sampleFunction('x', '1', '100', '3', true);
    expect(sampled.points[1].x).toBeCloseTo(10);
    expect(sampleFunction('x', '-1', '1', '3', false, true).skipped).toBe(2);
  });
  it('rejects invalid counts, missing domains and unknown variables', () => {
    for (const count of ['1', '1001', '2.5', 'abc', '']) expect(() => sampleFunction('x', '0', '1', count)).toThrow();
    expect(() => sampleFunction('y', '0', '1', '3')).toThrow();
    expect(() => sampleFunction('x', '', '1', '3')).toThrow();
    expect(() => sampleFunction('x', '-1', '1', '3', true)).toThrow();
  });
});
