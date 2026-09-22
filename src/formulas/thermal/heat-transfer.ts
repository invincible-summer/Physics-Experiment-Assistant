/** 热学 · 量热与传热（domain: thermal / topic: heat-transfer）— 准稳态导热实验课程公式 */
import { F, FormulaDefinition } from '../types';

const DOC = '2026秋物理实验A(1)教学资料';

export const HEAT_TRANSFER_FORMULAS: FormulaDefinition[] = [
  F({
    id: 'fourier-law',
    title: 'Fourier 导热定律',
    domain: 'thermal',
    topic: 'heat-transfer',
    tags: ['导热', 'Fourier'],
    latex: 'q = -\\lambda\\, \\frac{dt}{dx}',
    expression: 'lam * dt / dx',
    result: { symbol: 'q', label: '热流密度大小', unit: 'W/m2' },
    variables: [
      { name: 'lam', label: '热导率 λ', unit: 'W/(m·K)' },
      { name: 'dt', label: '温差 |Δt|', unit: 'K', quantityKind: 'temperature-difference' },
      { name: 'dx', label: '厚度 Δx', unit: 'm' },
    ],
    solveFor: ['lam', 'dt', 'dx'],
    solutions: { lam: 'q * dx / dt', dt: 'q * dx / lam', dx: 'dt * lam / q' },
    provenance: { status: 'source-explicit', document: DOC, section: '准稳态法测不良导体导热系数和比热' },
    uncertainty: { propagatable: true },
    examples: [
      { title: '稳态平板：λ=0.2、Δt=10 K、d=0.01 m', inputs: { lam: 0.2, dt: 10, dx: 0.01 }, expect: 200 },
    ],
  }),
  F({
    id: 'quasi-steady-lambda',
    title: '准稳态法热导率',
    domain: 'thermal',
    topic: 'heat-transfer',
    tags: ['热导率', '准稳态'],
    latex: '\\Delta t = \\frac{q_c R}{2\\lambda} \\;\\Rightarrow\\; \\lambda = \\frac{q_c R}{2\\Delta t}',
    expression: 'qc * R / (2 * dt)',
    result: { symbol: '\\lambda', label: '热导率', unit: 'W/(m·K)' },
    variables: [
      { name: 'qc', label: '加热面热流密度 qc', unit: 'W/m2' },
      { name: 'R', label: '样品半厚度 R', unit: 'm' },
      { name: 'dt', label: '上下两面温差 Δt', unit: 'K', quantityKind: 'temperature-difference' },
    ],
    solveFor: ['dt', 'qc'],
    solutions: { dt: 'qc * R / (2 * lam)', qc: '2 * lam * dt / R' },
    provenance: { status: 'source-explicit', document: DOC, section: '准稳态法测不良导体导热系数和比热' },
    uncertainty: { propagatable: true, note: '分母含半厚度 R，勿漏（AGENTS §21.5 是 c 的公式，λ 同样注意）' },
    examples: [
      { title: 'qc=500、R=0.01、Δt=25 K', inputs: { qc: 500, R: 0.01, dt: 25 }, expect: 0.1 },
    ],
  }),
  F({
    id: 'quasi-steady-specific-heat',
    title: '准稳态法比热',
    domain: 'thermal',
    topic: 'heat-transfer',
    tags: ['比热', '准稳态'],
    latex: 'q_c F = c\\,\\rho\\, R\\, F\\, \\frac{dt}{d\\tau} \\;\\Rightarrow\\; c = \\frac{q_c}{\\rho R\\, (dt/d\\tau)}',
    expression: 'qc / (rho * R * dTdt)',
    result: { symbol: 'c', label: '比热容', unit: 'J/(kg·K)' },
    variables: [
      { name: 'qc', label: '热流密度 qc', unit: 'W/m2' },
      { name: 'rho', label: '密度 ρ（有机玻璃讲义值 1196 kg/m³）', unit: 'kg/m3', defaultValue: 1196 },
      { name: 'R', label: '半厚度 R', unit: 'm' },
      { name: 'dTdt', label: '温升速率 dt/dτ', unit: 'K/s' },
    ],
    solveFor: [],
    provenance: { status: 'source-explicit', document: DOC, section: '准稳态法测不良导体导热系数和比热' },
    uncertainty: { propagatable: true, note: '分母包含 ρ·R·(dt/dτ)，R 是半厚度，不要漏（AGENTS §21.5）' },
    examples: [
      { title: 'qc=500、ρ=1196、R=0.01、dTdτ=2e-4 K/s', inputs: { qc: 500, rho: 1196, R: 0.01, dTdt: 2e-4 }, expect: 500 / (1196 * 0.01 * 2e-4) },
    ],
  }),
  F({
    id: 'heat-flux-electrical',
    title: '电加热热流密度',
    domain: 'thermal',
    topic: 'heat-transfer',
    tags: ['热流密度', '加热功率'],
    latex: 'q_c = \\frac{U_{heat}^2}{2\\, F\\, r}',
    expression: 'U^2 / (2 * F * r)',
    result: { symbol: 'q_c', label: '热流密度', unit: 'W/m2' },
    variables: [
      { name: 'U', label: '加热电压 Uheat（前后平均）', unit: 'V' },
      { name: 'F', label: '加热面（样品横截）面积 F', unit: 'm2' },
      { name: 'r', label: '加热器电阻 r（每面）', unit: 'Ω' },
    ],
    solveFor: ['U'],
    solutions: { U: 'sqrt(qc * 2 * F * r)' },
    provenance: { status: 'source-explicit', document: DOC, section: '准稳态法测不良导体导热系数和比热' },
    examples: [
      { title: 'U=100 V、F=1e-3 m²、r=100 Ω', inputs: { U: 100, F: 1e-3, r: 100 }, expect: 5e4 },
    ],
  }),
  F({
    id: 'thermocouple-linear',
    title: '热电偶线性温差换算',
    domain: 'thermal',
    topic: 'heat-transfer',
    tags: ['热电偶', '温差'],
    latex: 't = \\frac{U}{S},\\quad S = 40\\ \\mu\\mathrm{V}/\\mathrm{\\degree C}',
    expression: 'U / S',
    result: { symbol: 't', label: '温差', unit: 'K', quantityKind: 'temperature-difference' },
    variables: [
      { name: 'U', label: '热电势 U', unit: 'V' },
      { name: 'S', label: '灵敏度 S（默认 40 μV/℃）', unit: '', defaultValue: 40e-6 },
    ],
    solveFor: ['U'],
    solutions: { U: 't * S' },
    provenance: { status: 'source-explicit', document: DOC, section: '准稳态法测不良导体导热系数和比热' },
    examples: [
      { title: 'U=1 mV、S=40 μV/℃', inputs: { U: 1e-3, S: 40e-6 }, expect: 25 },
    ],
  }),
];
