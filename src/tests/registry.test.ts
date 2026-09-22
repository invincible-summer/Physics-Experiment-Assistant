/** 公式注册表完整性测试（plan §10.4、§10.5：全部条目落地并通过测试） */
import { describe, expect, it } from 'vitest';
import { VISIBLE_FORMULAS, getFormula, searchFormulas, listFormulas, listDomains, listTopics, validateRegistry, FormulaDomain } from '../formulas/registry';
import { compileExpression, evaluateExpression } from '../core/expression';

/** plan.md §20 要求的最低条目 */
const REQUIRED_IDS = [
  // 测量
  'mean', 'residual', 'sample-std', 'sem', 'course-type-a', 'course-type-b',
  'course-total-uncertainty', 'relative-uncertainty', 'indirect-rss', 'linear-regression',
  'fit-correlation', 'fit-parameter-uncertainty', 'half-range',
  // 仪器
  'analog-meter-error', 'digital-meter-reading-digits', 'digital-meter-reading-range',
  'digital-meter-combined', 'resistance-box-error',
  // 摩擦
  'weight-from-mass', 'capstan',
  // 霍尔
  'hall-voltage', 'hall-four-direction-combination', 'hall-coefficient', 'hall-sensitivity',
  'carrier-density', 'magnetoresistance',
  // 热导
  'fourier-law', 'quasi-steady-lambda', 'quasi-steady-specific-heat', 'heat-flux-electrical',
  'thermocouple-linear',
  // 振动
  'damped-omega', 'damped-period', 'damping-ratio', 'time-constant', 'quality-factor',
  'log-decrement', 'forced-amplitude', 'forced-phase', 'resonance-frequency', 'zeta-from-fit-slope',
  // 示波器/声速/电路
  'scope-voltage-div', 'scope-period-div', 'frequency-period', 'phase-time', 'lissajous-frequency',
  'sound-speed', 'ideal-gas-sound-speed', 'dry-air-sound-speed', 'humid-air-sound-speed',
  'rc-charge', 'rc-differentiator', 'lc-resonance',
  // 光学
  'thin-lens', 'magnification', 'bessel-focal-length', 'focimeter', 'concave-autocollimation',
  'michelson-equal-inclination', 'michelson-wavelength', 'michelson-white-light-plate',
  // GB/T
  'standard-uncertainty-type-a', 'rectangular-standard-uncertainty', 'triangular-standard-uncertainty',
  'normal-coverage-to-standard', 'combined-standard-uncertainty-independent',
  'combined-standard-uncertainty-correlated', 'effective-dof', 'expanded-uncertainty',
];

