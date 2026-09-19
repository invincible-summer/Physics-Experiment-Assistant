/** 公式工作台页面：搜索 + 卡片 + 详情计算器（plan §8） */
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { searchFormulas, getFormula, listCategories, CATEGORY_LABELS, FormulaCategory } from '../../formulas/registry';
import { RESULT_UNITS, resultSymbolFromLatex } from '../../formulas/result-units';
import { FormulaCard } from '../../components/FormulaCard';
import { FormulaCalculator } from '../../components/FormulaCalculator';
import { Panel, EmptyState } from '../../components/ui';
import { Tex } from '../../components/katex';
import { Icon } from '../../components/Icon';
import { useSettings } from '../../stores/settings';

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
      <div className="page-heading">
        <div>
          <div className="eyebrow">FORMULA LIBRARY</div>
          <h1>公式工作台</h1>
          <p>当前标准：<strong>{profileName}</strong>。课程公式保留来源标记，通用扩展与课程规则分开呈现。</p>
        </div>
        <div className="page-heading-aside">
          <span className="summary-stat"><strong>{results.length}</strong><small>当前公式</small></span>
        </div>
      </div>

      <div className="formula-toolbar">
        <label className="search-field">
          <Icon name="search" size={18} />
          <span className="sr-only">搜索公式</span>
          <input
            placeholder="搜索公式：中文名 / 英文 / 符号 / 别名…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} aria-label="清空搜索">×</button>
          )}
        </label>
      </div>

      <div className="tabs formula-tabs" role="tablist" aria-label="公式类别">
        <button className={`tab${category === '' ? ' active' : ''}`} onClick={() => setCategory('')}>全部</button>
        {listCategories().map((c) => (
          <button key={c} className={`tab${category === c ? ' active' : ''}`} onClick={() => setCategory(c)}>
            {CATEGORY_LABELS[c]}
          </button>
        ))}
      </div>

      {results.length === 0 ? (
        <EmptyState icon="∑" title="没有匹配的公式" hint="试试换个关键词，或切换类别" />
      ) : (
        <div className="card-grid formula-grid">
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
        <EmptyState icon="?" title="未找到该公式" hint="返回公式列表重新选择" />
        <button className="btn" onClick={() => navigate('/formulas')}>返回公式列表</button>
      </main>
    );
  }

  const resultSymbol = resultSymbolFromLatex(formula.latex);
  return (
    <main className="page formula-detail-page">
      <button className="back-link" onClick={() => navigate('/formulas')}>
        <Icon name="arrowLeft" size={16} /> 公式列表
      </button>

      <div className="page-heading">
        <div>
          <div className="eyebrow">FORMULA · v{formula.version}</div>
          <h1>{formula.title}</h1>
          <p>当前计算规则：{profileName}</p>
        </div>
      </div>

      <Panel title="公式" sub="先确认公式与适用条件，再填写变量">
        <div className="formula-detail-expression">
          <Tex tex={formula.latex} display />
        </div>
        {formula.conditions && (
          <div className="formula-condition">
            <span>适用条件</span>
            <p>{formula.conditions}</p>
          </div>
        )}
        <FormulaCalculator
          formula={formula}
          resultSymbol={resultSymbol}
          resultUnit={RESULT_UNITS[formula.id] ?? ''}
          profileName={profileName}
        />
      </Panel>
    </main>
  );
}
