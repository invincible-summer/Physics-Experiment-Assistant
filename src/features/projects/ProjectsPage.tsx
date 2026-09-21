/** 项目管理页：列出 / 打开 / 删除 / 导出全部 / 每项目审计日志 */
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { listProjects, deleteProject, StoredProject } from '../../persistence/db';
import { getExperiment } from '../../experiments';
import { tryGetProfile } from '../../standards/registry';
import { serializeProject } from '../../export';
import { Badge, Button, ConfirmButton, EmptyState, Notice, Panel } from '../../components/ui';
import { MarkdownInline, MarkdownList } from '../../components/Markdown';

export function ProjectsPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<StoredProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const refresh = () => {
    listProjects()
      .then((all) => { setProjects(all); setLoadError(false); })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  };
  useEffect(refresh, []);

  const exportAll = () => {
    const payload = JSON.stringify(projects, null, 2);
    download(
      new Blob([payload], { type: 'application/json' }),
      `全部项目备份-${new Date().toISOString().slice(0, 10)}.json`,
    );
  };

  return (
    <div className="stack-lg">
      <header className="page-head">
        <h1 className="page-title"><MarkdownInline>我的项目</MarkdownInline></h1>
        <p className="page-lead">
          <MarkdownInline>{'项目数据只保存在本浏览器（IndexedDB），不会上传；`schemaVersion` 当前为 v1，导入旧版本项目时自动迁移并提示。'}</MarkdownInline>
        </p>
      </header>

      <div className="row">
        <Button variant="primary" onClick={() => navigate('/experiments')}>新建实验项目</Button>
        <Button onClick={exportAll} disabled={projects.length === 0}>导出全部项目 JSON</Button>
        <span className="muted small">
          <MarkdownInline>导入项目请到</MarkdownInline>
          <Link className="md-link" to="/settings"><MarkdownInline>设置页「数据与隐私」</MarkdownInline></Link>
          <MarkdownInline>，支持单个项目 JSON 文件。</MarkdownInline>
        </span>
      </div>

      {loading ? (
        <p className="muted small"><MarkdownInline>正在读取本地项目…</MarkdownInline></p>
      ) : loadError ? (
        <Notice variant="danger" title="读取失败">
          <MarkdownInline>本地项目列表读取失败，请刷新页面重试；数据仍保存在浏览器 IndexedDB 中。</MarkdownInline>
        </Notice>
      ) : projects.length === 0 ? (
        <EmptyState title="还没有项目" hint="到实验工作台新建第一份实验记录，数据只保存在本浏览器。">
          <Button variant="primary" onClick={() => navigate('/experiments')}>去实验工作台新建</Button>
        </EmptyState>
      ) : (
        <Panel title="项目列表" sub={`共 ${projects.length} 个项目，按最近更新排序`}>
          <table className="stat-table">
            <thead>
              <tr>
                <th><MarkdownInline>标题</MarkdownInline></th>
                <th><MarkdownInline>实验</MarkdownInline></th>
                <th><MarkdownInline>标准</MarkdownInline></th>
                <th><MarkdownInline>更新时间</MarkdownInline></th>
                <th><MarkdownInline>操作</MarkdownInline></th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => {
                const exp = p.experimentId ? getExperiment(p.experimentId) : undefined;
                const profile = tryGetProfile(p.standardProfileId);
                return (
                  <tr key={p.id}>
                    <td>
                      <Link to={`/project/${p.id}`} className="md-link">
                        <MarkdownInline allowLinks={false}>{p.title}</MarkdownInline>
                      </Link>
                      {p.auditLog.length > 0 && (
                        <details className="fold" style={{ marginTop: 4 }}>
                          <summary><MarkdownInline>{`审计日志（${p.auditLog.length} 条）`}</MarkdownInline></summary>
                          <div className="fold-body">
                            <MarkdownList
                              className="mono small"
                              items={p.auditLog.map((a) =>
                                `${new Date(a.at).toLocaleString('zh-CN')} · ${a.action}${a.detail ? ` · ${a.detail}` : ''}`)}
                            />
                          </div>
                        </details>
                      )}
                    </td>
                    <td className="small"><MarkdownInline>{exp?.title ?? '自由'}</MarkdownInline></td>
                    <td><Badge title={p.standardProfileId}>{profile?.shortName ?? p.standardProfileId}</Badge></td>
                    <td className="num nowrap"><MarkdownInline>{new Date(p.updatedAt).toLocaleString('zh-CN')}</MarkdownInline></td>
                    <td>
                      <div className="row-nowrap">
                        <Link to={`/project/${p.id}`} className="btn btn-sm">
                          <MarkdownInline allowLinks={false}>打开</MarkdownInline>
                        </Link>
                        <Button
                          size="sm"
                          onClick={() => download(new Blob([serializeProject(p)], { type: 'application/json' }), `${p.title}.json`)}
                        >导出 JSON</Button>
                        <ConfirmButton
                          variant="danger"
                          size="sm"
                          question={`删除项目「${p.title}」？此操作不可恢复。`}
                          onConfirm={async () => { await deleteProject(p.id); refresh(); }}
                        >删除</ConfirmButton>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Panel>
      )}
    </div>
  );
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.replace(/[\\/:*?"<>|]/g, '_');
  a.click();
  URL.revokeObjectURL(url);
}
