/** 实验列表页 + 新建项目页（plan §2.3） */
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { listExperiments, getExperiment } from '../../experiments';
import { createProject } from '../../persistence/db';
import { useSettings } from '../../stores/settings';
import { Badge, Button, EmptyState, Field, Notice, Panel, SafetyNotice, SourceBadge, toast } from '../../components/ui';
import { MarkdownInline } from '../../components/Markdown';

export function ExperimentsPage() {
  const navigate = useNavigate();
  const experiments = listExperiments();

  return (
    <>
      <header className="page-head">
        <h1 className="page-title"><MarkdownInline>实验工作台</MarkdownInline></h1>
        <p className="page-lead">
          <MarkdownInline>{'2026 秋物理实验 A(1) 的 **7 个必做实验**：从原始数据记录、数据修正、拟合作图到不确定度与结果表达的完整流程。选择实验新建项目，全部数据仅保存在本浏览器。'}</MarkdownInline>
        </p>
      </header>
      <div className="card-grid">
        {experiments.map((exp) => (
          <Panel key={exp.id} title={exp.title} sub={exp.subtitle} icon="flask">
            <div className="stack">
              <div className="exp-card-tags">
                <Badge>{exp.category}</Badge>
                {exp.tags.map((t) => <Badge key={t}>{t}</Badge>)}
                <SourceBadge provenance={exp.provenance} />
              </div>
              <div className="exp-card-foot">
                <span className="row" style={{ gap: 6 }}>
                  <Badge variant={exp.reportType === 'full' ? 'accent' : 'default'}>
                    {exp.reportType === 'full' ? '完整报告' : '简要报告'}
                  </Badge>
                  {exp.safety.length > 0 && (
                    <Badge variant="warning" title="本实验含安全须知，新建项目后请先阅读">
                      {`安全须知 ${exp.safety.length} 条`}
                    </Badge>
                  )}
                </span>
                <Button variant="primary" size="sm" icon="arrow-right" onClick={() => navigate(`/experiments/${exp.id}/new`)}>
                  新建项目
                </Button>
              </div>
            </div>
          </Panel>
        ))}
      </div>
    </>
  );
}

export function NewExperimentProjectPage() {
  const { experimentId } = useParams();
  const navigate = useNavigate();
  const experiment = experimentId ? getExperiment(experimentId) : undefined;
  const profileId = useSettings((s) => s.standardProfileId);
  const activeProfile = useSettings((s) => s.activeProfile);
  const [title, setTitle] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (experiment && title === '') {
      setTitle(`${experiment.title} ${new Date().toLocaleDateString('zh-CN')}`);
    }
  }, [experiment, title]);

  if (!experiment) {
    return (
      <EmptyState title="未找到该实验" hint="链接中的实验标识无效，可能是地址不完整或该实验已调整。">
        <Link to="/experiments"><MarkdownInline allowLinks={false}>返回实验列表</MarkdownInline></Link>
      </EmptyState>
    );
  }

  const profile = activeProfile();

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
    <>
      <p className="small" style={{ marginBottom: 12 }}>
        <Link to="/experiments"><MarkdownInline allowLinks={false}>返回实验列表</MarkdownInline></Link>
      </p>
      <header className="page-head">
        <h1 className="page-title"><MarkdownInline>新建项目</MarkdownInline></h1>
      </header>
      <div className="stack-lg">
        <Panel
          title={experiment.title}
          sub={experiment.subtitle}
          actions={<SourceBadge provenance={experiment.provenance} />}
        >
          <div className="row">
            <Badge>{experiment.category}</Badge>
            {experiment.tags.map((t) => <Badge key={t}>{t}</Badge>)}
            <Badge variant={experiment.reportType === 'full' ? 'accent' : 'default'}>
              {experiment.reportType === 'full' ? '完整报告' : '简要报告'}
            </Badge>
          </div>
          <p className="small muted" style={{ margin: '10px 0 0' }}>
            <MarkdownInline>{`共 **${experiment.steps.length}** 个步骤 · 项目数据仅保存在本浏览器，不会上传`}</MarkdownInline>
          </p>
        </Panel>
        <SafetyNotice items={experiment.safety} />
        <Panel title="项目设置">
          <div className="stack">
            <Field label="项目名称" hint="可修改；留空时按实验名称保存。">
              <input
                className="input"
                style={{ maxWidth: 420 }}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                aria-label="项目名称"
              />
            </Field>
            <Notice variant="info" title="当前标准配置">
              <MarkdownInline>{`**${profile.name}**（\`${profileId}\`）。项目按创建时的标准配置计算，创建后仍可在工作台中切换。`}</MarkdownInline>
            </Notice>
            <div className="row">
              <Button variant="primary" onClick={create} disabled={creating}>
                {creating ? '创建中…' : '创建项目并进入工作台'}
              </Button>
            </div>
          </div>
        </Panel>
      </div>
    </>
  );
}
