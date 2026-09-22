/** 七实验核心公式测试（AGENTS.md §17.1 "每个实验的核心公式"） */
import { describe, expect, it } from 'vitest';
import {
  analogMeterError, digitalMeterError, resistanceBoxError, dampingTimerError,
} from '../instruments';
import { ols } from '../core/regression';
import { linearInterpolation } from '../core/statistics';
import { ELEMENTARY_CHARGE as E_CHARGE, MOLAR_GAS_CONSTANT as R_GAS } from '../physics/constants';

const PI = Math.PI;

describe('仪器误差模型（plan §7）', () => {
  it('模拟电表 ΔA = Am·K%', () => {
    const r = analogMeterError({ rangeAm: 3, classK: 0.5, reading: 2.5 });
    expect(r.absoluteError).toBeCloseTo(0.015, 12);
    expect(r.relativeError).toBeCloseTo(0.006, 12);
  });
  it('数字仪表三种形式', () => {
    expect(digitalMeterError({ reading: 2, range: 4, resolution: 0.001, alphaPercent: 0.5, nDigits: 2 }, 'reading-digits').absoluteError)
      .toBeCloseTo(0.5 / 100 * 2 + 2 * 0.001, 12);
    expect(digitalMeterError({ reading: 2, range: 4, resolution: 0.001, alphaPercent: 0.5, betaPercent: 0.2 }, 'reading-range').absoluteError)
      .toBeCloseTo(0.01 + 0.008, 12);
    expect(digitalMeterError({ reading: 2, range: 4, resolution: 0.001, alphaPercent: 0.5, betaPercent: 0.2, nDigits: 1 }, 'combined').absoluteError)
      .toBeCloseTo(0.01 + 0.008 + 0.001, 12);
  });
  it('ZX21 电阻箱', () => {
    expect(resistanceBoxError({ R: 1000, N: 4 })).toBeCloseTo(1 + 0.025, 12);
  });
  it('阻尼计时器 Δ仪=读数×10⁻⁵+0.001s', () => {
    expect(dampingTimerError(10)).toBeCloseTo(10e-5 + 0.001, 15);
  });
});

describe('摩擦（plan §10.1）', () => {
  it('Capstan：μ = −ln(P/W)/θ 与 P=We^(−μθ) 互逆', () => {
    const W = 7.848; // 800g×9.81? 用 800g × 9.81 = 7.848
    const mu = 0.2;
    const theta = PI;
    const P = W * Math.exp(-mu * theta);
    expect(-Math.log(P / W) / theta).toBeCloseTo(mu, 12);
  });
  it('区间测量中心值与半宽', () => {
    const [Xp, Xm] = [5.2, 4.8];
    expect((Xp + Xm) / 2).toBeCloseTo(5.0, 12);
    expect(Math.abs(Xp - Xm) / 2).toBeCloseTo(0.2, 12);
  });
  it('C 部分：Mu=√(P1P2)，μu=ln(P2/P1)/(2θ)', () => {
    const [P1, P2, theta] = [30, 70, PI];
    // 由 Mu g = P1 e^{μθ} = P2 e^{−μθ} 验证反解
    const Mu = Math.sqrt(P1 * P2);
    const mu = Math.log(P2 / P1) / (2 * theta);
    expect(P1 * Math.exp(mu * theta)).toBeCloseTo(Mu, 10);
    expect(P2 * Math.exp(-mu * theta)).toBeCloseTo(Mu, 10);
  });
});

describe('霍尔（plan §10.2）', () => {
  it('四换向组合 UH=(U1−U2+U3−U4)/4', () => {
    const [U1, U2, U3, U4] = [8.2, -1.1, -7.9, 1.2];
    expect((U1 - U2 + U3 - U4) / 4).toBeCloseTo(0.05, 12);
  });
  it('KH=b/B → RH=KH·d → n=1/(eRH)', () => {
    const I_mA = [2, 4, 6, 8, 10];
    const KH_true = 1.7e-3; // m³/C 数量级示例
    const B = 0.5;
    const UH_mV = I_mA.map((i) => KH_true * B * i); // mV/mA 数值上等于 V/A
    const fit = ols(I_mA, UH_mV);
    expect(fit.b / B).toBeCloseTo(KH_true, 8);
    const d = 0.5e-3;
    const RH = (fit.b / B) * d;
    expect(RH).toBeCloseTo(KH_true * d, 10);
    const n = 1 / (E_CHARGE * Math.abs(RH));
    expect(n).toBeCloseTo(1 / (E_CHARGE * KH_true * d), 8);
  });
  it('磁阻 MR=(R(B)−R0)/R0', () => {
    expect((12.5 - 12.0) / 12.0).toBeCloseTo(0.0416666666667, 10);
  });
});

