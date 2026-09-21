/** 公式工作台页面：搜索 + 分类 + 卡片列表 / 公式详情计算器（plan §8） */
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  searchFormulas, getFormula, listFormulas, listCategories,
  CATEGORY_LABELS, FormulaCategory,
} from '../../formulas/registry';
import { RESULT_UNITS, resultSymbolFromLatex } from '../../formulas/result-units';
import { FormulaCard } from '../../components/FormulaCard';
import { FormulaCalculator } from '../../components/FormulaCalculator';
import { Badge, Button, EmptyState, FormulaBlock, Notice, Panel, SourceBadge, Tabs } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { MarkdownBlock, MarkdownInline } from '../../components/Markdown';
import { Tex } from '../../components/katex';
import { useSettings } from '../../stores/settings';

export function FormulasPage() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<FormulaCategory | ''>('');
  const profileName = useSettings((s) => s.activeProfile().shortName);

  const trimmed = query.trim();
  // 搜索与分类取交集：有关键词时在搜索结果上再按分类过滤
  const results = useMemo(() => {
    const base = trimmed ? searchFormulas(trimmed) : listFormulas(category || undefined);
    return trimmed && category ? base.filter((f) => f.category === category) : base;
  }, [trimmed, category]);
  const total = useMemo(() => listFormulas().length, []);
  const tabs = useMemo(
    () => [
      { id: '', label: '全部' },
      ...listCategories().map((c) => ({ id: c as string, label: CATEGORY_LABELS[c] })),
    ],
    [],
  );

  return (
    <>
      <header className="page-head">
        <h1 className="page-title"><MarkdownInline>公式工作台</MarkdownInline></h1>
        <p className="page-lead">
          <MarkdownInline>{`当前标准：**${profileName}** · 每条公式标注来源状态，课程规则与通用扩展严格区分`}</MarkdownInline>
        </p>
      </header>
      <div className="stack">
        <div className="search-input">
          <Icon name="search" size={16} />
          <input
            className="input"
            type="search"
            placeholder="搜索公式名称、别名、符号…"
            aria-label="搜索公式"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Tabs
          tabs={tabs}
          active={category}
          onChange={(id) => setCategory(id === '' ? '' : (id as FormulaCategory))}
          ariaLabel="公式分类"
        />
        {results.length === 0 ? (
          <EmptyState title="没有匹配的公式" hint="试试更换关键词，或切换到「全部」分类" />
        ) : (
          <div className="card-grid">
            {results.map((f) => <FormulaCard key={f.id} formula={f} />)}
          </div>
        )}
        <p className="small muted">
          <MarkdownInline>{`共 ${results.length} 个公式（全库 ${total} 个）· 卡片角标为来源状态，含义见 [关于与规则](#/sources)`}</MarkdownInline>
        </p>
      </div>
    </>
  );
}

export function FormulaDetailPage() {
  const { formulaId } = useParams();
  const formula = formulaId ? getFormula(formulaId) : undefined;
  const navigate = useNavigate();
  const profileName = useSettings((s) => s.activeProfile().shortName);

  const examplesMd = useMemo(() => {
    if (!formula?.examples?.length) return '';
    return formula.examples
      .map((ex, i) => {
        const inputs = Object.entries(ex.inputs)
          .map(([k, v]) => `${k} = ${fmtExample(v)}`)
          .join('，');
        return `- **${i + 1}. ${ex.title}**：代入 \`${inputs}\`，期望 $${fmtExample(ex.expect)}$${ex.note ? `（${ex.note}）` : ''}`;
      })
      .join('\n');
  }, [formula]);

  if (!formula) {
    return (
      <EmptyState title="未找到该公式" hint="链接可能有误，或该公式已被移除">
        <Button variant="ghost" onClick={() => navigate('/formulas')}>返回公式列表</Button>
      </EmptyState>
    );
  }

  const provenanceText = [
    formula.provenance.document,
    formula.provenance.section,
    formula.provenance.page ? `第 ${formula.provenance.page} 页` : '',
    formula.provenance.equation ? `式 ${formula.provenance.equation}` : '',
    formula.provenance.note,
  ].filter(Boolean).join(' · ');

  return (
    <>
      <header className="page-head">
        <div className="row-between wrap">
          <h1 className="page-title"><MarkdownInline>{formula.title}</MarkdownInline></h1>
          <div className="row-nowrap">
            <SourceBadge provenance={formula.provenance} />
            <Badge>{CATEGORY_LABELS[formula.category]}</Badge>
            <Button variant="ghost" size="sm" onClick={() => navigate('/formulas')}>返回列表</Button>
          </div>
        </div>
        <p className="page-lead">
          <MarkdownInline>{`当前标准：**${profileName}** · 版本 v${formula.version} · 编号 \`${formula.id}\``}</MarkdownInline>
        </p>
      </header>
      <div className="stack-lg">
        <FormulaBlock latex={formula.latex} />
        {formula.conditions && (
          <Notice variant="info" title="适用条件">
            <MarkdownBlock>{formula.conditions}</MarkdownBlock>
          </Notice>
        )}
        <Panel title="计算" sub={`选择求解目标并填入数据；结果按 **${profileName}** 规则修约`}>
          <FormulaCalculator
            key={formula.id}
            formula={formula}
            resultSymbol={resultSymbolFromLatex(formula.latex)}
            resultUnit={RESULT_UNITS[formula.id] ?? ''}
            profileName={profileName}
          />
        </Panel>
        <Panel title="变量与单位">
          <table className="stat-table">
            <thead>
              <tr>
                <th><MarkdownInline>符号</MarkdownInline></th>
                <th><MarkdownInline>名称</MarkdownInline></th>
                <th><MarkdownInline>单位</MarkdownInline></th>
                <th><MarkdownInline>说明</MarkdownInline></th>
              </tr>
            </thead>
            <tbody>
              {formula.variables.map((v) => {
                const desc = [v.note, v.constraint].filter(Boolean).join('；');
                return (
                  <tr key={v.name}>
                    <td><Tex tex={v.name} /></td>
                    <td><MarkdownInline>{v.label}</MarkdownInline></td>
                    <td>
                      {v.unit
                        ? <MarkdownInline>{v.unit}</MarkdownInline>
                        : <span className="faint"><MarkdownInline>无量纲</MarkdownInline></span>}
                    </td>
                    <td>
                      {desc
                        ? <MarkdownInline>{desc}</MarkdownInline>
                        : <span className="faint"><MarkdownInline>{'—'}</MarkdownInline></span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Panel>
        {examplesMd && (
          <Panel title="示例" sub="来自资料或定义的校验算例">
            <MarkdownBlock>{examplesMd}</MarkdownBlock>
          </Panel>
        )}
        <Panel title="来源">
          <div className="stack">
            <div className="row-nowrap">
              <SourceBadge provenance={formula.provenance} />
              <Badge>{`v${formula.version}`}</Badge>
            </div>
            {provenanceText && (
              <p className="small muted"><MarkdownInline>{provenanceText}</MarkdownInline></p>
            )}
            <p className="small faint">
              <MarkdownInline>{'来源状态的判定口径见 [关于与规则](#/sources)。'}</MarkdownInline>
            </p>
          </div>
        </Panel>
      </div>
    </>
  );
}

/** 示例数值的展示格式化（仅显示用，不参与计算） */
function fmtExample(v: number): string {
  if (!Number.isFinite(v)) return String(v);
  return String(Number(v.toPrecision(6)));
}
