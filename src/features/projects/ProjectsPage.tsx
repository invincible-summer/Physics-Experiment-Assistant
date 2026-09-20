/** 项目管理页：列出 / 打开 / 删除 / 导出全部 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listProjects, deleteProject, StoredProject } from '../../persistence/db';
import { getExperiment } from '../../experiments';
import { Panel, EmptyState, ConfirmButton, Badge } from '../../components/ui';
import { serializeProject } from '../../export';

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
      <h1>项目</h1>
      <p className="muted">保存在本浏览器（IndexedDB）。schemaVersion 当前 v1，导入旧版本项目时自动迁移并提示。</p>
      <div className="row" style={{ marginBottom: 12 }}>
        <button className="btn btn-primary" onClick={() => navigate('/experiments')}>新建实验项目</button>
        <button
          className="btn"
          onClick={() => download(new Blob([projects.map(serializeProject).join('\n')], { type: 'application/json' }), '全部项目备份.txt')}
          disabled={projects.length === 0}
        >导出全部</button>
      </div>
      {loading ? (
        <div className="empty-state"><div className="e-icon">⏳</div><div>加载中…</div></div>
      ) : projects.length === 0 ? (
        <EmptyState icon="🗂" title="还没有项目" hint="从实验列表新建第一个项目" />
      ) : (
        <Panel>
          <table className="contrib-table">
            <thead><tr><th>名称</th><th>实验</th><th>标准</th><th>更新时间</th><th>操作</th></tr></thead>
            <tbody>
              {projects.map((p) => {
                const exp = p.experimentId ? getExperiment(p.experimentId) : undefined;
                return (
                  <tr key={p.id}>
                    <td><a href={`#/project/${p.id}`}>{p.title}</a></td>
                    <td className="small">{exp?.title ?? '—'}</td>
                    <td><Badge variant="default">{p.standardProfileId}</Badge></td>
                    <td className="small">{new Date(p.updatedAt).toLocaleString('zh-CN')}</td>
                    <td className="row">
                      <button className="btn btn-sm" onClick={() => navigate(`/project/${p.id}`)}>打开</button>
                      <button
                        className="btn btn-sm"
                        onClick={() => download(new Blob([serializeProject(p)], { type: 'application/json' }), `${p.title}.json`)}
                      >JSON</button>
                      <ConfirmButton
                        className="btn btn-sm btn-danger"
                        question={`删除项目"${p.title}"？`}
                        onConfirm={async () => { await deleteProject(p.id); refresh(); }}
                      >删除</ConfirmButton>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {projects.some((p) => p.auditLog.length > 0) && (
            <details className="fold" style={{ marginTop: 10 }}>
              <summary>审计日志（数据排除等操作，{projects.reduce((s, p) => s + p.auditLog.length, 0)} 条）</summary>
              <div className="fold-body">
                {projects.filter((p) => p.auditLog.length > 0).map((p) => (
                  <div key={p.id} className="small" style={{ marginBottom: 8 }}>
                    <strong>{p.title}</strong>
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                      {p.auditLog.map((a, i) => <li key={i}>{new Date(a.at).toLocaleString('zh-CN')} · {a.action}{a.detail ? ` · ${a.detail}` : ''}</li>)}
                    </ul>
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
