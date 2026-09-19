/** 实验列表页 + 新建项目页（plan §2.3） */
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { listExperiments, getExperiment } from '../../experiments';
import { createProject } from '../../persistence/db';
import { useSettings } from '../../stores/settings';
import { Panel, Badge, EmptyState, toast } from '../../components/ui';
import { Icon } from '../../components/Icon';

export function ExperimentsPage() {
  const navigate = useNavigate();
  const experiments = listExperiments();
  const profileId = useSettings((s) => s.standardProfileId);

  return (
    <main className="page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">EXPERIMENT WORKBENCH</div>
          <h1>实验工作台</h1>
          <p>
            2026 秋物理实验 A(1) 的 7 个必做实验。
            当前标准：{profileId === 'custom' ? '自定义' : profileId === 'gbt-27418-2017' ? 'GB/T（模板仍按课程流程呈现）' : '课程'}。
          </p>
        </div>
        <div className="page-heading-aside">
          <span className="summary-stat"><strong>{experiments.length}</strong><small>实验模板</small></span>
        </div>
      </div>

      <div className="experiment-grid">
        {experiments.map((exp, index) => (
          <article key={exp.id} className="experiment-card">
            <div className="experiment-card-head">
              <span className="experiment-number">{String(index + 1).padStart(2, '0')}</span>
              <Badge variant="default">{exp.category}</Badge>
              <span className="spacer" />
              {exp.safety.length > 0 && (
                <span className="safety-chip" title="本实验含安全提示">⚠ 安全</span>
              )}
            </div>
            <div className="experiment-card-body">
              <h2>{exp.title}</h2>
              <p>{exp.subtitle}</p>
              <div className="experiment-tags">
                {exp.tags.slice(0, 3).map((tag) => <span key={tag}>{tag}</span>)}
              </div>
            </div>
            <div className="experiment-card-foot">
              <span className="report-type">
                {exp.reportType === 'full' ? '完整报告' : '极简报告'}
                <small>{exp.steps.length} 个处理步骤</small>
              </span>
              <button
                className="btn btn-primary"
                onClick={() => navigate(`/experiments/${exp.id}/new`)}
              >
                创建实验 <Icon name="arrowRight" size={16} />
              </button>
            </div>
          </article>
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
        <EmptyState icon="?" title="未找到该实验" />
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
    <main className="page narrow-page">
      <button className="back-link" onClick={() => navigate('/experiments')}>
        <Icon name="arrowLeft" size={16} /> 实验列表
      </button>

      <div className="page-heading">
        <div>
          <div className="eyebrow">NEW PROJECT</div>
          <h1>新建项目</h1>
          <p>{experiment.title} · {experiment.steps.length} 个步骤 · 数据仅保存在本浏览器。</p>
        </div>
      </div>

      <Panel title="项目信息" sub="创建后可随时修改实验数据">
        <div className="field-label">项目名称</div>
        <input className="input input-lg" value={title} onChange={(e) => setTitle(e.target.value)} />
        <div className="project-create-meta">
          <span>标准配置</span>
          <strong>{profileId}</strong>
          <small>项目按创建时的标准记录；可在设置中切换全局标准。</small>
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
        <div className="row" style={{ marginTop: 18 }}>
          <button className="btn btn-primary btn-lg" onClick={create} disabled={creating}>
            {creating ? '创建中…' : <>创建并进入工作台 <Icon name="arrowRight" size={16} /></>}
          </button>
        </div>
      </Panel>
    </main>
  );
}
