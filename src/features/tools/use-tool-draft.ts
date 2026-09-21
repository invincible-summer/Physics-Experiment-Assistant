/**
 * 工具页草稿持久化：localStorage `pea.tool-draft.<key>`。
 * 刷新/路由切换后输入不丢失；JSON 解析失败时回落到初始值。
 */
import { useEffect, useState } from 'react';

const PREFIX = 'pea.tool-draft.';

export function useToolDraft<T>(key: string, initial: T): [T, (v: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      if (raw !== null) return { ...initial, ...JSON.parse(raw) };
    } catch { /* 损坏草稿直接忽略 */ }
    return initial;
  });

  useEffect(() => {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch { /* 存储满等异常静默 */ }
  }, [key, value]);

  return [value, setValue];
}

export function clearToolDraft(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch { /* noop */ }
}
