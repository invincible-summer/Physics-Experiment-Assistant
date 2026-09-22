/** 项目管理页：搜索 / 排序 / 打开 / 重命名 / 复制 / 导入导出 / 删除 / 每项目审计日志 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  deleteProject, duplicateProject, importProjectJson, listProjects, saveProject,
  serializeProjectsArchive, StoredProject,
} from '../../persistence/db';
import { getExperiment } from '../../experiments';
import { tryGetProfile } from '../../standards/registry';
import { serializeProject } from '../../export';
import {
  Badge, Button, ConfirmButton, EmptyState, Field, Menu, Modal, Notice, Panel, toast,
} from '../../components/ui';
import { Icon } from '../../components/Icon';
import { MarkdownBlock, MarkdownInline, MarkdownList } from '../../components/Markdown';

type SortBy = 'updated' | 'created' | 'name';

/** 项目填写进度：所有数据表的非空单元格占比 */
function projectProgress(p: StoredProject): { filled: number; total: number } {
  let filled = 0;
  let total = 0;
  for (const rows of Object.values(p.tables)) {
    for (const row of rows) {
      for (const cell of row) {
        total += 1;
        if (String(cell).trim() !== '') filled += 1;
      }
    }
  }
  return { filled, total };
}

export function ProjectsPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<StoredProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [query, setQuery] = useState('');
  const [experimentFilter, setExperimentFilter] = useState('all');
  const [sortBy, setSortBy] = useState<SortBy>('updated');
  const [renaming, setRenaming] = useState<StoredProject | null>(null);
  const [renameTitle, setRenameTitle] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = () => {
    setLoading(true);
    listProjects()
      .then((all) => { setProjects(all); setLoadError(false); })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  };
  useEffect(refresh, []);

  /** 搜索（标题/实验名）+ 排序后的可见列表 */
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const candidates = projects.filter(p => experimentFilter === 'all' || (p.experimentId ?? 'free') === experimentFilter);
    const filtered = q
      ? candidates.filter((p) => {
        const exp = p.experimentId ? getExperiment(p.experimentId) : undefined;
        return p.title.toLowerCase().includes(q) || (exp?.title ?? '').toLowerCase().includes(q);
      })
      : [...candidates];
    filtered.sort((a, b) => {
      if (sortBy === 'name') return a.title.localeCompare(b.title, 'zh-CN');
      const key = sortBy === 'created' ? 'createdAt' : 'updatedAt';
      return a[key] < b[key] ? 1 : -1;
    });
    return filtered;
  }, [projects, query, sortBy, experimentFilter]);

  const experiments = [...new Set(projects.map(p => p.experimentId ?? 'free'))];
  const latest = [...projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  const filtered = query.trim() !== '' || experimentFilter !== 'all';
  const clearFilters = () => { setQuery(''); setExperimentFilter('all'); };

  const exportAll = () => {
    download(
      new Blob([serializeProjectsArchive(projects)], { type: 'application/json' }),
      `全部项目备份-${new Date().toISOString().slice(0, 10)}.json`,
    );
  };

  const onImportFile = async (file: File) => {
    const text = await file.text();
    const result = await importProjectJson(text);
    if (result.ok) {
      toast(
        `导入完成：新增 ${result.imported} 个项目`
        + `${result.skipped > 0 ? `，跳过 ${result.skipped} 条无效数据` : ''}`
        + `${result.migrationNote ? `（${result.migrationNote}）` : ''}`,
      );
      refresh();
    } else {
      toast(`导入失败：${result.error}`);
    }
  };

  const confirmRename = async () => {
    if (!renaming) return;
    const title = renameTitle.trim();
    if (!title) return;
    try { await saveProject({ ...renaming, title }); } catch { toast('重命名未保存，请重试。'); return; }
    setRenaming(null);
    toast(`已重命名为「${title}」`);
    refresh();
  };

  const onDuplicate = async (p: StoredProject) => {
    const copy = await duplicateProject(p.id);
    if (copy) {
      toast(`已复制为「${copy.title}」`);
      refresh();
    } else {
      toast('复制失败：项目不存在');
    }
  };

  return (
    <div className="stack-lg projects-page">
      <header className="page-head">
        <h1 className="page-title"><MarkdownInline>我的项目</MarkdownInline></h1>
        <div className="page-lead">
          <MarkdownBlock>{'集中管理实验记录，随时继续录入和导出报告。数据保存在当前浏览器；换设备前，请先导出备份。'}</MarkdownBlock>
        </div>
      </header>

      {!loading && !loadError && latest && (
        <section className="project-resume" aria-label="继续最近项目">
          <div className="project-resume-icon"><Icon name="folder" size={26} /></div>
          <div className="project-resume-copy">
            <div className="small muted"><MarkdownInline>继续最近更新的记录</MarkdownInline></div>
            <h2><MarkdownInline>{latest.title}</MarkdownInline></h2>
            <div className="small muted"><MarkdownInline>{getExperiment(latest.experimentId ?? '')?.title ?? '自由项目'}</MarkdownInline></div>
          </div>
          <Link className="btn btn-primary" to={`/project/${latest.id}`}><MarkdownInline allowLinks={false}>继续实验</MarkdownInline><Icon name="arrow-right" size={16} /></Link>
        </section>
      )}
      <div className="project-actions">
        <Button variant="primary" icon="plus" onClick={() => navigate('/experiments')}>新建实验项目</Button>
        <Button icon="upload" onClick={() => fileRef.current?.click()}>导入项目 JSON</Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          aria-label="选择要导入的项目 JSON 文件"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void onImportFile(file).catch(() => toast('导入失败，请检查文件是否可读取以及浏览器存储是否可用。'));
            e.target.value = '';
          }}
        />
        <Button icon="download" onClick={exportAll} disabled={projects.length === 0}>导出全部项目 JSON</Button>
      </div>
      <div className="project-filters" role="search" aria-label="筛选项目">
        <div className="search-input">
          <Icon name="search" size={16} />
          <input
            className="input"
            type="search"
            placeholder="搜索项目标题或实验名"
            aria-label="搜索项目"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <select className="select" aria-label="按实验筛选" value={experimentFilter} onChange={e => setExperimentFilter(e.target.value)}>
          <option value="all">全部实验</option>
          {experiments.map(id => <option key={id} value={id}>{getExperiment(id)?.title ?? '自由项目'}</option>)}
        </select>
        <select
          className="select"
          aria-label="项目排序方式"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortBy)}
        >
          <option value="updated">按最近更新</option>
          <option value="created">按创建时间</option>
          <option value="name">按名称</option>
        </select>
      </div>

      {!loading && !loadError && projects.length > 0 && <div className="project-filter-status" role="status">
        <MarkdownInline>{`显示 ${visible.length} / ${projects.length} 个项目`}</MarkdownInline>
        {filtered && <Button size="sm" variant="ghost" onClick={clearFilters}>清除筛选</Button>}
      </div>}
      {loading ? (
        <div className="muted small"><MarkdownBlock>正在读取本地项目…</MarkdownBlock></div>
      ) : loadError ? (
        <Notice variant="danger" title="读取失败" actions={<Button onClick={refresh}>重新读取</Button>}>
          <MarkdownBlock>本地项目列表读取失败，请刷新页面重试；数据仍保存在浏览器 IndexedDB 中。</MarkdownBlock>
        </Notice>
      ) : projects.length === 0 ? (
        <EmptyState icon="folder" title="还没有项目" hint="到实验工作台新建第一份实验记录，数据只保存在本浏览器。">
          <Button variant="primary" onClick={() => navigate('/experiments')}>去实验工作台新建</Button>
        </EmptyState>
      ) : visible.length === 0 ? (
        <EmptyState icon="search" title="没有匹配的项目" hint="试试其他关键词或实验分类，也可以恢复全部项目。"><Button onClick={clearFilters}>显示全部项目</Button></EmptyState>
      ) : (
        <Panel
          title="项目列表"
          sub="录入进度仅统计已填写单元格，计算结果请进入项目查看。"
        >
          <div>
            {visible.map((p) => {
              const exp = p.experimentId ? getExperiment(p.experimentId) : undefined;
              const profile = tryGetProfile(p.standardProfileId);
              const { filled, total } = projectProgress(p);
              const pct = total > 0 ? Math.round((filled / total) * 100) : 0;
              return (
                <div className="proj-row" key={p.id}>
                  <div className="proj-main">
                    <div className="proj-title">
                      <Link to={`/project/${p.id}`} className="md-link">
                        <MarkdownInline allowLinks={false}>{p.title}</MarkdownInline>
                      </Link>
                    </div>
                    <div className="proj-meta">
                      <MarkdownInline>{exp?.title ?? '自由项目'}</MarkdownInline>
                      <Badge title={p.standardProfileId}>{profile?.shortName ?? p.standardProfileId}</Badge>
                      <span className="faint">·</span>
                      <MarkdownInline>{`更新于 ${new Date(p.updatedAt).toLocaleString('zh-CN')}`}</MarkdownInline>
                    </div>
                    {total > 0 && (
                      <div className="proj-progress">
                        <span className="progress-track">
                          <span className="progress-fill" style={{ width: `${pct}%`, display: 'block' }} />
                        </span>
                        <span className="xs faint"><MarkdownInline>{`已填 ${filled}/${total} 格（${pct}%）`}</MarkdownInline></span>
                      </div>
                    )}
                    {p.auditLog.length > 0 && (
                      <details className="fold" style={{ marginTop: 6 }}>
                        <summary><MarkdownInline>{`操作记录（${p.auditLog.length} 条）`}</MarkdownInline></summary>
                        <div className="fold-body">
                          <MarkdownList
                            className="mono small"
                            items={p.auditLog.map((a) =>
                              `${new Date(a.at).toLocaleString('zh-CN')} · ${a.action}${a.detail ? ` · ${a.detail}` : ''}`)}
                          />
                        </div>
                      </details>
                    )}
                  </div>
                  <div className="project-row-actions">
                    <Link to={`/project/${p.id}`} className="btn btn-sm">
                      <MarkdownInline allowLinks={false}>打开</MarkdownInline>
                    </Link>
                    <Menu
                      trigger="管理"
                      align="right"
                      items={[
                        { id: 'rename', label: '重命名', icon: 'pencil' },
                        { id: 'duplicate', label: '复制项目', icon: 'copy' },
                        { id: 'export', label: '导出 JSON', icon: 'download' },
                      ]}
                      onSelect={(id) => {
                        if (id === 'rename') {
                          setRenaming(p);
                          setRenameTitle(p.title);
                        } else if (id === 'duplicate') {
                          void onDuplicate(p).catch(() => toast('复制失败，原项目仍然保留，请重试。'));
                        } else if (id === 'export') {
                          download(new Blob([serializeProject(p)], { type: 'application/json' }), `${p.title}.json`);
                        }
                      }}
                    />
                    <ConfirmButton
                      variant="danger"
                      size="sm"
                      question={`删除项目「${p.title}」？此操作不可恢复。`}
                      onConfirm={async () => { try { await deleteProject(p.id); refresh(); } catch { toast('删除失败，请重试。'); } }}
                    >删除</ConfirmButton>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      )}

      <Modal open={renaming !== null} onClose={() => setRenaming(null)} title="重命名项目">
        <div className="stack">
          <Field label="项目标题" hint="仅修改显示标题，不影响实验数据与计算链">
            <input
              className="input"
              value={renameTitle}
              autoFocus
              onChange={(e) => setRenameTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void confirmRename(); }}
            />
          </Field>
          <div className="row">
            <Button variant="primary" disabled={renameTitle.trim() === ''} onClick={() => void confirmRename()}>保存</Button>
            <Button onClick={() => setRenaming(null)}>取消</Button>
          </div>
        </div>
      </Modal>
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
