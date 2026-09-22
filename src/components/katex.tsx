/** KaTeX 渲染组件：保留可访问文本（AGENTS.md §12） */
import { useEffect, useRef } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

export function Tex({ tex, display = false }: { tex: string; display?: boolean }) {
  const host = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!host.current) return;
    try {
      katex.render(tex, host.current, {
        displayMode: display,
        throwOnError: false,
        trust: false,
        output: 'htmlAndMathml',
      });
    } catch {
      host.current.textContent = tex;
    }
  }, [tex, display]);
  return <span className={display ? 'tex tex-display' : 'tex tex-inline'} ref={host}>{tex}</span>;
}

/** 单位排版：\mathrm{} 风格 */
export function unitTex(unit: string): string {
  if (!unit) return '';
  return `\\,\\mathrm{${unit.replace(/%/g, '\\%')}}`;
}

/** 行内公式（带单位） */
export function quantityTex(valueTex: string, unit: string): string {
  return unit ? `${valueTex}${unitTex(unit)}` : valueTex;
}
