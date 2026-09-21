/** 工作台步骤完成度判定（done / attention / todo） */
import { describe, expect, it } from 'vitest';
import { stepStatuses } from '../experiments/engine';
import { ExperimentDefinition, ExperimentComputation } from '../experiments/types';

const base: ExperimentDefinition = {
  id: 'demo',
  version: 1,
  title: '演示实验',
  category: 'demo',
  tags: [],
  reportType: 'minimal',
  safety: [],
  provenance: { status: 'general' },
  metadataFields: [],
  params: [
    { id: 'g', label: '重力加速度' },
    { id: 'name', label: '备注', kind: 'text' },
  ],
  datasets: [
    {
      id: 't1',
      title: '表1',
      columns: [
        { id: 'x', header: 'x' },
        { id: 'y', header: 'y' },
      ],
    },
  ],
  fits: [{ id: 'f1', title: '拟合', tableId: 't1', xCol: 'x', yCol: 'y', mode: 'ols', modelLatex: 'y=a+bx' }],
  plots: [{ id: 'p1', title: '图', tableId: 't1', xCol: 'x', yCol: 'y', xLabel: 'x', yLabel: 'y' }],
  steps: [
    { id: 's-note', title: '说明', blocks: [{ type: 'note', text: '纯说明' }] },
    { id: 's-params', title: '参数', blocks: [{ type: 'params', fields: ['g', 'name'] }] },
    { id: 's-table', title: '数据', blocks: [{ type: 'table', tableId: 't1' }] },
    { id: 's-fit', title: '拟合', blocks: [{ type: 'fits', fitIds: ['f1'] }] },
    { id: 's-plot', title: '图', blocks: [{ type: 'plot', plotId: 'p1' }] },
    { id: 's-res', title: '结果', blocks: [{ type: 'results', resultIds: ['r1'] }] },
  ],
  compute: () => ({ results: [], fits: {}, custom: {}, diagnostics: [] }),
};

const emptyState = { params: {}, tables: {}, excludedRows: {} };

describe('stepStatuses', () => {
  it('全空：说明步 done，其余 todo', () => {
    const st = stepStatuses(base, emptyState, null);
    expect(st['s-note']).toBe('done');
    expect(st['s-params']).toBe('todo');
    expect(st['s-table']).toBe('todo');
    expect(st['s-fit']).toBe('todo');
    expect(st['s-plot']).toBe('todo');
    expect(st['s-res']).toBe('todo');
  });

  it('文本参数不参与数值判定；数值参数填好则 done', () => {
    const st = stepStatuses(base, { ...emptyState, params: { g: '9.8', name: '随便什么文字' } }, null);
    expect(st['s-params']).toBe('done');
  });

  it('参数非法 → attention', () => {
    const st = stepStatuses(base, { ...emptyState, params: { g: 'abc' } }, null);
    expect(st['s-params']).toBe('attention');
  });

  it('表格有数据 done；非法单元格或排除行 → attention', () => {
    const withData = { ...emptyState, tables: { t1: [['1', '2'], ['3', '4']] } };
    expect(stepStatuses(base, withData, null)['s-table']).toBe('done');
    expect(stepStatuses(base, withData, null)['s-plot']).toBe('done');

    const bad = { ...emptyState, tables: { t1: [['1', 'oops']] } };
    expect(stepStatuses(base, bad, null)['s-table']).toBe('attention');

    const excluded = { ...emptyState, tables: { t1: [['1', '2'], ['3', '4']] }, excludedRows: { t1: [0] } };
    expect(stepStatuses(base, excluded, null)['s-table']).toBe('attention');
  });

  it('拟合数据不足 → todo；其他拟合错误 → attention；成功 → done', () => {
    const insufficient: ExperimentComputation = { results: [], fits: { f1: { error: '拟合 X：有效数据点不足（需 ≥3，当前 1）' } }, custom: {}, diagnostics: [] };
    expect(stepStatuses(base, emptyState, insufficient)['s-fit']).toBe('todo');

    const broken: ExperimentComputation = { results: [], fits: { f1: { error: '拟合 X 失败：Sxx=0' } }, custom: {}, diagnostics: [] };
    expect(stepStatuses(base, emptyState, broken)['s-fit']).toBe('attention');

    const ok: ExperimentComputation = {
      results: [],
      fits: { f1: { spec: base.fits[0], origin: undefined } as never },
      custom: {},
      diagnostics: [],
    };
    expect(stepStatuses(base, emptyState, ok)['s-fit']).toBe('done');
  });

  it('结果存在 → done；缺失 → todo', () => {
    const comp: ExperimentComputation = {
      results: [{ id: 'r1', title: '结果1', steps: [] } as never],
      fits: {},
      custom: {},
      diagnostics: [],
    };
    expect(stepStatuses(base, emptyState, comp)['s-res']).toBe('done');
    expect(stepStatuses(base, emptyState, null)['s-res']).toBe('todo');
  });
});