describe('公式注册表（plan §20 完整性）', () => {
  it(`全部 ${REQUIRED_IDS.length} 个必需条目存在`, () => {
    for (const id of REQUIRED_IDS) {
      expect(getFormula(id), `缺少公式 ${id}`).toBeDefined();
    }
  });

  it('每个公式：表达式与全部显式解可编译，provenance 已填', () => {
    for (const f of VISIBLE_FORMULAS) {
      expect(f.provenance.status, `${f.id} provenance`).toBeTruthy();
      expect(f.latex.length, `${f.id} latex`).toBeGreaterThan(3);
      if (f.kind === 'reference') {
        expect(f.conditions, `${f.id} reference 需有适用条件`).toBeTruthy();
        continue;
      }
      const c = compileExpression(f.expression!);
      // customCompute 公式自行组织输入，表达式仅作符号表示
      if (!f.customCompute) {
        for (const v of f.variables) {
          expect(c.variables, `${f.id} 变量 ${v.name}`).toContain(v.name);
        }
      }
      for (const [target, expr] of Object.entries(f.solutions ?? {})) {
        expect(() => compileExpression(expr), `${f.id} 解 ${target}`).not.toThrow();
      }
    }
  });

  it('示例数值验证（相对容差：跨 40 个数量级的物理量不能用绝对小数位）', () => {
    let checked = 0;
    for (const f of VISIBLE_FORMULAS) {
      for (const ex of f.examples ?? []) {
        const scope: Record<string, number> = {};
        for (const c of f.constants ?? []) scope[c.name] = c.value;
        Object.assign(scope, ex.inputs);
        const value = f.customCompute
          ? f.customCompute(scope)
          : evaluateExpression(compileExpression(f.expression!), scope);
        expect(
          Math.abs(value - ex.expect) <= 1e-9 * Math.max(1, Math.abs(ex.expect)),
          `${f.id}: computed ${value} expected ${ex.expect}`,
        ).toBe(true);
        expect(Number.isFinite(value), f.id).toBe(true);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('搜索：中文/别名/符号命中', () => {
    expect(searchFormulas('霍尔').length).toBeGreaterThan(3);
    expect(searchFormulas('capstan').map((f) => f.id)).toContain('capstan');
    expect(searchFormulas('绞盘').map((f) => f.id)).toContain('capstan');
    expect(searchFormulas('UH').map((f) => f.id)).toContain('hall-coefficient');
    expect(searchFormulas('').length).toBe(VISIBLE_FORMULAS.length);
  });

  it('课程与 GB/T 公式族标注不同来源文档', () => {
    const gbt = getFormula('rectangular-standard-uncertainty')!;
    expect(gbt.provenance.document).toContain('GB/T');
    const course = getFormula('course-type-b')!;
    expect(course.provenance.note).toContain('隔离');
  });

  it('静态校验（plan §10.4）：id/domain/topic/latex/expression/单位/来源全部合法', () => {
    expect(validateRegistry()).toEqual([]);
  });

  it('旧课程公式 provenance 未被降级为 general', () => {
    for (const id of ['hall-voltage', 'course-type-a', 'quasi-steady-lambda', 'damped-omega', 'thin-lens', 'michelson-wavelength']) {
      const f = getFormula(id)!;
      expect(['source-explicit', 'source-derived'], id).toContain(f.provenance.status);
    }
  });

  it('reference 公式：无表达式、无求解目标、有适用条件', () => {
    const refs = VISIBLE_FORMULAS.filter((f) => f.kind === 'reference');
    expect(refs.length).toBeGreaterThanOrEqual(8);
    for (const f of refs) {
      expect(f.expression, f.id).toBeUndefined();
      expect(f.solveFor, f.id).toEqual([]);
      expect(f.conditions, f.id).toBeTruthy();
    }
  });
});

describe('大学物理主干覆盖（plan §6、§10.5）', () => {
  const COVERAGE: ReadonlyArray<[FormulaDomain, string]> = [
    // 6.1 测量
    ['measurement', 'statistics'], ['measurement', 'uncertainty'], ['measurement', 'instruments'], ['measurement', 'data-processing'],
    // 6.2–6.4 力学
    ['mechanics', 'kinematics'], ['mechanics', 'dynamics'], ['mechanics', 'energy-momentum'],
    ['mechanics', 'rotation'], ['mechanics', 'gravity'], ['mechanics', 'elasticity'],
    ['mechanics', 'fluids'], ['mechanics', 'friction'],
    // 6.6 热学
    ['thermal', 'gas'], ['thermal', 'heat-transfer'], ['thermal', 'thermodynamics'],
    // 6.7–6.10 电磁
    ['electromagnetism', 'electrostatics'], ['electromagnetism', 'potential-capacitance'],
    ['electromagnetism', 'circuits'], ['electromagnetism', 'magnetism'], ['electromagnetism', 'hall'],
    ['electromagnetism', 'induction'], ['electromagnetism', 'ac'], ['electromagnetism', 'em-waves'],
    // 6.5 振动波声
    ['oscillations-waves', 'oscillations'], ['oscillations-waves', 'waves'],
    ['oscillations-waves', 'sound'], ['oscillations-waves', 'oscilloscope'],
    // 6.11–6.12 光学
    ['optics', 'geometric'], ['optics', 'interference'], ['optics', 'diffraction'], ['optics', 'polarization'],
    // 6.13–6.15 近代物理
    ['modern', 'relativity'], ['modern', 'quantum'], ['modern', 'atomic'],
    ['modern', 'solid'], ['modern', 'nuclear'],
    // 标准
    ['standards', 'gbt'],
  ];

  it('全部主干领域/专题都有公式', () => {
    for (const [domain, topic] of COVERAGE) {
      expect(listFormulas({ domain, topic }).length, `${domain}/${topic}`).toBeGreaterThan(0);
    }
  });

  it('全库规模处于计划区间（200–250 目标；150–300 为硬护栏）', () => {
    expect(VISIBLE_FORMULAS.length).toBeGreaterThanOrEqual(150);
    expect(VISIBLE_FORMULAS.length).toBeLessThanOrEqual(300);
  });

  it('一级 domain 数量保持约 8 个', () => {
    expect(listDomains().length).toBeLessThanOrEqual(9);
  });

  it('plan §6 关键公式可按 id/标题/别名检索', () => {
    const ids = [
      'coulomb-law', 'gauss-law', 'ohms-law', 'electric-power', 'lorentz-force', 'straight-wire-field',
      'faraday-law', 'series-rlc-impedance', 'ideal-gas-law', 'carnot-efficiency', 'bernoulli-equation',
      'escape-velocity', 'double-slit-fringe-spacing', 'grating-equation', 'malus-law',
      'lorentz-factor', 'photoelectric-effect', 'de-broglie-wavelength', 'radioactive-decay', 'half-life',
    ];
    for (const id of ids) expect(getFormula(id), id).toBeDefined();
    expect(searchFormulas('牛顿第二定律').map((f) => f.id)).toContain('newton-second-law');
    expect(searchFormulas('动量守恒').map((f) => f.id)).toContain('inelastic-collision-1d');
    expect(searchFormulas('波义耳').length + searchFormulas('理想气体').length).toBeGreaterThan(0);
  });
});

describe('实验注册表', () => {
  it('7 个实验均可获取且 compute 空状态不崩溃', async () => {
    const { listExperiments } = await import('../experiments');
    const { TSINGHUA_A1_2026 } = await import('../standards/registry');
    const exps = listExperiments();
    expect(exps.map((e) => e.id)).toEqual(['friction', 'hall', 'thermal', 'damping', 'scope-sound', 'lens', 'michelson']);
    for (const e of exps) {
      const out = e.compute({ params: {}, tables: {}, excludedRows: {} }, TSINGHUA_A1_2026);
      expect(Array.isArray(out.results)).toBe(true);
      expect(Array.isArray(out.diagnostics)).toBe(true);
    }
  });

  it('实验数据表列引用合法（派生表达式可编译）', async () => {
    const { listExperiments } = await import('../experiments');
    for (const e of listExperiments()) {
      for (const ds of e.datasets) {
        const colIds = new Set(ds.columns.map((c) => c.id));
        for (const col of ds.columns) {
          if (col.kind === 'derived' && col.expression) {
            const expr = col.expression;
            expect(() => compileExpression(expr), `${e.id}/${ds.id}/${col.id}`).not.toThrow();
            const c = compileExpression(expr);
            // 派生表达式引用的变量必须是本表列、参数，或 compute() 注入的作用域量
            for (const v of c.variables) {
              expect(
                colIds.has(v) || e.params.some((p) => p.id === v) || v === 'U1_0' || v === 'w0',
                `${e.id}/${col.id} 引用 ${v}`,
              ).toBe(true);
            }
          }
        }
      }
      for (const fit of e.fits) {
        const ds = e.datasets.find((d) => d.id === fit.tableId);
        expect(ds, `${e.id} 拟合 ${fit.id} 引用表`).toBeDefined();
        expect(ds!.columns.some((c) => c.id === fit.xCol)).toBe(true);
        expect(ds!.columns.some((c) => c.id === fit.yCol)).toBe(true);
      }
      for (const plot of e.plots) {
        const ds = e.datasets.find((d) => d.id === plot.tableId);
        expect(ds, `${e.id} 图 ${plot.id} 引用表`).toBeDefined();
        expect(ds!.columns.some((c) => c.id === plot.xCol)).toBe(true);
        expect(ds!.columns.some((c) => c.id === plot.yCol)).toBe(true);
      }
    }
  });
});
