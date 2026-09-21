/**
 * 工具间数据总线（会话级，sessionStorage 持久化）。
 * 一个工具的输出可以「发送到」另一个工具：统计列 → 拟合/加权平均，拟合参数 → 不确定度传播。
 * 载荷保留原始文本（rawText），不丢失有效数字信息（AGENTS.md §4.1）。
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface ToolTablePayload {
  kind: 'table';
  /** 来源描述，例如「快速统计 · 测量列」 */
  source: string;
  headers: string[];
  /** 原始文本行（含有效数字信息） */
  rows: string[][];
  createdAt: string;
}

export interface ToolScalarPayload {
  kind: 'scalar';
  source: string;
  /** 建议变量名（目标页可自行决定如何采用） */
  name: string;
  valueText: string;
  uncText?: string;
  createdAt: string;
}

export type ToolPayload = ToolTablePayload | ToolScalarPayload;

interface ToolBusState {
  payload: ToolPayload | null;
  send: (p: ToolPayload) => void;
  /** 读取并清除当前载荷（目标页「填入」时调用） */
  consume: () => ToolPayload | null;
  dismiss: () => void;
}

export const useToolBus = create<ToolBusState>()(
  persist(
    (set, get) => ({
      payload: null,
      send: (p) => set({ payload: p }),
      consume: () => {
        const p = get().payload;
        set({ payload: null });
        return p;
      },
      dismiss: () => set({ payload: null }),
    }),
    {
      name: 'pea.tool-bus',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (s) => ({ payload: s.payload }),
    },
  ),
);

/** 便捷构造：从 DataGrid 行提取非空列文本 */
export function tablePayload(source: string, columns: { header: string; index: number }[], rows: string[][]): ToolTablePayload {
  const used = columns.filter((c) => rows.some((r) => (r[c.index] ?? '').trim() !== ''));
  return {
    kind: 'table',
    source,
    headers: used.map((c) => c.header),
    rows: rows
      .filter((r) => used.some((c) => (r[c.index] ?? '').trim() !== ''))
      .map((r) => used.map((c) => (r[c.index] ?? '').trim())),
    createdAt: new Date().toISOString(),
  };
}
