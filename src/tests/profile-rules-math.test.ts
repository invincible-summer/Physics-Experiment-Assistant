/**
 * 课程/GB/T 规则摘要数学渲染回归（plan §4、§10.3）：
 * rulesSummary 中的数学表达必须用 $...$ 定界并最终由 KaTeX/MathML 渲染，
 * 不允许退回 Unicode 伪公式（₀.₉₅、√、² 等模拟排版）。
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MarkdownList } from '../components/Markdown';
import { TSINGHUA_A1_2026 } from '../standards/tsinghua-a1-2026';
import { TSINGHUA_FOUNDATION_2020 } from '../standards/tsinghua-foundation-2020';
import { GBT_27418_2017 } from '../standards/gbt-27418-2017';
import { buildCustomProfile, DEFAULT_CUSTOM_OPTIONS } from '../standards/custom';
import { StandardProfile } from '../standards/types';

const PROFILES: StandardProfile[] = [
  TSINGHUA_A1_2026,
  TSINGHUA_FOUNDATION_2020,
  GBT_27418_2017,
  buildCustomProfile(DEFAULT_CUSTOM_OPTIONS),
];

/** Unicode 伪公式字符：一旦出现说明摘要退回了非数学排版 */
const PSEUDO_MATH = [/Δ/, /√/, /ν/, /₀/, /²/];

describe('标准配置规则摘要的数学渲染（plan §4）', () => {
  it('所有 profile 的 rulesSummary 不再包含 Unicode 伪公式', () => {
    for (const p of PROFILES) {
      for (const item of p.rulesSummary) {
        for (const re of PSEUDO_MATH) {
          expect(item, `${p.id}: ${item}`).not.toMatch(re);
        }
      }
    }
  });

  it('每条含数学的 rulesSummary 经 MarkdownList 进入数学定界渲染节点（KaTeX 在客户端渲染）', () => {
    for (const p of PROFILES) {
      const mathItems = p.rulesSummary.filter((i) => i.includes('$'));
      expect(mathItems.length, p.id).toBeGreaterThan(0);
      // SSR 阶段 Tex 输出 tex-inline 占位节点（KaTeX 由浏览器端 useEffect 渲染）；
      // e2e 中断言 .katex 与 <math> 真实存在（plan §10.3.1）。
      const html = renderToStaticMarkup(createElement(MarkdownList, { items: p.rulesSummary }));
      const inlineCount = (html.match(/tex-inline/g) ?? []).length;
      expect(inlineCount, p.id).toBeGreaterThanOrEqual(mathItems.length);
      // 数学源串（$...$ 内容）进入渲染节点而非被当成普通文本吞掉
      expect(html, p.id).toContain('tex-inline');
    }
  });

  it('2026 A(1) 摘要包含课程关键公式且课程数值语义不变', () => {
    const joined = TSINGHUA_A1_2026.rulesSummary.join('\n');
    expect(joined).toContain('$P=0.95$');
    expect(joined).toContain('\\Delta_A=t_{0.95}(\\nu)\\,S_{\\bar{x}}');
    expect(joined).toContain('\\nu=n-1');
    expect(joined).toContain('\\Delta_B=\\Delta_{\\text{仪}}');
    expect(joined).toContain('\\Delta=\\sqrt{\\Delta_A^2+\\Delta_B^2}');
    // 课程简化规则仍保留原语义
    expect(TSINGHUA_A1_2026.simplification?.threshold).toBe(1 / 3);
    expect(TSINGHUA_A1_2026.simplification?.label).toContain('\\Delta_{\\text{仪}}');
    // GB/T 的 B 类教学简化不得混入课程 profile
    expect(TSINGHUA_A1_2026.bType.mode).toBe('instrument-limit');
  });

  it('2020 基础与 GB/T 摘要的数学表达式可渲染且含义不变', () => {
    const f2020 = TSINGHUA_FOUNDATION_2020.rulesSummary.join('\n');
    expect(f2020).toContain('\\Delta_A=t_{0.95}(\\nu)\\,S_{\\bar{x}}');
    expect(f2020).toContain('\\Delta_B=\\Delta_{\\text{仪}}');

    const gbt = GBT_27418_2017.rulesSummary.join('\n');
    expect(gbt).toContain('u=a/\\sqrt{3}');
    expect(gbt).toContain('u_c^2(y)=\\sum_i c_i^2\\,u^2(x_i)');
    expect(gbt).toContain('U=k\\,u_c');
    // GB/T 无课程 ΔB=Δ仪 简化（模式隔离）
    expect(GBT_27418_2017.bType.mode).toBe('distribution');
    expect(GBT_27418_2017.simplification).toBeUndefined();
  });
});
