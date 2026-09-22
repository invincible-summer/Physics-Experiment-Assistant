import { describe, expect, it } from 'vitest';
import { HALL_FORMULAS } from '../formulas/em/hall';
import { ConstantDefinition, FormulaDefinition } from '../formulas/types';
import { convert, dimEqual, dimDivide, getUnitDef } from '../core/quantity';
import { propagateUncertainty } from '../core/uncertainty';
import { TSINGHUA_A1_2026 } from '../standards/registry';
import { buildFormulaProcessMarkdown } from '../export';
import { makeResult } from '../core/results';

describe('公式计算复核', () => {
  it('载流子浓度传播包含电荷常量', () => {
    const formula = HALL_FORMULAS.find((f: FormulaDefinition) => f.id === 'carrier-density')!;
    const constants = formula.constants as ConstantDefinition[];
    const result = propagateUncertainty(formula.expression!, [{ symbol: 'RH', value: 2, uncertainty: 0.1 }], TSINGHUA_A1_2026.sigfig, {}, Object.fromEntries(constants.map((c: ConstantDefinition) => [c.name, c.value])));
    expect(result.relative).toBeCloseTo(0.05, 12);
  });
  it('霍尔灵敏度为 RH/d，且不能换算为霍尔系数', () => {
    const unit = HALL_FORMULAS.find((f: FormulaDefinition) => f.id === 'hall-voltage')!.variables[0].unit;
    expect(dimEqual(getUnitDef(unit).dim, dimDivide(getUnitDef('m3/C').dim, getUnitDef('m').dim))).toBe(true);
    expect(() => convert(1, unit, 'm3/C')).toThrow();
  });
  it('完整过程保留尾随零、空白与零不确定度的差异', () => {
    const formula = HALL_FORMULAS[0];
    const text = buildFormulaProcessMarkdown(formula, makeResult({ id: 'test', title: '测试', unit: 'T', finalText: '4' }), {
      profileName: '测试', mathStyle: 'dollar', inputs: [
        { name: 'I', rawText: '15.0', unit: 'mA', uncertaintyRaw: '0', convertedValue: 0.015, convertedUnit: 'A' },
        { name: 'KH', rawText: '2.00', unit: 'm2/C', uncertaintyRaw: '', convertedValue: 2, convertedUnit: 'm2/C' },
      ],
    });
    expect(text).toContain('| I | 15.0 | mA | 0 | 0.015 | A |');
    expect(text).toContain('| KH | 2.00 | m2/C | 未提供 | 2 | m2/C |');
  });
});
