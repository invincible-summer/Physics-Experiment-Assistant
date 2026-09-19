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
    <main className="page">
      <div className="home-hero">
        <h1>物理实验小助手</h1>
        <p className="muted">
          数据记录 → 清洗修正 → 派生计算 → 拟合作图 → 不确定度 → 有效数字 → 可复制报告片段。
          全部计算在本浏览器内完成，数据不上传。
        </p>
        <div className="row" style={{ marginTop: 10 }}>
          <StandardProfileBadge />
          <Badge variant="default">规则可追溯</Badge>
          <Badge variant="default">课程与 GB/T 严格隔离</Badge>
        </div>
        {profile.kind === 'custom' && (
          <div className="notice notice-warning" style={{ marginTop: 10 }}>
            <span className="n-icon">⚠</span><div className="n-body">当前为自定义规则，不代表课程或 GB/T 标准。</div>
          </div>
        )}
      </div>

      <div className="quick-grid" style={{ marginBottom: 16 }}>
        <Link className="quick-card" to="/experiments">
          <span className="q-icon">🔬</span>
          <span className="q-title">新建 2026 A(1) 实验</span>
          <span className="small muted">7 个必做实验：摩擦 · 霍尔 · 热导 · 阻尼 · 声速 · 透镜 · 迈克尔逊</span>
        </Link>
        <Link className="quick-card" to="/tools/statistics">
          <span className="q-icon">📊</span>
          <span className="q-title">快速数据处理</span>
          <span className="small muted">统计 · 拟合 · 加权平均 · 不确定度传播</span>
        </Link>
        <Link className="quick-card" to="/formulas">
          <span className="q-icon">ƒ</span>
          <span className="q-title">公式计算</span>
          <span className="small muted">选公式 → 填量与单位 → 求目标量 → 带不确定度</span>
        </Link>
        <Link className="quick-card" to="/tools/calculator">
          <span className="q-icon">🧮</span>
          <span className="q-title">科学计算器</span>
          <span className="small muted">安全 AST 求值 · 角度/弧度</span>
        </Link>
      </div>

      <Panel title="当前标准规则摘要" sub={profile.name} actions={<Link to="/settings" className="btn btn-sm">切换标准</Link>}>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {profile.rulesSummary.slice(0, 6).map((r, i) => <li key={i} className="small">{r}</li>)}
        </ul>
      </Panel>

      <Panel title="最近项目" actions={<Link to="/projects" className="btn btn-sm">全部项目</Link>}>
        {recent.length === 0 ? (
          <div className="empty-state"><div className="e-icon">🗂</div><div>还没有项目——从"新建实验"开始</div></div>
        ) : (
          <table className="contrib-table">
            <tbody>
              {recent.map((p) => {
                const exp = p.experimentId ? getExperiment(p.experimentId) : undefined;
                return (
                  <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/project/${p.id}`)}>
                    <td><strong>{p.title}</strong></td>
                    <td className="muted small">{exp?.title ?? '通用'}</td>
                    <td className="muted small">{new Date(p.updatedAt).toLocaleString('zh-CN')}</td>
                    <td className="num small">{p.standardProfileId}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Panel>
    </main>
  );
}
