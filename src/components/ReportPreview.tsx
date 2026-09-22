import { useRef, useState } from 'react';
import { MarkdownBlock, MarkdownInline } from './Markdown';
import { Button } from './ui';

/** Full source remains selectable; preview never truncates exported content. */
export function ReportPreview({ source, format }: { source: string; format: 'markdown' | 'latex' }) {
  const [preview, setPreview] = useState(false);
  const [wrap, setWrap] = useState(true);
  const input = useRef<HTMLTextAreaElement>(null);
  return <div className="stack report-review">
    <div className="row-between wrap">
      <div className="row">
        {format === 'markdown' && <Button size="sm" aria-pressed={preview} onClick={() => setPreview(!preview)}>{preview ? '查看源码' : '阅读预览'}</Button>}
        {!preview && <>
          <Button size="sm" aria-pressed={wrap} onClick={() => setWrap(!wrap)}>{wrap ? '关闭自动换行' : '自动换行'}</Button>
          <Button size="sm" onClick={() => { input.current?.focus(); input.current?.select(); }}>全选源码</Button>
        </>}
      </div>
      <span className="small muted"><MarkdownInline>{`${source.split('\n').length} 行 · ${source.length.toLocaleString()} 字符 · 完整内容`}</MarkdownInline></span>
    </div>
    {preview
      ? <div className="report-preview" tabIndex={0} aria-label="报告阅读预览"><MarkdownBlock>{source}</MarkdownBlock></div>
      : <textarea ref={input} className="textarea report-source" aria-label={format === 'latex' ? '完整 LaTeX 源码' : '完整 Markdown 源码'} value={source} readOnly wrap={wrap ? 'soft' : 'off'} spellCheck={false} />}
    <MarkdownBlock className="small muted">{format === 'latex'
      ? '将源码保存为 `.tex`，使用 **XeLaTeX** 编译（需要中文 `ctex` 宏包）。这里展示源码，最终分页以编译结果为准。'
      : '复制或下载均包含完整内容。预览支持公式与表格；不同 Markdown 编辑器的分页和排版可能略有差异。图表可在对应图形区域单独导出。'}</MarkdownBlock>
  </div>;
}
