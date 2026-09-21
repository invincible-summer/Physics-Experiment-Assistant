/**
 * 工具间数据流转的接收横幅：其他工具「发送到」本工具时，
 * 在页面顶部提示来源与规模，用户选择「填入」或「忽略」（绝不静默覆盖输入）。
 */
import { Notice, Button } from '../../components/ui';
import { MarkdownInline } from '../../components/Markdown';
import { ToolPayload, useToolBus } from './tool-bus';

export function PayloadBanner({ accept, onAccept }: {
  /** 本页接受的载荷类型 */
  accept: 'table' | 'scalar';
  onAccept: (p: ToolPayload) => void;
}) {
  const payload = useToolBus((s) => s.payload);
  const consume = useToolBus((s) => s.consume);
  const dismiss = useToolBus((s) => s.dismiss);
  if (!payload || payload.kind !== accept) return null;

  const desc = payload.kind === 'table'
    ? `**${payload.rows.length}** 行 × **${payload.headers.length}** 列（${payload.headers.join('、')}）`
    : `**${payload.name}** = ${payload.valueText}${payload.uncText ? ` ± ${payload.uncText}` : ''}`;

  return (
    <Notice variant="info" title={`收到来自「${payload.source}」的数据`}>
      <div className="row-between" style={{ flexWrap: 'wrap', gap: 8 }}>
        <MarkdownInline>{desc}</MarkdownInline>
        <span className="row" style={{ gap: 6 }}>
          <Button size="sm" variant="ghost" onClick={dismiss}>忽略</Button>
          <Button
            size="sm"
            variant="primary"
            icon="download"
            onClick={() => {
              const p = consume();
              if (p) onAccept(p);
            }}
          >
            填入本页
          </Button>
        </span>
      </div>
    </Notice>
  );
}
