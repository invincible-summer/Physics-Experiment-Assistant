/** 实验引擎 parseTable：派生列链（派生列引用派生列）与非法单元格计数回归 */
import { describe, expect, it } from 'vitest';
import { parseTable } from '../experiments/engine';
import { DatasetDefinition } from '../experiments/types';

const chained: DatasetDefinition = {
  id: 't',
  title: '链式派生',
  columns: [
    { id: 'MW', header: 'MW' },
    { id: 'MPm', header: 'MP−' },
    { id: 'MPp', header: 'MP+' },
    { id: 'MP', header: 'MP', kind: 'derived', expression: '(MPm + MPp) / 2' },
    { id: 'P', header: 'P', kind: 'derived', expression: 'MP * g' },
  ],
};

describe('parseTable 派生列链', () => {
  it('派生列可引用前面的派生列（P = MP·g）', () => {
    const parsed = parseTable(chained, {
      params: {},
      tables: { t: [['100', '21.0', '23.0'], ['200', '40.5', '43.5']] },
      excludedRows: {},
    }, { g: 9.8 });
    expect(parsed.n).toBe(2);
    expect(parsed.rows[0].MP).toBeCloseTo(22, 12);
    expect(parsed.rows[0].P).toBeCloseTo(215.6, 9);
    expect(parsed.rows[1].P).toBeCloseTo(411.6, 9);
  });

  it('派生表达式失败 → NaN，不抛出', () => {
    const parsed = parseTable(chained, {
      params: {},
      tables: { t: [['100', '21.0', '23.0']] },
      excludedRows: {},
    }); // 缺 g
    expect(parsed.rows[0].MP).toBeCloseTo(22, 12);
    expect(parsed.rows[0].P).toBeNaN();
  });

  it('invalidCells 统计非空但无法解析的单元格；排除行不计', () => {
    const parsed = parseTable(chained, {
      params: {},
      tables: { t: [['100', 'abc', '23.0'], ['50', 'bad', '1.0']] },
      excludedRows: { t: [1] },
    }, { g: 9.8 });
    expect(parsed.invalidCells).toBe(1);
    expect(parsed.n).toBe(1);
  });

  it('全空行与全非法行不进入结果', () => {
    const parsed = parseTable(chained, {
      params: {},
      tables: { t: [['', '', ''], ['abc', '', '']] },
      excludedRows: {},
    }, { g: 9.8 });
    expect(parsed.n).toBe(0);
  });
});
