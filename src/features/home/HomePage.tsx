/** 首页（plan §2.2）：任务导向 */
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { listProjects, StoredProject } from '../../persistence/db';
import { getExperiment } from '../../experiments';
import { useSettings } from '../../stores/settings';
import { Panel, Badge } from '../../components/ui';
import { StandardProfileBadge } from '../../components/StandardProfileBadge';

export function HomePage() {
  const navigate = useNavigate();
  const profile = useSettings((s) => s.activeProfile());
  const [recent, setRecent] = useState<StoredProject[]>([]);

  useEffect(() => {
    listProjects().then((all) => setRecent(all.slice(0, 5))).catch(() => setRecent([]));
  }, []);

  return (
    <main className="page home-page">
      <section className="home-hero">
        <div className="hero-eyebrow">PHYSICS EXPERIMENT WORKSPACE</div>
        <h1>物理实验小助手</h1>
        <p className="hero-lead">
          从原始数据到规范结果表达：记录、计算、拟合、作图、不确定度与有效数字在同一个本地工作区完成。
        </p>
        <p className="hero-note">全部计算在本浏览器内运行，实验数据不会上传。</p>
        <div className="hero-meta">
          <StandardProfileBadge />
          <Badge variant="default">规则可追溯</Badge>
          <Badge variant="default">课程与 GB/T 隔离</Badge>
        </div>
        {profile.kind === 'custom' && (
          <div className="notice notice-warning hero-warning">
            <div className="n-body">当前为自定义规则，不代表课程或 GB/T 标准。</div>
          </div>
        )}
      </section>

      <section className="quick-grid" aria-label="常用入口">
        <Link className="quick-card" to="/experiments">
          <span className="q-kicker">实验流程</span>
          <span className="q-title">新建 2026 A(1) 实验</span>
          <span className="q-desc">7 个必做实验，从原始记录一路处理到可复核结果。</span>
          <span className="q-link">进入实验工作台</span>
        </Link>
        <Link className="quick-card" to="/tools/statistics">
          <span className="q-kicker">数据工具</span>
          <span className="q-title">快速数据处理</span>
          <span className="q-desc">统计、拟合、加权平均与不确定度传播集中处理。</span>
          <span className="q-link">打开数据处理</span>
        </Link>
        <Link className="quick-card" to="/formulas">
          <span className="q-kicker">公式库</span>
          <span className="q-title">公式计算</span>
          <span className="q-desc">按物理量与单位填写数据，保留公式来源和计算链。</span>
          <span className="q-link">浏览公式</span>
        </Link>
        <Link className="quick-card" to="/tools/calculator">
          <span className="q-kicker">通用工具</span>
          <span className="q-title">科学计算器</span>
          <span className="q-desc">安全 AST 求值，支持角度与弧度模式，不执行任意脚本。</span>
          <span className="q-link">开始计算</span>
        </Link>
      </section>

      <div className="home-columns">
        <Panel
          title="当前标准规则摘要"
          sub={profile.name}
          actions={<Link to="/settings" className="btn btn-sm">切换标准</Link>}
        >
          <ul className="rule-list">
            {profile.rulesSummary.slice(0, 6).map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </Panel>

        <Panel title="最近项目" actions={<Link to="/projects" className="btn btn-sm">全部项目</Link>}>
          {recent.length === 0 ? (
            <div className="empty-state">
              <div className="empty-title">还没有项目</div>
              <div className="small">从“新建 2026 A(1) 实验”开始建立第一份记录。</div>
            </div>
          ) : (
            <div className="table-scroll">
              <table className="contrib-table recent-table">
                <tbody>
                  {recent.map((p) => {
                    const exp = p.experimentId ? getExperiment(p.experimentId) : undefined;
                    return (
                      <tr key={p.id} className="clickable-row" onClick={() => navigate(`/project/${p.id}`)}>
                        <td><strong>{p.title}</strong><div className="muted small">{exp?.title ?? '通用'}</div></td>
                        <td className="muted small nowrap">{new Date(p.updatedAt).toLocaleString('zh-CN')}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </main>
  );
}
