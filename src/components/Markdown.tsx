/** 
 * Lightweight, safe Markdown renderer for UI copy.
 *
 * Goals:
 * - no extra runtime dependency;
 * - React-node rendering only (never inject raw HTML);
 * - inline Markdown for buttons/labels/badges;
 * - block Markdown for prose/lists/notices;
 * - optional KaTeX for $...$, $$...$$ and \\(...\\) / \\[...\\].
 *
 * This intentionally implements the UI subset we need instead of a full
 * CommonMark parser. Raw HTML and images are not rendered.
 */
import { Children, Fragment, ReactNode, useMemo } from 'react';
import { Tex } from './katex';

export interface MarkdownInlineProps {
  children: string | number | null | undefined;
  /** Links are disabled inside interactive controls to avoid nested interactive content. */
  allowLinks?: boolean;
  allowMath?: boolean;
  className?: string;
}

export interface MarkdownBlockProps {
  children: string | number | null | undefined;
  allowLinks?: boolean;
  allowMath?: boolean;
  className?: string;
}

export function MarkdownInline({
  children,
  allowLinks = true,
  allowMath = true,
  className,
}: MarkdownInlineProps) {
  const source = children == null ? '' : String(children);
  const nodes = useMemo(
    () => parseInline(source, { allowLinks, allowMath }),
    [source, allowLinks, allowMath],
  );
  if (className) return <span className={`md-inline ${className}`}>{nodes}</span>;
  return <>{nodes}</>;
}

export function MarkdownBlock({
  children,
  allowLinks = true,
  allowMath = true,
  className,
}: MarkdownBlockProps) {
  const source = children == null ? '' : String(children);
  const nodes = useMemo(
    () => parseBlocks(source, { allowLinks, allowMath }),
    [source, allowLinks, allowMath],
  );
  return <div className={`md-block${className ? ` ${className}` : ''}`}>{nodes}</div>;
}

export function MarkdownList({
  items,
  ordered = false,
  className,
}: {
  items: Array<string | number>;
  ordered?: boolean;
  className?: string;
}) {
  const Tag = ordered ? 'ol' : 'ul';
  return (
    <Tag className={`md-list${className ? ` ${className}` : ''}`}>
      {items.map((item, i) => (
        <li key={i}><MarkdownInline>{item}</MarkdownInline></li>
      ))}
    </Tag>
  );
}

/** Render primitive UI text as Markdown while preserving existing React elements. */
export function markdownInlineNode(node: ReactNode, allowLinks = true): ReactNode {
  if (typeof node === 'string' || typeof node === 'number') {
    return <MarkdownInline allowLinks={allowLinks}>{node}</MarkdownInline>;
  }
  if (Array.isArray(node)) {
    return Children.map(node, (child) => markdownInlineNode(child, allowLinks));
  }
  return node;
}

interface ParseOptions {
  allowLinks: boolean;
  allowMath: boolean;
}

