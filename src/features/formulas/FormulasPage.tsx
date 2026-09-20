/** 公式工作台页面：搜索 + 卡片 + 详情计算器（plan §8） */
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { searchFormulas, getFormula, listCategories, CATEGORY_LABELS, FormulaCategory } from '../../formulas/registry';
import { RESULT_UNITS, resultSymbolFromLatex } from '../../formulas/result-units';
import { FormulaCard } from '../../components/FormulaCard';
import { FormulaCalculator } from '../../components/FormulaCalculator';
import { Panel, EmptyState } from '../../components/ui';
import { useSettings } from '../../stores/settings';
import { Tex } from '../../components/katex';
import { MarkdownInline } from '../../components/Markdown';

export function FormulasPage() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<FormulaCategory | ''>('');
  const results = useMemo(() => {
    const base = searchFormulas(query);
    return category ? base.filter((f) => f.category === category) : base;
  }, [query, category]);
  const profileName = useSettings((s) => s.activeProfile().shortName);

  return (
    <main className="page">
      <h1><MarkdownInline>公式工作台</MarkdownInline></h1>
      <p className="muted"><MarkdownInline>{`当前标准：**${profileName}** · 所有课程公式标注来源；通用扩展与课程规则严格区分`}</MarkdownInline></p>
      <div className="row" style={{ margin: '12px 0' }}>
        <input
          className="input"
          style={{ maxWidth: 380 }}
          placeholder="搜索公式：中文名 / 英文 / 符号 / 别名…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="tabs">
        <button className={`tab${category === '' ? ' active' : ''}`} onClick={() => setCategory('')}><MarkdownInline allowLinks={false}>全部</MarkdownInline></button>
        {listCategories().map((c) => (
          <button key={c} className={`tab${category === c ? ' active' : ''}`} onClick={() => setCategory(c)}>
            <MarkdownInline allowLinks={false}>{CATEGORY_LABELS[c]}</MarkdownInline>
          </button>
        ))}
      </div>
      {results.length === 0 ? (
        <EmptyState icon="🔍" title="没有匹配的公式" hint="试试换个关键词，或切换类别" />
      ) : (
        <div className="card-grid">
          {results.map((f) => <FormulaCard key={f.id} formula={f} />)}
        </div>
      )}
    </main>
  );
}

export function FormulaDetailPage() {
  const { formulaId } = useParams();
  const formula = formulaId ? getFormula(formulaId) : undefined;
  const navigate = useNavigate();
  const profileName = useSettings((s) => s.activeProfile().shortName);

  if (!formula) {
    return (
      <main className="page">
        <EmptyState icon="❓" title="未找到该公式" hint="返回公式列表重新选择" />
        <button className="btn" onClick={() => navigate('/formulas')}><MarkdownInline allowLinks={false}>返回公式列表</MarkdownInline></button>
      </main>
    );
  }
  const resultSymbol = resultSymbolFromLatex(formula.latex);
  return (
    <main className="page">
      <div className="row" style={{ marginBottom: 10 }}>
        <button className="btn btn-sm" onClick={() => navigate('/formulas')}><MarkdownInline allowLinks={false}>返回公式列表</MarkdownInline></button>
      </div>
      <h1><MarkdownInline>{formula.title}</MarkdownInline></h1>
      <Panel title="公式" sub={`版本 v${formula.version}`}>
        <div className="fc-latex formula-detail-display">
          <Tex tex={formula.latex} display />
        </div>
        <FormulaCalculator formula={formula} resultSymbol={resultSymbol} resultUnit={RESULT_UNITS[formula.id] ?? ''} profileName={profileName} />
      </Panel>
    </main>
  );
}
