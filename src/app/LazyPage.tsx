import { Component, ReactNode, Suspense } from 'react';
import { Button, Notice } from '../components/ui';
import { MarkdownInline } from '../components/Markdown';

/** A failed chunk download must offer recovery rather than leave a blank page. */
export class LazyPage extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return (
      <Notice variant="danger" title="页面加载失败">
        <div className="stack">
          <MarkdownInline>请检查网络后重新加载；已保存的本地项目和草稿会保留。</MarkdownInline>
          <Button onClick={() => window.location.reload()}>重新加载页面</Button>
        </div>
      </Notice>
    );
    return <Suspense fallback={<div className="panel" role="status" style={{ padding: 24 }}><MarkdownInline>正在加载工作台…</MarkdownInline></div>}>{this.props.children}</Suspense>;
  }
}