describe('热导（plan §10.3）', () => {
  it('qc=U²/(2Fr)，λ=qcR/(2Δt)，c=qc/(ρR·dT/dτ)', () => {
    const U = 20, F = 3.14e-4, r = 100; // qc = 400/(2×3.14e-4×100)
    const qc = (U * U) / (2 * F * r);
    expect(qc).toBeCloseTo(400 / 0.0628, 6);
    const R = 25e-3, dt = 2.5;
    const lambda = (qc * R) / (2 * dt);
    expect(lambda).toBeCloseTo((qc * 0.025) / 5, 10);
    const rho = 1196, dTdt = 0.002;
    const c = qc / (rho * R * dTdt);
    expect(c).toBeCloseTo(qc / (1196 * 0.025 * 0.002), 10);
  });
  it('热电偶换算 40μV/℃', () => {
    expect(100e-6 / 40e-6).toBeCloseTo(2.5, 12);
  });
});

describe('阻尼（plan §10.4）', () => {
  it('ζ=(−b)/√(4π²+b²) 与 b=−2πζ/√(1−ζ²) 互逆', () => {
    for (const zetaTrue of [0.05, 0.1, 0.2]) {
      const b = (-2 * PI * zetaTrue) / Math.sqrt(1 - zetaTrue * zetaTrue);
      const zeta = -b / Math.sqrt(4 * PI * PI + b * b);
      expect(zeta).toBeCloseTo(zetaTrue, 12);
    }
  });
  it('ωd=√(ω0²−β²)，Td=2π/ωd，ω0=2π/(Td√(1−ζ²))', () => {
    const w0 = 2 * PI, beta = 0.2;
    const wd = Math.sqrt(w0 * w0 - beta * beta);
    const Td = (2 * PI) / wd;
    const zeta = beta / w0;
    const w0rec = (2 * PI) / (Td * Math.sqrt(1 - zeta * zeta));
    expect(w0rec).toBeCloseTo(w0, 12);
  });
  it('τ=1/(ζω0)=1/β，Q=1/(2ζ)', () => {
    const beta = 0.25, w0 = 2 * PI;
    const zeta = beta / w0;
    expect(1 / (zeta * w0)).toBeCloseTo(1 / beta, 12);
    expect(1 / (2 * zeta)).toBeCloseTo(w0 / (2 * beta), 12);
  });
});

describe('声速/示波器（plan §10.5）', () => {
  it('同相点拟合 λ=b（20 点）', () => {
    const lamTrue = 8.5; // mm
    const n = Array.from({ length: 20 }, (_, i) => i + 1);
    const x = n.map((k) => 50 + lamTrue * k + (k % 3 === 0 ? 0.02 : -0.01)); // 微噪声
    const fit = ols(n, x);
    expect(fit.b).toBeCloseTo(lamTrue, 2);
    expect(fit.dof).toBe(18); // n−2（AGENTS §21.7）
  });
  it('干燥空气声速 20℃ ≈ 343.4 m/s', () => {
    const v = 331.45 * Math.sqrt(1 + 20 / 273.15);
    expect(v).toBeGreaterThan(343.0);
    expect(v).toBeLessThan(343.8);
  });
  it('理想气体声速与干燥空气公式量级一致', () => {
    const vIdeal = Math.sqrt((1.4 * R_GAS * (20 + 273.15)) / 0.02897);
    const vDry = 331.45 * Math.sqrt(1 + 20 / 273.15);
    expect(Math.abs(vIdeal - vDry) / vDry).toBeLessThan(0.01);
  });
  it('饱和蒸气压线性插值 25℃ ∈ (3.16, 3.37) kPa', () => {
    const p = linearInterpolation(25, [24, 26], [2.985, 3.363]);
    expect(p).toBeCloseTo((2.985 + 3.363) / 2, 10);
  });
  it('利萨如 fy=fx·nx/ny', () => {
    expect(1000 * 3 / 2).toBe(1500);
  });
});

describe('透镜（plan §10.6）', () => {
  it('共轭法 f=(b²−a²)/(4b)', () => {
    const b = 40, a = 20;
    expect((b * b - a * a) / (4 * b)).toBeCloseTo(7.5, 12);
  });
  it("焦距仪 fx=(y'/y)f 与 B 分量 √2×0.004mm", () => {
    const f0 = 400, y = 1.0, yp = 0.25;
    expect((yp / y) * f0).toBeCloseTo(100, 12);
    expect(Math.SQRT2 * 0.004).toBeCloseTo(0.005656854249, 12);
  });
  it('自准法 f=−|F2−O2| 为负', () => {
    expect(-Math.abs(85.0 - 45.0)).toBe(-40);
  });
  it('薄透镜 f=pq/(p+q)', () => {
    expect((30 * 60) / 90).toBeCloseTo(20, 12);
  });
});

describe('迈克尔逊（plan §10.7）', () => {
  it('λ=2Δd/Δk', () => {
    const lam = (2 * 3.164e-5) / 100;
    expect(lam).toBeCloseTo(632.8e-9, 6);
  });
  it('等倾 δ=2dcosθ；中心 2d=kλ', () => {
    const d = 0.1;
    expect(2 * d * Math.cos(0)).toBeCloseTo(0.2, 12);
    expect(2 * d * Math.cos(PI / 6)).toBeCloseTo(0.173205080756, 10);
  });
  it('白光 Δd=l(n−1) 反解', () => {
    const dd = 0.25, n = 1.5;
    expect(dd / (n - 1)).toBeCloseTo(0.5, 12);
    expect(1 + 0.25 / 0.5).toBeCloseTo(1.5, 12);
  });
});
