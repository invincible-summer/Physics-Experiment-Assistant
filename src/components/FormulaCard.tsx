/** FormulaCard — 公式卡片（plan §8.2） */
import { FormulaDefinition } from '../formulas/types';
import { CATEGORY_LABELS } from '../formulas/types';
import { Tex } from './katex';
import { Badge, CopyButton, SourceBadge } from './ui';
import { useNavigate } from 'react-router-dom';

export function FormulaCard({ formula }: { formula: FormulaDefinition }) {
  const navigate = useNavigate();
  return (
    <div className="panel formula-card">
      <div className="fc-title">
        <span>{formula.title}</span>
        <SourceBadge provenance={formula.provenance} />
        <span className="spacer" style={{ flex: 1 }} />
        <Badge variant="default">{CATEGORY_LABELS[formula.category]}</Badge>
      </div>
      <div className="fc-latex" onClick={() => navigate(`/formulas/${formula.id}`)} style={{ cursor: 'pointer' }}>
        <Tex tex={formula.latex} display />
      </div>
      {formula.conditions && <div className="small muted">适用条件：{formula.conditions}</div>}
      <div className="fc-vars">
        {formula.variables.map((v) => (
          <span key={v.name} className="var-chip" title={v.label}>
            <Tex tex={v.name} /> {v.unit ? <span className="vu">[{v.unit}]</span> : null}
          </span>
        ))}
      </div>
      <div className="fc-actions">
        <button className="btn btn-sm btn-primary" onClick={() => navigate(`/formulas/${formula.id}`)}>计算</button>
        <CopyButton text={formula.latex} label="复制 LaTeX" />
        <CopyButton text={`$$${formula.latex}$$`} label="复制 MD 块" />
        <CopyButton text={`$${formula.latex}$`} label="复制 MD 行内" />
      </div>
    </div>
  );
}
