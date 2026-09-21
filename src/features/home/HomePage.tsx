/** 首页（plan §2.2）：任务导向入口 + 当前标准摘要 + 最近项目 */
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { listProjects, StoredProject } from '../../persistence/db';
import { getExperiment } from '../../experiments';
import { useSettings } from '../../stores/settings';
import { Panel, Notice, EmptyState, Button } from '../../components/ui';
import { StandardProfileBadge } from '../../components/StandardProfileBadge';
import { MarkdownInline, MarkdownList } from '../../components/Markdown';

const QUICK_LINKS = [
  {
    to: '/experiments',
    title: '实验工作台',
    desc: '2026 A(1) 七个必做实验：从原始数据记录一路处理到可复核的结果表达。',
  },
  {
    to: '/tools/statistics',
    title: '数据处理工具',
    desc: '统计、拟合、加权平均与不确定度传播，集中处理测量数据。',
  },
  {
    to: '/formulas',
    title: '公式工作台',
    desc: '按物理量与单位填写数据求解目标量，保留公式来源与完整计算链。',
  },
  {
    to: '/tools/calculator',
    title: '科学计算器',
    desc: '安全 AST 求值，支持角度/弧度切换与科学记数法，不执行任意脚本。',
  },
] as const;

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

  return (
    <div className="stack-lg">
      <section className="home-hero">
        <div className="home-eyebrow"><MarkdownInline>大学物理实验 · 2026 A(1)</MarkdownInline></div>
        <h1 className="home-title"><MarkdownInline>物理实验小助手</MarkdownInline></h1>
        <p className="home-lead">
          <MarkdownInline>从原始数据记录到规范结果表达：数据修正、派生量计算、拟合作图、不确定度与有效数字在同一个工作区完成，计算链与规则来源全程可追溯。</MarkdownInline>
        </p>
        <p className="muted small" style={{ marginTop: 8 }}>
          <MarkdownInline>全部计算在本浏览器内运行，实验数据保存在本地，不会上传。</MarkdownInline>
        </p>
        <div className="row" style={{ marginTop: 12 }}>
          <StandardProfileBadge />
        </div>
        {profile.kind === 'custom' && (
          <div style={{ marginTop: 12 }}>
            <Notice variant="warning" title="自定义标准配置生效中">
              <MarkdownInline>当前为自定义规则组合，**不代表课程或 GB/T 标准的官方口径**；如需课程或标准模式，请到设置页切换。</MarkdownInline>
            </Notice>
          </div>
        )}
      </section>

      <nav className="quick-grid" aria-label="常用入口">
        {QUICK_LINKS.map((q) => (
          <Link key={q.to} className="quick-card" to={q.to}>
            <span className="quick-card-title"><MarkdownInline>{q.title}</MarkdownInline></span>
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
            <p className="muted small"><MarkdownInline>正在读取本地项目…</MarkdownInline></p>
          ) : loadError ? (
            <Notice variant="danger" title="读取失败">
              <MarkdownInline>本地项目列表读取失败，请刷新页面重试；数据仍保存在浏览器 IndexedDB 中。</MarkdownInline>
            </Notice>
          ) : recent.length === 0 ? (
            <EmptyState
              title="还没有项目"
              hint="到实验工作台新建第一份实验记录，数据只保存在本浏览器。"
            >
              <Button variant="primary" size="sm" onClick={() => navigate('/experiments')}>
                去实验工作台新建
              </Button>
            </EmptyState>
          ) : (
            <table className="stat-table">
              <tbody>
                {recent.map((p) => {
                  const exp = p.experimentId ? getExperiment(p.experimentId) : undefined;
                  return (
                    <tr
                      key={p.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/project/${p.id}`)}
                    >
                      <td>
                        <Link
                          to={`/project/${p.id}`}
                          className="md-link"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MarkdownInline allowLinks={false}>{p.title}</MarkdownInline>
                        </Link>
                        <div className="muted xs"><MarkdownInline>{exp?.title ?? '通用项目'}</MarkdownInline></div>
                      </td>
                      <td className="num nowrap">
                        <MarkdownInline>{new Date(p.updatedAt).toLocaleString('zh-CN')}</MarkdownInline>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
