/** 实验列表页 + 新建项目页（plan §2.3） */
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { listExperiments, getExperiment } from '../../experiments';
import { createProject } from '../../persistence/db';
import { useSettings } from '../../stores/settings';
import { Panel, Badge, EmptyState, toast } from '../../components/ui';

export function ExperimentsPage() {
  const navigate = useNavigate();
  const experiments = listExperiments();
  const profileId = useSettings((s) => s.standardProfileId);

  return (
    <main className="page">
      <h1>实验工作台</h1>
      <p className="muted">2026 秋物理实验 A(1) 的 7 个必做实验 · 当前标准 {profileId === 'custom' ? '自定义' : profileId === 'gbt-27418-2017' ? 'GB/T（实验模板按课程规则呈现，注意区分）' : '课程'}</p>
      <div className="card-grid">
        {experiments.map((exp) => (
          <div key={exp.id} className="panel exp-card">
            <div className="fc-title">
              <span>{exp.title}</span>
              {exp.safety.length > 0 && <Badge variant="warning" title="含安全提示">⚠ 安全</Badge>}
            </div>
            <div className="small muted">{exp.subtitle}</div>
            <div className="tags">
              <Badge variant="default">{exp.category}</Badge>
              {exp.tags.map((t) => <Badge key={t} variant="default">{t}</Badge>)}
              <Badge variant={exp.reportType === 'full' ? 'accent' : 'default'}>
                {exp.reportType === 'full' ? '完整报告（阻尼）' : '极简报告'}
              </Badge>
            </div>
            <div className="fc-actions">
              <button
                className="btn btn-primary btn-sm"
                onClick={() => navigate(`/experiments/${exp.id}/new`)}
              >新建项目</button>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

export function NewExperimentProjectPage() {
  const { experimentId } = useParams();
  const navigate = useNavigate();
  const experiment = experimentId ? getExperiment(experimentId) : undefined;
  const profileId = useSettings((s) => s.standardProfileId);
  const [title, setTitle] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (experiment && title === '') {
      setTitle(`${experiment.title} ${new Date().toLocaleDateString('zh-CN')}`);
    }
  }, [experiment, title]);

  if (!experiment) {
    return (
      <main className="page">
        <EmptyState icon="❓" title="未找到该实验" />
        <button className="btn" onClick={() => navigate('/experiments')}>返回实验列表</button>
      </main>
    );
  }

  const create = async () => {
    setCreating(true);
    try {
      const project = await createProject({
        title: title.trim() || experiment.title,
        experimentId: experiment.id,
        experimentVersion: experiment.version,
        standardProfileId: profileId,
      });
      navigate(`/project/${project.id}`);
    } catch (err) {
      toast(`创建失败：${(err as Error).message}`);
      setCreating(false);
    }
  };

  return (
    <main className="page">
      <div className="row" style={{ marginBottom: 10 }}>
        <button className="btn btn-sm" onClick={() => navigate('/experiments')}>← 实验列表</button>
      </div>
      <h1>新建项目：{experiment.title}</h1>
      <Panel title="项目信息" sub={`${experiment.steps.length} 个步骤 · 数据保存在本浏览器`}>
        <div className="field-label">项目名称</div>
        <input className="input" style={{ maxWidth: 420 }} value={title} onChange={(e) => setTitle(e.target.value)} />
        <div className="small muted" style={{ margin: '10px 0' }}>
          标准配置：<strong>{profileId}</strong>（项目按创建时的标准计算，之后可切换）
        </div>
        {experiment.safety.length > 0 && (
          <div className="notice notice-warning">
            <span className="n-icon">⚠</span>
            <div className="n-body">
              <div className="n-title">本实验含安全提示</div>
              {experiment.safety[0]}{experiment.safety.length > 1 ? ` 等 ${experiment.safety.length} 条` : ''}
            </div>
          </div>
        )}
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn btn-primary" onClick={create} disabled={creating}>
            {creating ? '创建中…' : '创建并进入工作台'}
          </button>
        </div>
      </Panel>
    </main>
  );
}
