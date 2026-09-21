/** DataGrid 撤销/重做历史：结构变更记录 + 聚焦快照模型（修复旧实现 undo 恒 no-op 的缺陷） */
import { describe, expect, it } from 'vitest';
import { GridHistory, cloneRows, rowsEqual } from '../components/grid-history';

describe('grid-history', () => {
  it('record 后 undo 返回上一状态', () => {
    const h = new GridHistory();
    const s0 = [['1', '2']];
    const s1 = [['3', '4']];
    h.record(s0);
    expect(h.canUndo).toBe(true);
    expect(h.undo(s1)).toEqual(s0);
    expect(h.canUndo).toBe(false);
    expect(h.canRedo).toBe(true);
  });

  it('redo 返回被撤销的状态', () => {
    const h = new GridHistory();
    const s0 = [['a']];
    const s1 = [['b']];
    h.record(s0);
    h.undo(s1);
    expect(h.redo(s0)).toEqual(s1);
    expect(h.canRedo).toBe(false);
  });

  it('新记录清空 redo 栈', () => {
    const h = new GridHistory();
    h.record([['1']]);
    h.undo([['2']]);
    h.record([['2']]);
    expect(h.canRedo).toBe(false);
  });

  it('undo 到栈底返回 null（不再变化）', () => {
    const h = new GridHistory();
    expect(h.undo([['x']])).toBeNull();
    h.record([['x']]);
    h.undo([['y']]);
    expect(h.undo([['x']])).toBeNull();
  });

  it('快照模型：snapshot 后无变化时 commitSnapshot 不产生历史', () => {
    const h = new GridHistory();
    const rows = [['1']];
    h.snapshot(rows);
    h.commitSnapshot(rows);
    expect(h.canUndo).toBe(false);
  });

  it('快照模型：snapshot 后有变化时 commitSnapshot 记录旧状态', () => {
    const h = new GridHistory();
    h.snapshot([['1']]);
    h.commitSnapshot([['2']]);
    expect(h.canUndo).toBe(true);
    expect(h.undo([['2']])).toEqual([['1']]);
  });

  it('连续两次 snapshot 只保留第一次（聚焦期间不被覆盖）', () => {
    const h = new GridHistory();
    h.snapshot([['1']]);
    h.snapshot([['1.5']]);
    h.commitSnapshot([['2']]);
    expect(h.undo([['2']])).toEqual([['1']]);
  });

  it('容量有限：超出后丢弃最旧记录', () => {
    const h = new GridHistory(3);
    for (let i = 0; i < 5; i++) h.record([[String(i)]]);
    let cur = [['5']];
    const seen: string[][][] = [];
    let prev = h.undo(cur);
    while (prev) {
      seen.push(prev);
      cur = prev;
      prev = h.undo(cur);
    }
    // LIFO 弹出最近 3 条（4、3、2），最旧的 0、1 被丢弃
    expect(seen).toEqual([[['4']], [['3']], [['2']]]);
  });

  it('cloneRows 深拷贝；rowsEqual 按内容比较', () => {
    const a = [['1', '2'], ['3', '4']];
    const b = cloneRows(a);
    b[0][0] = 'x';
    expect(a[0][0]).toBe('1');
    expect(rowsEqual(a, [['1', '2'], ['3', '4']])).toBe(true);
    expect(rowsEqual(a, [['1', '2'], ['3']])).toBe(false);
    expect(rowsEqual(a, [['1', '2']])).toBe(false);
  });
});
