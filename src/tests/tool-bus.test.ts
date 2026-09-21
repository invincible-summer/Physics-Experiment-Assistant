/** 工具间数据总线：send/consume/dismiss 语义 + tablePayload 行提取 */
import { describe, expect, it } from 'vitest';
import { tablePayload, useToolBus } from '../features/tools/tool-bus';

describe('tool-bus', () => {
  it('send 后 consume 取出并清空载荷', () => {
    const s = useToolBus.getState();
    s.send({ kind: 'scalar', source: '线性拟合', name: 'b', valueText: '1.23', uncText: '0.04', createdAt: 't' });
    const p = useToolBus.getState().consume();
    expect(p?.kind).toBe('scalar');
    expect((p as { name: string }).name).toBe('b');
    expect(useToolBus.getState().payload).toBeNull();
  });

  it('dismiss 丢弃载荷', () => {
    const s = useToolBus.getState();
    s.send({ kind: 'table', source: 'x', headers: ['a'], rows: [['1']], createdAt: 't' });
    useToolBus.getState().dismiss();
    expect(useToolBus.getState().payload).toBeNull();
  });

  it('tablePayload 只提取有内容的列与行，保留原始文本', () => {
    const rows = [
      ['1.0', ''],
      ['', ''],
      ['2.50', 'abc'],
    ];
    const p = tablePayload('测试', [{ header: 'x', index: 0 }, { header: 'y', index: 1 }], rows);
    expect(p.headers).toEqual(['x', 'y']);
    expect(p.rows).toEqual([['1.0', ''], ['2.50', 'abc']]);
    expect(p.source).toBe('测试');
  });

  it('tablePayload 全空表产生空载荷而非异常', () => {
    const p = tablePayload('空', [{ header: 'x', index: 0 }], [[''], ['']]);
    expect(p.headers).toEqual([]);
    expect(p.rows).toEqual([]);
  });
});
