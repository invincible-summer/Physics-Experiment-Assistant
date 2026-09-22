/** 首页仪表盘（v3）：继续上次工作主 CTA + 工作流引导 + 任务入口 + 标准摘要 + 最近项目（含填写进度） */
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { listProjects, StoredProject } from '../../persistence/db';
import { getExperiment } from '../../experiments';
import { useSettings } from '../../stores/settings';
import { Icon, IconName } from '../../components/Icon';
import { Panel, Notice, EmptyState, Button } from '../../components/ui';
import { StandardProfileBadge } from '../../components/StandardProfileBadge';
import { MarkdownBlock, MarkdownInline, MarkdownList } from '../../components/Markdown';

const QUICK_LINKS: ReadonlyArray<{ to: string; title: string; desc: string; icon: IconName }> = [
  {
    to: '/experiments',
    title: '实验工作台',
    desc: '2026 A(1) 七个必做实验：从原始数据记录一路处理到可复核的结果表达。',
    icon: 'flask',
  },
  {
    to: '/tools',
    title: '数据处理工具',
    desc: '统计、拟合、加权平均与不确定度传播，表格化录入并可在工具间流转。',
    icon: 'chart',
  },
  {
    to: '/formulas',
    title: '公式工作台',
    desc: '按物理量与单位填写数据求解目标量，保留公式来源与完整计算链。',
    icon: 'function',
  },
  {
    to: '/tools/calculator',
    title: '科学计算器',
    desc: '支持角度/弧度切换、科学记数法和历史重算，随手核对实验中的数值。',
    icon: 'calculator',
  },
];

const FLOW_STEPS: ReadonlyArray<{ title: string; desc: string; icon: IconName }> = [
  { title: '新建实验项目', desc: '选择实验模板，预设仪器参数与数据表结构', icon: 'flask' },
  { title: '录入原始数据', desc: '表格支持 Excel 粘贴、键盘录入、派生列自动计算', icon: 'grid' },
  { title: '拟合与不确定度', desc: '自动作图拟合，按当前标准计算不确定度与有效数字', icon: 'chart' },
  { title: '导出报告片段', desc: 'Markdown / LaTeX / CSV / 图，计算链与来源可复核', icon: 'download' },
];

