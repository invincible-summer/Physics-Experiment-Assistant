/** FormulaCard — 公式卡片（复制 LaTeX / Markdown 行内 / Markdown 块） */
import { useNavigate } from 'react-router-dom';
import { FormulaDefinition, CATEGORY_LABELS } from '../formulas/types';
import { Tex } from './katex';
import { Badge, Button, CopyButton, SourceBadge } from './ui';
import { MarkdownInline } from './Markdown';

export function FormulaCard({ formula }: { formula: FormulaDefinition }) {
  const navigate = useNavigate();
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
            <Tex tex={v.name} />
            {v.unit ? <span className="vu"><MarkdownInline>{`[${v.unit}]`}</MarkdownInline></span> : null}
          </span>
        ))}
      </div>
      <div className="fc-actions">
        <Button size="sm" variant="primary" onClick={() => navigate(`/formulas/${formula.id}`)}>计算</Button>
        <CopyButton text={formula.latex} label="复制 LaTeX" />
        <CopyButton text={`$$${formula.latex}$$`} label="复制 MD 块" />
        <CopyButton text={`$${formula.latex}$`} label="复制 MD 行内" />
      </div>
    </div>
  );
}
