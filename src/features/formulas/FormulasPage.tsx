/**
 * 公式工作台页面（plan §8）：搜索 + domain/topic 二级过滤 + 分批渲染卡片 / 公式详情。
 * 分批：默认首批 24 条，"加载更多"每批递增；改搜索词/分类时重置（避免一次挂载 200+ KaTeX）。
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  searchFormulas, getFormula, listFormulas, listDomains, listTopics,
  DOMAIN_LABELS, FormulaDomain, topicLabel,
} from '../../formulas/registry';
import { FormulaCard } from '../../components/FormulaCard';
import { FormulaCalculator } from '../../components/FormulaCalculator';
import { Badge, Button, EmptyState, FormulaBlock, Notice, Panel, SourceBadge, Tabs } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { MarkdownBlock, MarkdownInline, MarkdownList } from '../../components/Markdown';
import { Tex } from '../../components/katex';
import { useSettings } from '../../stores/settings';

const BATCH_SIZE = 24;

export function FormulasPage() {
  const [query, setQuery] = useState('');
  const [domain, setDomain] = useState<FormulaDomain | ''>('');
  const [topic, setTopic] = useState('');
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const profileName = useSettings((s) => s.activeProfile().shortName);

  const trimmed = query.trim();
  const results = useMemo(() => {
    // 搜索与 domain/topic 过滤取交集
    const base = trimmed ? searchFormulas(trimmed) : listFormulas();
    return base.filter((f) =>
      (!domain || f.domain === domain) && (!topic || (domain && f.topic === topic)));
  }, [trimmed, domain, topic]);
  const total = useMemo(() => listFormulas().length, []);

  const domainTabs = useMemo(
    () => [
      { id: '', label: '全部' },
      ...listDomains().map((d) => ({ id: d as string, label: DOMAIN_LABELS[d] })),
    ],
    [],
  );
  const topicTabs = useMemo(() => {
    if (!domain) return [];
    return [
      { id: '', label: '全部专题' },
      ...listTopics(domain).map((t) => ({ id: t.id, label: t.label })),
    ];
  }, [domain]);

  // 过滤条件变化时重置分批
  useEffect(() => {
    setVisibleCount(BATCH_SIZE);
  }, [trimmed, domain, topic]);

  const shown = results.slice(0, visibleCount);

  return (
    <>
      <header className="page-head">
        <h1 className="page-title"><MarkdownInline>公式工作台</MarkdownInline></h1>
        <div className="page-lead">
          <MarkdownBlock>{`大学物理主干公式库 · 当前标准：**${profileName}** · 每条公式标注来源状态，课程规则与通用扩展严格区分`}</MarkdownBlock>
        </div>
      </header>
      <div className="stack">
        <div className="search-input">
          <Icon name="search" size={16} />
          <input
            className="input"
            type="search"
            placeholder="搜索公式名称、别名、符号、领域…"
            aria-label="搜索公式"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Tabs
          tabs={domainTabs}
          active={domain}
          onChange={(id) => {
            setDomain(id === '' ? '' : (id as FormulaDomain));
            setTopic('');
          }}
          ariaLabel="公式学科域"
        />
        {domain && topicTabs.length > 2 && (
          <Tabs
            tabs={topicTabs}
            active={topic}
            onChange={(id) => setTopic(id)}
            ariaLabel={`细分专题（${DOMAIN_LABELS[domain]}）`}
          />
        )}
        {results.length === 0 ? (
          <EmptyState title="没有匹配的公式" hint="试试更换关键词，或切回「全部」域与专题" />
        ) : (
          <>
            <div className="card-grid">
              {shown.map((f) => <FormulaCard key={f.id} formula={f} />)}
            </div>
            {visibleCount < results.length && (
              <div className="row" style={{ justifyContent: 'center' }}>
                <Button onClick={() => setVisibleCount((c) => c + BATCH_SIZE)}>
                  {`加载更多（已显示 ${shown.length} / ${results.length}）`}
                </Button>
              </div>
            )}
          </>
        )}
        <div className="small muted">
          <MarkdownBlock>{`匹配 ${results.length} 个公式（全库 ${total} 个）· 卡片角标为来源状态，含义见 [关于与规则](#/sources)`}</MarkdownBlock>
        </div>
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
            <Badge>{`${DOMAIN_LABELS[formula.domain]} · ${topicLabel(formula.domain, formula.topic)}`}</Badge>
            {formula.kind === 'reference' && <Badge variant="info">参考公式</Badge>}
            <Button variant="ghost" size="sm" onClick={() => navigate('/formulas')}>返回列表</Button>
          </div>
        </div>
        <div className="page-lead">
          <MarkdownBlock>{`当前标准：**${profileName}** · 版本 v${formula.version} · 编号 \`${formula.id}\``}</MarkdownBlock>
        </div>
      </header>
      <div className="stack-lg">
        <FormulaBlock latex={formula.latex} />
        {formula.conditions && (
          <Notice variant="info" title="适用条件">
            <MarkdownBlock>{formula.conditions}</MarkdownBlock>
          </Notice>
        )}
        {formula.kind === 'reference' ? (
          <Panel title="参考公式" sub="重要关系式，不提供数值计算器">
            <div className="stack">
              <MarkdownBlock>{`该公式属于**参考公式**：以积分、微分方程或矢量形式表述的物理规律，不适合简化为填数求值的标量计算器，因此本页不显示数值输入表单（plan §5.3，不伪造不正确的标量表达式）。`}</MarkdownBlock>
              <MarkdownBlock>{`可搜索本库对应的**可计算特例**：例如高斯定律 → 线/面/球电荷电场；法拉第定律 → 运动导体电动势；薛定谔方程 → 一维无限深势阱能级。`}</MarkdownBlock>
              <div className="row">
                <Button size="sm" onClick={() => navigate('/formulas')}>浏览相关可计算公式</Button>
              </div>
            </div>
          </Panel>
        ) : (
          <Panel title="计算" sub={`选择求解目标并填入数据；结果按 **${profileName}** 规则修约`}>
            <FormulaCalculator
              key={formula.id}
              formula={formula}
              profileName={profileName}
            />
          </Panel>
        )}
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
        {(formula.constants ?? []).length > 0 && (
          <Panel title="常数">
            <MarkdownList
              items={(formula.constants ?? []).map((c) =>
                `${c.label} = ${fmtExample(c.value)}${c.unit ? ` ${c.unit}` : ''}${c.isExact ? '（精确值）' : '（测量值，含不确定度）'}`)}
            />
          </Panel>
        )}
        <Panel title="来源">
          <div className="stack">
            <div className="row-nowrap">
              <SourceBadge provenance={formula.provenance} />
              <Badge>{`v${formula.version}`}</Badge>
            </div>
            {provenanceText && (
              <div className="small muted"><MarkdownBlock>{provenanceText}</MarkdownBlock></div>
            )}
            <div className="small faint">
              <MarkdownBlock>{'来源状态的判定口径见 [关于与规则](#/sources)。'}</MarkdownBlock>
            </div>
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
