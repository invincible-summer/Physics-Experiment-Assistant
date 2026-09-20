import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MarkdownBlock, MarkdownInline } from '../components/Markdown';

describe('Markdown UI renderer', () => {
  it('renders inline emphasis, code, links and math safely', () => {
    const html = renderToStaticMarkup(createElement(MarkdownInline, {
      children: '**粗体** *强调* `code` [链接](https://example.com) $x^2$',
    }));
    expect(html).toContain('<strong>粗体</strong>');
    expect(html).toContain('<em>强调</em>');
    expect(html).toContain('<code>code</code>');
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('katex');
  });

  it('keeps Markdown link labels but disables anchors inside controls', () => {
    const html = renderToStaticMarkup(createElement(MarkdownInline, {
      children: '**打开** [说明](https://example.com)',
      allowLinks: false,
    }));
    expect(html).toContain('<strong>打开</strong>');
    expect(html).toContain('说明');
    expect(html).not.toContain('<a ');
  });

  it('never emits unsafe javascript links or raw HTML', () => {
    const inline = renderToStaticMarkup(createElement(MarkdownInline, {
      children: '[危险](javascript:alert(1))',
    }));
    expect(inline).toContain('危险');
    expect(inline).not.toContain('<a ');
    expect(inline).not.toContain('javascript:');

    const block = renderToStaticMarkup(createElement(MarkdownBlock, {
      children: '<script>alert(1)</script>',
    }));
    expect(block).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(block).not.toContain('<script>');
  });

  it('renders Markdown lists, task lists and tables', () => {
    const html = renderToStaticMarkup(createElement(MarkdownBlock, {
      children: [
        '- **第一项**',
        '- `第二项`',
        '',
        '- [x] 已完成',
        '- [ ] 未完成',
        '',
        '| 列 | 值 |',
        '| --- | ---: |',
        '| A | **1** |',
      ].join('\n'),
    }));
    expect(html).toContain('<ul>');
    expect(html).toContain('<strong>第一项</strong>');
    expect(html).toContain('<code>第二项</code>');
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('<table');
    expect(html).toContain('<strong>1</strong>');
  });

  it('supports block headings, quotes, fenced code and display math', () => {
    const html = renderToStaticMarkup(createElement(MarkdownBlock, {
      children: [
        '## 标题',
        '',
        '> **说明**',
        '',
        '```text',
        'a < b',
        '```',
        '',
        '$$',
        'x^2+y^2',
        '$$',
      ].join('\n'),
    }));
    expect(html).toContain('<h2>标题</h2>');
    expect(html).toContain('<blockquote>');
    expect(html).toContain('<strong>说明</strong>');
    expect(html).toContain('<pre');
    expect(html).toContain('a &lt; b');
    expect(html).toContain('katex-display');
  });
});
