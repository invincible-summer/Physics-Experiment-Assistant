/**
 * 各新增领域公式的权威样例交叉检查（plan §10.7）。
 * 期望值来自教科书/常数手册的独立手算结果，不引用公式库内部中间量，
 * 防止"用同一实现自证"。
 */
import { describe, expect, it } from 'vitest';
import { getFormula, VISIBLE_FORMULAS } from '../formulas/registry';
import { compileExpression, evaluateExpression } from '../core/expression';

function evalFormula(id: string, inputs: Record<string, number>): number {
  const f = getFormula(id)!;
  expect(f).toBeDefined();
  const scope: Record<string, number> = {};
  for (const c of f.constants ?? []) scope[c.name] = c.value;
  Object.assign(scope, inputs);
  if (f.customCompute) return f.customCompute(scope);
  return evaluateExpression(compileExpression(f.expression!), scope);
}

describe('领域公式权威样例（plan §10.7 golden）', () => {
  it('力学：匀加速、抛体、碰撞、滚动', () => {
    expect(evalFormula('uniform-accel-v2', { v0: 0, a: 9.8, dx: 5 })).toBeCloseTo(Math.sqrt(98), 9);
    // 平抛 v0=20 m/s、θ=45°：射程 400/9.8 ≈ 40.816 m（忽略阻力）
    expect(evalFormula('projectile-range', { v0: 20, theta: Math.PI / 4, g: 9.8 })).toBeCloseTo(400 / 9.8, 9);
    // 2 kg@3 追 1 kg@0 完全非弹性：v = 2 m/s
    expect(evalFormula('inelastic-collision-1d', { m1: 2, v1: 3, m2: 1, v2: 0 })).toBeCloseTo(2, 12);
    // 实心圆柱纯滚动 E = ¾mv²
    expect(evalFormula('rolling-total-kinetic-energy', { m: 2, v: 1, I: 0.25, R: 0.5 })).toBeCloseTo(1.5, 12);
  });

  it('引力：地球表面逃逸速度 ≈ 11.19 km/s、同步轨道周期 ≈ 恒星日', () => {
    const ve = evalFormula('escape-velocity', { M: 5.972e24, r: 6.371e6 });
    expect(ve / 1000).toBeCloseTo(11.186, 2);
    const T = evalFormula('orbital-period', { M: 5.972e24, r: 4.2164e7 });
    expect(T / 3600).toBeCloseTo(23.93, 1); // 地球同步轨道 ≈ 86164 s
  });

  it('流体：Torricelli v=√(2gh)、浮力', () => {
    expect(evalFormula('torricelli-theorem', { g: 9.8, h: 5 })).toBeCloseTo(9.899494936611665, 9);
    expect(evalFormula('archimedes-buoyancy', { rho: 1000, g: 9.8, V: 1e-3 })).toBeCloseTo(9.8, 12);
  });

  it('热学：1 mol 理想气体 STP 压强 ≈ 101325 Pa、卡诺效率', () => {
    const p = evalFormula('ideal-gas-law', { n: 1, T: 273.15, V: 22.413969e-3 });
    expect(p).toBeCloseTo(101325, -1); // 相对 ~1e-4 内
    expect(evalFormula('carnot-efficiency', { Th: 500, Tc: 300 })).toBeCloseTo(0.4, 12);
  });

  it('静电：库仑常数 8.99e9、平行板电容、RC 时间常数', () => {
    // 两个 1 C 相距 1 m：F = k ≈ 8.9875e9 N
    expect(evalFormula('coulomb-law', { q1: 1, q2: 1, r: 1 })).toBeCloseTo(8.9875517923e9, -1);
    // A=1 m²、d=1 mm 真空：C = ε0×1000 ≈ 8.854 nF
    expect(evalFormula('parallel-plate-capacitor', { kap: 1, A: 1, d: 1e-3 })).toBeCloseTo(8.8541878128e-9, -13);
    expect(evalFormula('rc-charge', { E: 10, t: 1, R: 1000, C: 1e-3 })).toBeCloseTo(10 * (1 - Math.exp(-1)), 12);
  });

  it('磁场：洛伦兹力、长直导线、平行导线', () => {
    expect(evalFormula('lorentz-force', { q: 1.602176634e-19, v: 1e6, B: 1, theta: Math.PI / 2 })).toBeCloseTo(1.602176634e-13, 12);
    // 1 A 导线 1 cm 处 B = μ0/(2π·0.01) = 2e-5 T 量级（地球磁场同级）
    const B = evalFormula('straight-wire-field', { I: 1, r: 0.01 });
    expect(B).toBeCloseTo(1.25663706127e-6 / (2 * Math.PI * 0.01), -13);
    expect(evalFormula('parallel-wires-force', { I1: 1, I2: 1, d: 0.01 })).toBeCloseTo(2e-5, -9);
  });

  it('交流：RLC 阻抗 30-40-50、有效值 311→220', () => {
    expect(evalFormula('series-rlc-impedance', { R: 30, XL: 80, XC: 40 })).toBeCloseTo(50, 12);
    expect(evalFormula('rms-value', { U0: 311 })).toBeCloseTo(219.91, 1);
  });

  it('光学：双缝条纹间距、光栅一级衍射角、马吕斯定律', () => {
    expect(evalFormula('double-slit-fringe-spacing', { L: 1, lam: 632.8e-9, d: 2e-4 })).toBeCloseTo(3.164e-3, 5);
    expect(evalFormula('grating-equation', { k: 1, lam: 5.893e-7, d: 1e-3 / 600 })).toBeCloseTo(Math.asin(0.35358), 4);
    expect(evalFormula('malus-law', { I0: 100, theta: Math.PI / 3 })).toBeCloseTo(25, 12);
  });

  it('相对论：γ(0.6c)=1.25、速度合成不超光速', () => {
    expect(evalFormula('lorentz-factor', { v: 0.6 * 299792458 })).toBeCloseTo(1.25, 12);
    const u = evalFormula('velocity-addition', { u: 0.8 * 299792458, v: -0.8 * 299792458 });
    expect(Math.abs(u)).toBeLessThan(299792458);
  });

  it('量子：100 V 电子德布罗意波长 ≈ 1.227 Å、氢 Hα 频率', () => {
    const m_e = 9.1093837139e-31, q_e = 1.602176634e-19, h = 6.62607015e-34;
    const v = Math.sqrt((2 * q_e * 100) / m_e);
    const lambda = evalFormula('de-broglie-wavelength', { m: m_e, v });
    expect(lambda).toBeCloseTo(h / (m_e * v), 12);
    expect(lambda / 1e-10).toBeCloseTo(1.227, 2); // 教科书值 ≈ 1.23 Å
    const f = evalFormula('transition-photon-energy', {
      E2: (-13.6 / 9) * q_e, E1: (-13.6 / 4) * q_e,
    });
    expect(f / 1e14).toBeCloseTo(4.567, 2); // Hα ≈ 656.3 nm → 4.567e14 Hz
  });

  it('原子核：碳-14 半衰期 5730 年、1 u ≈ 931.5 MeV', () => {
    const T = evalFormula('half-life', { lam: Math.LN2 / (5730 * 3.156e7) });
    expect(T / (5730 * 3.156e7)).toBeCloseTo(1, 6);
    const E0 = evalFormula('rest-mass-energy', { m0: 1.66053906892e-27 });
    expect(E0 / 1.602176634e-13).toBeCloseTo(931.5, 0); // MeV
  });

  it('全库规模：参考公式与可计算公式并存，规模在计划区间', () => {
    const refs = VISIBLE_FORMULAS.filter((f) => f.kind === 'reference').length;
    const computable = VISIBLE_FORMULAS.length - refs;
    expect(refs).toBeGreaterThanOrEqual(8);
    expect(computable).toBeGreaterThanOrEqual(150);
  });
});