/** 项目填写进度：所有数据表的非空单元格占比 */
function projectProgress(p: StoredProject): { filled: number; total: number } {
  let filled = 0;
  let total = 0;
  for (const rows of Object.values(p.tables)) {
    for (const row of rows) {
      for (const cell of row) {
        total += 1;
        if (String(cell).trim() !== '') filled += 1;
      }
    }
  }
  return { filled, total };
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function HomePage() {
  const navigate = useNavigate();
  const profile = useSettings((s) => s.activeProfile());
  const [recent, setRecent] = useState<StoredProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let alive = true;
    listProjects()
      .then((all) => {
        if (alive) setRecent(all.slice(0, 5));
      })
      .catch(() => {
        if (alive) setLoadError(true);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const last = recent[0];

  return (
    <div className="stack-lg">
      <section className="home-hero">
        <div className="home-eyebrow"><MarkdownInline>大学物理实验 · 2026 A(1)</MarkdownInline></div>
        <h1 className="home-title"><MarkdownInline>物理实验小助手</MarkdownInline></h1>
        <div className="home-lead">
          <MarkdownBlock>从原始数据记录到规范结果表达：数据修正、派生量计算、拟合作图、不确定度与有效数字在同一个工作区完成，计算链与规则来源全程可追溯。</MarkdownBlock>
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <StandardProfileBadge />
          <span className="muted small"><MarkdownInline>全部计算在本浏览器内运行，数据不会上传。</MarkdownInline></span>
        </div>
        {profile.kind === 'custom' && (
          <div style={{ marginTop: 12 }}>
            <Notice variant="warning" title="自定义标准配置生效中">
              <MarkdownBlock>当前为自定义规则组合，**不代表课程或 GB/T 标准的官方口径**；如需课程或标准模式，请到设置页切换。</MarkdownBlock>
            </Notice>
          </div>
        )}
      </section>

      {/* 继续上次工作 / 开始第一个实验 */}
      {!loading && !loadError && (
        last ? (
          <section className="continue-card" aria-label="继续上次工作">
            <div className="continue-main">
              <span className="xs" style={{ color: 'var(--accent-ink)', fontWeight: 650, letterSpacing: '0.1em' }}>
                <MarkdownInline>继续上次工作</MarkdownInline>
              </span>
              <span className="continue-title"><MarkdownInline>{last.title}</MarkdownInline></span>
              <span className="continue-meta">
                <MarkdownInline>{last.experimentId ? getExperiment(last.experimentId)?.title ?? '通用项目' : '通用项目'}</MarkdownInline>
                <span className="faint">·</span>
                <Icon name="clock" size={13} />
                <MarkdownInline>{formatTime(last.updatedAt)}</MarkdownInline>
                {(() => {
                  const { filled, total } = projectProgress(last);
                  if (total === 0) return null;
                  return (
                    <>
                      <span className="faint">·</span>
                      <MarkdownInline>{`数据 ${filled}/${total} 格`}</MarkdownInline>
                    </>
                  );
                })()}
              </span>
            </div>
            <Button variant="primary" icon="arrow-right" onClick={() => navigate(`/project/${last.id}`)}>
              进入工作台
            </Button>
          </section>
        ) : (
          <section className="continue-card" aria-label="开始第一个实验">
            <div className="continue-main">
              <span className="xs" style={{ color: 'var(--accent-ink)', fontWeight: 650, letterSpacing: '0.1em' }}>
                <MarkdownInline>从这里开始</MarkdownInline>
              </span>
              <span className="continue-title"><MarkdownInline>还没有项目，创建第一份实验记录</MarkdownInline></span>
              <span className="continue-meta"><MarkdownInline>七个 2026 A(1) 实验模板已预置数据表与计算管线，数据只保存在本浏览器。</MarkdownInline></span>
            </div>
            <Button variant="primary" icon="flask" onClick={() => navigate('/experiments')}>
              新建实验项目
            </Button>
          </section>
        )
      )}

      {/* 工作流引导 */}
      <section className="flow-strip" aria-label="工作流程">
        {FLOW_STEPS.map((s, i) => (
          <div className="flow-step" key={s.title}>
            <span className="fs-num"><MarkdownInline>{`步骤 ${i + 1}`}</MarkdownInline></span>
            <span className="fs-title"><Icon name={s.icon} /><MarkdownInline>{s.title}</MarkdownInline></span>
            <span className="fs-desc"><MarkdownInline>{s.desc}</MarkdownInline></span>
          </div>
        ))}
      </section>

      <nav className="quick-grid" aria-label="常用入口">
        {QUICK_LINKS.map((q) => (
          <Link key={q.to} className="quick-card" to={q.to}>
            <span className="quick-card-head">
              <span className="quick-card-icon"><Icon name={q.icon} /></span>
              <span className="quick-card-title"><MarkdownInline>{q.title}</MarkdownInline></span>
            </span>
            <span className="quick-card-desc"><MarkdownInline>{q.desc}</MarkdownInline></span>
          </Link>
        ))}
      </nav>

      <div className="home-columns">
        <Panel
          title="当前标准规则摘要"
          sub={profile.name}
          actions={<Link to="/settings" className="btn btn-sm"><MarkdownInline allowLinks={false}>切换标准</MarkdownInline></Link>}
        >
          <MarkdownList items={profile.rulesSummary} />
        </Panel>

        <Panel
          title="最近项目"
          actions={<Link to="/projects" className="btn btn-sm"><MarkdownInline allowLinks={false}>全部项目</MarkdownInline></Link>}
        >
          {loading ? (
            <div className="muted small"><MarkdownBlock>正在读取本地项目…</MarkdownBlock></div>
          ) : loadError ? (
            <Notice variant="danger" title="读取失败">
              <MarkdownBlock>本地项目列表读取失败，请刷新页面重试；数据仍保存在浏览器 IndexedDB 中。</MarkdownBlock>
            </Notice>
          ) : recent.length === 0 ? (
            <EmptyState
              icon="folder"
              title="还没有项目"
              hint="到实验工作台新建第一份实验记录，数据只保存在本浏览器。"
            >
              <Button variant="primary" size="sm" icon="flask" onClick={() => navigate('/experiments')}>
                去实验工作台新建
              </Button>
            </EmptyState>
          ) : (
            <div>
              {recent.map((p) => {
                const exp = p.experimentId ? getExperiment(p.experimentId) : undefined;
                const { filled, total } = projectProgress(p);
                const pct = total > 0 ? Math.round((filled / total) * 100) : 0;
                return (
                  <div className="proj-row" key={p.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/project/${p.id}`)}>
                    <div className="proj-main">
                      <div className="proj-title"><MarkdownInline>{p.title}</MarkdownInline></div>
                      <div className="proj-meta">
                        <MarkdownInline>{exp?.title ?? '通用项目'}</MarkdownInline>
                        <span className="faint">·</span>
                        <MarkdownInline>{formatTime(p.updatedAt)}</MarkdownInline>
                      </div>
                      {total > 0 && (
                        <div className="proj-progress">
                          <span className="progress-track" style={{ width: 90 }}>
                            <span className="progress-fill" style={{ width: `${pct}%`, display: 'block' }} />
                          </span>
                          <span className="xs faint"><MarkdownInline>{`已填 ${pct}%`}</MarkdownInline></span>
                        </div>
                      )}
                    </div>
                    <Icon name="chevron-right" size={16} />
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </div>

      <footer className="row small">
        <Link className="md-link" to="/settings"><MarkdownInline>设置</MarkdownInline></Link>
        <span className="faint">·</span>
        <Link className="md-link" to="/sources"><MarkdownInline>关于与规则</MarkdownInline></Link>
      </footer>
    </div>
  );
}