const INLINE_TOKEN =
  /(\\[\\`*_[\]$~])|(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(__[^_\n]+__)|(~~[^~\n]+~~)|(\[[^\]\n]+\]\([^)\n]+\))|(\\\([^\n]*?\\\))|(\$[^$\n]+\$)|(\*[^*\n]+\*)|(_[^_\n]+_)/g;

function parseInline(source: string, options: ParseOptions, keyPrefix = 'i'): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let index = 0;
  // A fresh RegExp per invocation is required because parseInline is recursive.
  // Sharing lastIndex across nested calls would corrupt the outer parse.
  const tokenRegex = new RegExp(INLINE_TOKEN.source, INLINE_TOKEN.flags);

  let match: RegExpExecArray | null;
  while ((match = tokenRegex.exec(source)) !== null) {
    if (match.index > last) out.push(source.slice(last, match.index));
    const token = match[0];
    const key = `${keyPrefix}-${index++}`;

    if (token.startsWith('\\')) {
      if (options.allowMath && token.startsWith('\\(') && token.endsWith('\\)')) {
        out.push(<Tex key={key} tex={token.slice(2, -2)} />);
      } else {
        out.push(token.slice(1));
      }
    } else if (token.startsWith('`') && token.endsWith('`')) {
      out.push(<code key={key}>{token.slice(1, -1)}</code>);
    } else if (
      (token.startsWith('**') && token.endsWith('**')) ||
      (token.startsWith('__') && token.endsWith('__'))
    ) {
      out.push(
        <strong key={key}>
          {parseInline(token.slice(2, -2), options, `${key}-strong`)}
        </strong>,
      );
    } else if (token.startsWith('~~') && token.endsWith('~~')) {
      out.push(
        <del key={key}>{parseInline(token.slice(2, -2), options, `${key}-del`)}</del>,
      );
    } else if (token.startsWith('[')) {
      const link = token.match(/^\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)$/);
      if (link) {
        if (!options.allowLinks) {
          out.push(...parseInline(link[1], { ...options, allowLinks: false }, `${key}-plain-link`));
        } else {
          const href = safeHref(link[2]);
          if (href) {
            const external = /^https?:\/\//i.test(href);
            out.push(
              <a
                key={key}
                href={href}
                className="md-link"
                {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
              >
                {parseInline(link[1], options, `${key}-link`)}
              </a>,
            );
          } else {
            out.push(...parseInline(link[1], options, `${key}-unsafe-link`));
          }
        }
      } else {
        out.push(token);
      }
    } else if (options.allowMath && token.startsWith('$') && token.endsWith('$')) {
      out.push(<Tex key={key} tex={token.slice(1, -1)} />);
    } else if (
      (token.startsWith('*') && token.endsWith('*')) ||
      (token.startsWith('_') && token.endsWith('_'))
    ) {
      out.push(
        <em key={key}>{parseInline(token.slice(1, -1), options, `${key}-em`)}</em>,
      );
    } else {
      out.push(token);
    }

    last = tokenRegex.lastIndex;
  }

  if (last < source.length) out.push(source.slice(last));
  return out;
}

function parseBlocks(source: string, options: ParseOptions): ReactNode[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const out: ReactNode[] = [];
  let i = 0;
  let blockId = 0;

  const key = (kind: string) => `md-${kind}-${blockId++}`;

  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === '') {
      i++;
      continue;
    }

    const fence = line.match(/^\s*```([^\s]*)\s*$/);
    if (fence) {
      const lang = fence[1];
      const body: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) {
        body.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++;
      out.push(
        <pre key={key('code')} className={lang ? `language-${safeClass(lang)}` : undefined}>
          <code>{body.join('\n')}</code>
        </pre>,
      );
      continue;
    }

    if (options.allowMath && /^\s*\$\$\s*$/.test(line)) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !/^\s*\$\$\s*$/.test(lines[i])) {
        body.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++;
      out.push(<div key={key('math')} className="md-math-block"><Tex tex={body.join('\n')} display /></div>);
      continue;
    }

    if (options.allowMath && /^\s*\\\[\s*$/.test(line)) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !/^\s*\\\]\s*$/.test(lines[i])) {
        body.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++;
      out.push(<div key={key('math')} className="md-math-block"><Tex tex={body.join('\n')} display /></div>);
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      const Tag = `h${level}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
      out.push(<Tag key={key('h')}>{parseInline(heading[2], options)}</Tag>);
      i++;
      continue;
    }

    if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      out.push(<hr key={key('hr')} />);
      i++;
      continue;
    }

    if (isTableStart(lines, i)) {
      const header = splitTableRow(lines[i]);
      const align = splitTableRow(lines[i + 1]).map(parseAlignment);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && looksLikeTableRow(lines[i])) {
        rows.push(splitTableRow(lines[i]));
        i++;
      }
      out.push(
        <div className="md-table-wrap" key={key('table')}>
          <table className="md-table">
            <thead>
              <tr>
                {header.map((cell, c) => (
                  <th key={c} style={align[c] ? { textAlign: align[c] } : undefined}>
                    {parseInline(cell, options, `th-${c}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, r) => (
                <tr key={r}>
                  {header.map((_, c) => (
                    <td key={c} style={align[c] ? { textAlign: align[c] } : undefined}>
                      {parseInline(row[c] ?? '', options, `tr-${r}-${c}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    const unordered = line.match(/^\s*[-+*]\s+(.+)$/);
    if (unordered) {
      const items: Array<{ text: string; task?: boolean; checked?: boolean }> = [];
      while (i < lines.length) {
        const m = lines[i].match(/^\s*[-+*]\s+(.+)$/);
        if (!m) break;
        const task = m[1].match(/^\[([ xX])\]\s+(.*)$/);
        items.push(task
          ? { text: task[2], task: true, checked: task[1].toLowerCase() === 'x' }
          : { text: m[1] });
        i++;
      }
      out.push(
        <ul key={key('ul')} className={items.some((x) => x.task) ? 'md-task-list' : undefined}>
          {items.map((item, idx) => (
            <li key={idx}>
              {item.task && <input type="checkbox" checked={item.checked} readOnly tabIndex={-1} aria-hidden />}
              <MarkdownInline allowLinks={options.allowLinks} allowMath={options.allowMath}>{item.text}</MarkdownInline>
            </li>
          ))}
        </ul>,
      );
      continue;
    }

    const ordered = line.match(/^\s*(\d+)[.)]\s+(.+)$/);
    if (ordered) {
      const start = Number(ordered[1]);
      const items: string[] = [];
      while (i < lines.length) {
        const m = lines[i].match(/^\s*\d+[.)]\s+(.+)$/);
        if (!m) break;
        items.push(m[1]);
        i++;
      }
      out.push(
        <ol key={key('ol')} start={start}>
          {items.map((item, idx) => (
            <li key={idx}>
              <MarkdownInline allowLinks={options.allowLinks} allowMath={options.allowMath}>{item}</MarkdownInline>
            </li>
          ))}
        </ol>,
      );
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      const body: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        body.push(lines[i].replace(/^\s*>\s?/, ''));
        i++;
      }
      out.push(
        <blockquote key={key('quote')}>
          {parseBlocks(body.join('\n'), options)}
        </blockquote>,
      );
      continue;
    }

    const paragraph: string[] = [line.trim()];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !isSpecialBlockStart(lines, i, options.allowMath)
    ) {
      paragraph.push(lines[i].trim());
      i++;
    }
    out.push(
      <p key={key('p')}>
        {paragraph.map((part, idx) => (
          <Fragment key={idx}>
            {idx > 0 ? ' ' : null}
            {parseInline(part, options, `p-${idx}`)}
          </Fragment>
        ))}
      </p>,
    );
  }

  return out;
}

function isSpecialBlockStart(lines: string[], index: number, allowMath: boolean): boolean {
  const line = lines[index];
  return (
    /^\s*```/.test(line) ||
    /^#{1,6}\s+/.test(line) ||
    /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line) ||
    /^\s*[-+*]\s+/.test(line) ||
    /^\s*\d+[.)]\s+/.test(line) ||
    /^\s*>\s?/.test(line) ||
    isTableStart(lines, index) ||
    (allowMath && (/^\s*\$\$\s*$/.test(line) || /^\s*\\\[\s*$/.test(line)))
  );
}

function safeHref(raw: string): string | null {
  const href = raw.trim();
  if (
    href.startsWith('#') ||
    href.startsWith('/') ||
    href.startsWith('./') ||
    href.startsWith('../') ||
    /^https?:\/\//i.test(href) ||
    /^mailto:/i.test(href)
  ) {
    return href;
  }
  return null;
}

function safeClass(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32);
}

function looksLikeTableRow(line: string): boolean {
  return line.includes('|') && line.trim() !== '';
}

function isTableStart(lines: string[], index: number): boolean {
  return (
    index + 1 < lines.length &&
    looksLikeTableRow(lines[index]) &&
    /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(lines[index + 1])
  );
}

function splitTableRow(line: string): string[] {
  let text = line.trim();
  if (text.startsWith('|')) text = text.slice(1);
  if (text.endsWith('|')) text = text.slice(0, -1);
  return text.split('|').map((cell) => cell.trim());
}

function parseAlignment(cell: string): 'left' | 'center' | 'right' | undefined {
  const text = cell.trim();
  const left = text.startsWith(':');
  const right = text.endsWith(':');
  if (left && right) return 'center';
  if (right) return 'right';
  if (left) return 'left';
  return undefined;
}
