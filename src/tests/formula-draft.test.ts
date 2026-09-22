import { describe, expect, it } from 'vitest';
import { initialFormulaDraft, restoreFormulaDraft } from '../formulas/draft';
import { parseAggregateRows, aggregateValueText } from '../formulas/aggregate-input';
import { MEASUREMENT_FORMULAS } from '../formulas/measurement';

const formula = MEASUREMENT_FORMULAS.find(f => f.id === 'mean')!;

describe('公式草稿恢复', () => {
  it('保留原始精度、目标和数据列', () => {
    const draft = initialFormulaDraft(formula);
    draft.target = 'n';
    draft.vars.S = { raw: '15.0', unit: '', uncRaw: '0.010' };
    draft.rows = [['15.0'], ['oops'], ['']];
    expect(restoreFormulaDraft(JSON.parse(JSON.stringify(draft)), formula)).toEqual(draft);
  });
  it('损坏结构与失效目标回退初始状态', () => {
    for (const raw of [null, [], { target: 'x' }, { ...initialFormulaDraft(formula), target: 'missing' }, { ...initialFormulaDraft(formula), rows: [[42]] }, { ...initialFormulaDraft(formula), vars: { S: { raw: 42 } } }]) {
      expect(restoreFormulaDraft(raw, formula)).toEqual(initialFormulaDraft(formula));
    }
  });
  it('列数不兼容回退，缺省字段恢复默认值', () => {
    expect(restoreFormulaDraft({ ...initialFormulaDraft(formula), rows: [['1', '2']] }, formula)).toEqual(initialFormulaDraft(formula));
    expect(restoreFormulaDraft({ ...initialFormulaDraft(formula), vars: {} }, formula).vars).toEqual(initialFormulaDraft(formula).vars);
  });
});

describe('聚合数据输入', () => {
  it('严格配对并区分空行与异常行，保持原始文本', () => {
    const rows = [['1.00', '2'], ['', ''], ['3', ''], ['bad', '4'], ['5', '6']];
    const original = JSON.stringify(rows);
    expect(parseAggregateRows(rows, 2)).toEqual({ columns: [[1, 5], [2, 6]], valid: 2, empty: 1, skipped: 2 });
    expect(JSON.stringify(rows)).toBe(original);
  });
  it('派生值填入保持原浮点精度', () => {
    for (const value of [1.2345678901234567, 1e-200, 1e200, Math.PI, 0]) {
      expect(Number(aggregateValueText(value))).toBe(value);
    }
  });
});
