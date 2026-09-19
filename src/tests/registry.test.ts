/** 公式注册表完整性测试（plan §20：全部条目落地并通过测试） */
import { describe, expect, it } from 'vitest';
import { VISIBLE_FORMULAS, getFormula, searchFormulas } from '../formulas/registry';
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
      const c = compileExpression(f.expression);
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

  it('示例数值验证', () => {
    let checked = 0;
    for (const f of VISIBLE_FORMULAS) {
      for (const ex of f.examples ?? []) {
        const scope: Record<string, number> = {};
        for (const c of f.constants ?? []) scope[c.name] = c.value;
        Object.assign(scope, ex.inputs);
        const value = f.customCompute
          ? f.customCompute(scope)
          : evaluateExpression(compileExpression(f.expression), scope);
        expect(value).toBeCloseTo(ex.expect, 6);
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
