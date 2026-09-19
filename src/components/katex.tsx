/** KaTeX 渲染组件：保留可访问文本（AGENTS.md §12） */
import { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

export function Tex({ tex, display = false }: { tex: string; display?: boolean }) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(tex, {
        displayMode: display,
        throwOnError: false,
        output: 'htmlAndMathml',
      });
    } catch {
      return `<span class="muted">${escapeHtml(tex)}</span>`;
    }
  }, [tex, display]);
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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
