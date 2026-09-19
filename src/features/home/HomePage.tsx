/** 首页（plan §2.2）：任务导向 */
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { listProjects, StoredProject } from '../../persistence/db';
import { getExperiment } from '../../experiments';
import { tryGetProfile } from '../../standards/registry';
import { useSettings } from '../../stores/settings';
import { Panel, Badge } from '../../components/ui';
import { StandardProfileBadge } from '../../components/StandardProfileBadge';
import { Icon, IconName } from '../../components/Icon';

const QUICK_ACTIONS: {
  to: string;
  icon: IconName;
  title: string;
  detail: string;
  primary?: boolean;
}[] = [
  {
    to: '/experiments',
    icon: 'experiment',
    title: '新建 2026 A(1) 实验',
    detail: '7 个必做实验，从原始数据到最终结果',
    primary: true,
  },
  {
    to: '/tools/statistics',
    icon: 'chart',
    title: '快速数据处理',
    detail: '统计、拟合、加权平均与不确定度',
  },
  {
    to: '/formulas',
    icon: 'formula',
    title: '公式计算',
    detail: '选公式、填物理量与单位、自动传播不确定度',
  },
  {
    to: '/tools/calculator',
    icon: 'calculator',
    title: '科学计算器',
    detail: '安全 AST 求值，支持度与弧度',
  },
];

export function HomePage() {
  const navigate = useNavigate();
  const profile = useSettings((s) => s.activeProfile());
  const [recent, setRecent] = useState<StoredProject[]>([]);

  useEffect(() => {
    listProjects().then((all) => setRecent(all.slice(0, 5))).catch(() => setRecent([]));
  }, []);

  return (
    <main className="page home-page">
      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-hero-copy">
          <div className="eyebrow"><Icon name="spark" size={15} /> 课程数据处理工作台</div>
          <h1 id="home-title">物理实验小助手</h1>
          <p className="hero-lead">
            从原始数据、拟合与作图，到不确定度和有效数字。
            每一步保留计算链，结果可以直接复核。
          </p>
          <div className="hero-actions">
            <Link className="btn btn-primary btn-lg" to="/experiments">
              开始实验 <Icon name="arrowRight" size={17} />
            </Link>
            <Link className="btn btn-hero-secondary btn-lg" to="/tools/statistics">
              快速处理数据
            </Link>
          </div>
          <div className="hero-meta">
            <StandardProfileBadge />
            <span><Icon name="shield" size={14} /> 本地保存，不上传实验数据</span>
          </div>
          {profile.kind === 'custom' && (
            <div className="notice notice-warning hero-warning">
              <span className="n-icon">⚠</span>
              <div className="n-body">当前为自定义规则，不代表课程或 GB/T 标准。</div>
            </div>
          )}
        </div>

        <div className="hero-workflow" aria-label="实验数据处理流程">
          <div className="workflow-head">
            <span>DATA PIPELINE</span>
            <span className="workflow-status"><i /> READY</span>
          </div>
          <div className="workflow-formula">
            <span className="workflow-symbol">x̄ ± Δ</span>
            <span className="workflow-caption">可追溯结果表达</span>
          </div>
          <div className="workflow-steps">
            <div><b>01</b><span>记录</span><small>raw data</small></div>
            <div><b>02</b><span>拟合</span><small>fit & plot</small></div>
            <div><b>03</b><span>评定</span><small>uncertainty</small></div>
          </div>
        </div>
      </section>

      <section className="quick-grid" aria-label="常用入口">
        {QUICK_ACTIONS.map((action) => (
          <Link
            key={action.to}
            className={`quick-card${action.primary ? ' quick-card-primary' : ''}`}
            to={action.to}
          >
            <span className="q-icon" aria-hidden><Icon name={action.icon} size={21} /></span>
            <span className="q-copy">
              <span className="q-title">{action.title}</span>
              <span className="q-detail">{action.detail}</span>
            </span>
            <Icon className="q-arrow" name="arrowRight" size={18} />
          </Link>
        ))}
      </section>

      <section className="home-content-grid">
        <Panel
          title="当前标准规则摘要"
          sub={profile.name}
          actions={<Link to="/settings" className="btn btn-sm btn-quiet">切换标准</Link>}
        >
          <div className="rule-list">
            {profile.rulesSummary.slice(0, 6).map((rule, i) => (
              <div className="rule-row" key={i}>
                <span className="rule-index">{String(i + 1).padStart(2, '0')}</span>
                <span>{rule}</span>
              </div>
            ))}
          </div>
          <div className="panel-footnote">
            <Badge variant="default">规则可追溯</Badge>
            <Badge variant="default">课程 / GB/T 隔离</Badge>
          </div>
        </Panel>

        <Panel
          title="最近项目"
          sub={recent.length > 0 ? `${recent.length} 个最近记录` : '本浏览器'}
          actions={<Link to="/projects" className="btn btn-sm btn-quiet">全部项目</Link>}
        >
          {recent.length === 0 ? (
            <div className="empty-state compact">
              <div className="empty-icon"><Icon name="projects" size={24} /></div>
              <div>还没有项目</div>
              <div className="small muted">从“新建实验”开始，数据会自动保存在本浏览器。</div>
            </div>
          ) : (
            <div className="recent-list">
              {recent.map((project) => {
                const experiment = project.experimentId ? getExperiment(project.experimentId) : undefined;
                const projectProfile = tryGetProfile(project.standardProfileId);
                return (
                  <button
                    key={project.id}
                    className="recent-item"
                    onClick={() => navigate(`/project/${project.id}`)}
                  >
                    <span className="recent-icon" aria-hidden><Icon name="experiment" size={18} /></span>
                    <span className="recent-copy">
                      <strong>{project.title}</strong>
                      <small>{experiment?.title ?? '通用项目'} · {projectProfile?.shortName ?? project.standardProfileId}</small>
                    </span>
                    <span className="recent-time">{formatRelativeDate(project.updatedAt)}</span>
                    <Icon className="recent-arrow" name="arrowRight" size={16} />
                  </button>
                );
              })}
            </div>
          )}
        </Panel>
      </section>
    </main>
  );
}

function formatRelativeDate(iso: string): string {
  const time = new Date(iso).getTime();
  const diff = Date.now() - time;
  const minute = 60_000;
  const day = 24 * 60 * minute;
  if (diff >= 0 && diff < minute) return '刚刚';
  if (diff >= 0 && diff < 60 * minute) return `${Math.max(1, Math.floor(diff / minute))} 分钟前`;
  if (diff >= 0 && diff < day) return `${Math.floor(diff / (60 * minute))} 小时前`;
  if (diff >= 0 && diff < 7 * day) return `${Math.floor(diff / day)} 天前`;
  return new Date(iso).toLocaleDateString('zh-CN');
}
