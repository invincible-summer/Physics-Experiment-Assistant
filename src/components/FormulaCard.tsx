/** FormulaCard — 公式卡片（主操作「计算」+「复制」菜单：LaTeX / Markdown 行内 / Markdown 块） */
import { useNavigate } from 'react-router-dom';
import { FormulaDefinition, CATEGORY_LABELS } from '../formulas/types';
import { Tex } from './katex';
import { varSymbolTex } from './varSymbol';
import { copyText } from './clipboard';
import { Badge, Button, Menu, SourceBadge, toast } from './ui';
import { MarkdownInline } from './Markdown';

export function FormulaCard({ formula }: { formula: FormulaDefinition }) {
  const navigate = useNavigate();
  const copySources: Record<string, () => string> = {
    latex: () => formula.latex,
    'md-inline': () => `$${formula.latex}$`,
    'md-block': () => `$$${formula.latex}$$`,
  };
  return (
    <div className="panel formula-card">
      <div className="fc-title">
        <span><MarkdownInline>{formula.title}</MarkdownInline></span>
        <SourceBadge provenance={formula.provenance} />
        <span className="spacer" />
        <Badge variant="default">{CATEGORY_LABELS[formula.category]}</Badge>
      </div>
      <div
        className="fc-latex"
        onClick={() => navigate(`/formulas/${formula.id}`)}
        style={{ cursor: 'pointer' }}
        title="打开公式计算器"
      >
        <Tex tex={formula.latex} display />
      </div>
      {formula.conditions && (
        <div className="small muted"><MarkdownInline>{`**适用条件：**${formula.conditions}`}</MarkdownInline></div>
      )}
      <div className="fc-vars">
        {formula.variables.map((v) => (
          <span key={v.name} className="var-chip" title={v.label}>
            <Tex tex={varSymbolTex(v.name)} />
            {v.unit ? <span className="vu"><MarkdownInline>{`[${v.unit}]`}</MarkdownInline></span> : null}
          </span>
        ))}
      </div>
      <div className="fc-actions">
        <Button size="sm" variant="primary" icon="arrow-right" onClick={() => navigate(`/formulas/${formula.id}`)}>计算</Button>
        <Menu
          trigger="复制"
          items={[
            { id: 'latex', label: '复制 LaTeX', icon: 'copy' },
            { id: 'md-inline', label: '复制 Markdown 行内', icon: 'copy' },
            { id: 'md-block', label: '复制 Markdown 块', icon: 'copy' },
          ]}
          onSelect={(id) => {
            const make = copySources[id];
            if (!make) return;
            void copyText(make()).then(() => toast('已复制到剪贴板'));
          }}
        />
      </div>
    </div>
  );
}
