/** 项目管理页：列出 / 打开 / 删除 / 导出全部 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listProjects, deleteProject, StoredProject } from '../../persistence/db';
import { getExperiment } from '../../experiments';
import { Panel, EmptyState, ConfirmButton, Badge } from '../../components/ui';
import { serializeProject } from '../../export';
import { MarkdownInline, MarkdownList } from '../../components/Markdown';

export function ProjectsPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<StoredProject[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = () => {
    listProjects().then((all) => { setProjects(all); setLoading(false); }).catch(() => setLoading(false));
  };
  useEffect(refresh, []);

  return (
    <main className="page">
      <h1><MarkdownInline>项目</MarkdownInline></h1>
      <p className="muted"><MarkdownInline>保存在本浏览器（IndexedDB）。`schemaVersion` 当前 v1，导入旧版本项目时自动迁移并提示。</MarkdownInline></p>
      <div className="row" style={{ marginBottom: 12 }}>
        <button className="btn btn-primary" onClick={() => navigate('/experiments')}><MarkdownInline allowLinks={false}>新建实验项目</MarkdownInline></button>
        <button
          className="btn"
          onClick={() => download(new Blob([projects.map(serializeProject).join('\n')], { type: 'application/json' }), '全部项目备份.txt')}
          disabled={projects.length === 0}
        ><MarkdownInline allowLinks={false}>导出全部</MarkdownInline></button>
      </div>
      {loading ? (
        <div className="empty-state"><div><MarkdownInline>加载中…</MarkdownInline></div></div>
      ) : projects.length === 0 ? (
        <EmptyState icon="🗂" title="还没有项目" hint="从实验列表新建第一个项目" />
      ) : (
        <Panel>
          <table className="contrib-table">
            <thead><tr><th><MarkdownInline>名称</MarkdownInline></th><th><MarkdownInline>实验</MarkdownInline></th><th><MarkdownInline>标准</MarkdownInline></th><th><MarkdownInline>更新时间</MarkdownInline></th><th><MarkdownInline>操作</MarkdownInline></th></tr></thead>
            <tbody>
              {projects.map((p) => {
                const exp = p.experimentId ? getExperiment(p.experimentId) : undefined;
                return (
                  <tr key={p.id}>
                    <td><a href={`#/project/${p.id}`}><MarkdownInline>{p.title}</MarkdownInline></a></td>
                    <td className="small"><MarkdownInline>{exp?.title ?? '—'}</MarkdownInline></td>
                    <td><Badge variant="default">{p.standardProfileId}</Badge></td>
                    <td className="small">{new Date(p.updatedAt).toLocaleString('zh-CN')}</td>
                    <td className="row">
                      <button className="btn btn-sm" onClick={() => navigate(`/project/${p.id}`)}><MarkdownInline allowLinks={false}>打开</MarkdownInline></button>
                      <button
                        className="btn btn-sm"
                        onClick={() => download(new Blob([serializeProject(p)], { type: 'application/json' }), `${p.title}.json`)}
                      ><MarkdownInline allowLinks={false}>JSON</MarkdownInline></button>
                      <ConfirmButton
                        className="btn btn-sm btn-danger"
                        question={`删除项目"${p.title}"？`}
                        onConfirm={async () => { await deleteProject(p.id); refresh(); }}
                      ><MarkdownInline allowLinks={false}>删除</MarkdownInline></ConfirmButton>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {projects.some((p) => p.auditLog.length > 0) && (
            <details className="fold" style={{ marginTop: 10 }}>
              <summary><MarkdownInline>{`审计日志（数据排除等操作，${projects.reduce((s, p) => s + p.auditLog.length, 0)} 条）`}</MarkdownInline></summary>
              <div className="fold-body">
                {projects.filter((p) => p.auditLog.length > 0).map((p) => (
                  <div key={p.id} className="small" style={{ marginBottom: 8 }}>
                    <strong><MarkdownInline>{p.title}</MarkdownInline></strong>
                    <MarkdownList items={p.auditLog.map((a) => `${new Date(a.at).toLocaleString('zh-CN')} · ${a.action}${a.detail ? ` · ${a.detail}` : ''}`)} />
                  </div>
                ))}
              </div>
            </details>
          )}
        </Panel>
      )}
    </main>
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
