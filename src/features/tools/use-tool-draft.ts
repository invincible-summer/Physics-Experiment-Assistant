/**
 * 工具页草稿持久化：localStorage `pea.tool-draft.<key>`。
 * 刷新/路由切换后输入不丢失；JSON 解析失败时回落到初始值。
 */
import { useEffect, useRef, useState } from 'react';

import { toast } from '../../components/ui';

const PREFIX = 'pea.tool-draft.';

export function useToolDraft<T>(key: string, initial: T, restore?: (raw: unknown) => T): [T, (v: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      if (raw !== null) {
        const parsed: unknown = JSON.parse(raw);
        if (restore) return restore(parsed);
        return { ...initial, ...parsed as Partial<T> };
      }
    } catch { /* 损坏草稿直接忽略 */ }
    return initial;
  });

  const warned = useRef(false);
  useEffect(() => {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
      warned.current = false;
    } catch {
      if (!warned.current) toast('浏览器未能保存输入草稿。当前页面仍可使用，请先复制或导出重要数据，避免刷新后丢失。');
      warned.current = true;
    }
  }, [key, value]);

  return [value, setValue];
}

export function clearToolDraft(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch { /* noop */ }
}
