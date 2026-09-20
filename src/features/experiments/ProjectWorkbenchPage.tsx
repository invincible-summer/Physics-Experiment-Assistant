/**
 * ProjectWorkbenchPage — 实验工作台三栏布局（plan §4.2）。
 * 步骤导航 | 主工作区（数据表/图/表单） | 结果检查器。
 * 自动保存到 IndexedDB；导出对话框；行排除审计。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getProject, saveProject, StoredProject } from '../../persistence/db';
import { getExperiment } from '../../experiments';
import { ExperimentState } from '../../experiments/types';
import { parseTable } from '../../experiments/engine';
import { useSettings } from '../../stores/settings';
import { AppShell } from '../../app/layout/AppShell';
import { StandardProfileBadge } from '../../components/StandardProfileBadge';
import { DataGrid, GridColumn } from '../../components/DataGrid';
import { PhysicsPlot, PlotSeries, PlotChecklist } from '../../components/PhysicsPlot';
import { ResultCard } from '../../components/ResultInspector';
import { Panel, Modal, CopyButton, Badge, toast } from '../../components/ui';
import { Tex } from '../../components/katex';
import { buildDataProcessingMarkdown, buildResultLatex, tableToCSV, serializeProject } from '../../export';
import { ForcedPlotsBlock, QuasiDiagnosticsBlock, MichelsonChecklistBlock } from './custom-blocks';

export function ProjectWorkbenchPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const settings = useSettings();
  const profile = useSettings((s) => s.activeProfile());
  const [project, setProject] = useState<StoredProject | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [stepIdx, setStepIdx] = useState(0);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error'>('saved');
  const saveTimer = useRef<number | undefined>(undefined);

  const experiment = project?.experimentId ? getExperiment(project.experimentId) : undefined;

  useEffect(() => {
    let alive = true;
    if (!projectId) return;
    getProject(projectId)
      .then((p) => {
        if (!alive) return;
        if (!p) { setLoadError('项目不存在或已被删除'); return; }
        setProject(p);
      })
      .catch((err) => alive && setLoadError((err as Error).message));
    return () => { alive = false; };
  }, [projectId]);

  // 版本迁移提示（plan §13）
  const [migrationNote, setMigrationNote] = useState<string | null>(null);
  useEffect(() => {
    if (!project || !experiment) return;
    if (project.experimentVersion !== undefined && project.experimentVersion < experiment.version) {
      setMigrationNote(`实验定义已从 v${project.experimentVersion} 升级到 v${experiment.version}，旧数据按新定义解释前请核对`);
      project.experimentVersion = experiment.version;
    } else if (project.standardProfileId !== profile.id) {
      setMigrationNote(`项目标准（${project.standardProfileId}）与当前全局标准（${profile.id}）不同。项目按保存时的标准计算，可在设置切换。`);
    }
  }, [project, experiment, profile.id]);

  // 自动保存（防抖）
  const scheduleSave = useCallback((p: StoredProject) => {
    if (!settings.autosave) return;
    setSaveState('saving');
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      saveProject(p)
        .then(() => setSaveState('saved'))
        .catch(() => setSaveState('error'));
    }, 800);
  }, [settings.autosave]);

  const updateProject = useCallback((mutate: (p: StoredProject) => void) => {
    setProject((prev) => {
      if (!prev) return prev;
      const next = { ...prev, tables: { ...prev.tables }, params: { ...prev.params }, metadata: { ...prev.metadata }, excludedRows: { ...prev.excludedRows } };
      mutate(next);
      next.updatedAt = new Date().toISOString();
      scheduleSave(next);
      return next;
    });
  }, [scheduleSave]);

  // 计算管线
  const computation = useMemo(() => {
    if (!project || !experiment) return null;
    const state: ExperimentState = {
      params: project.params,
      tables: project.tables,
      excludedRows: project.excludedRows,
    };
    try {
      return experiment.compute(state, profile);
    } catch (err) {
      toast(`计算失败：${(err as Error).message}`);
      return null;
    }
  }, [project, experiment, profile]);

  const step = experiment?.steps[stepIdx];
  const results = computation?.results ?? [];

  if (loadError) {
    return (
      <AppShell>
        <main className="page">
          <div className="empty-state"><div className="e-icon">❓</div><div>{loadError}</div></div>
          <button className="btn" onClick={() => navigate('/projects')}>返回项目列表</button>
        </main>
      </AppShell>
    );
  }
  if (!project || !experiment) {
    return (
      <AppShell>
        <main className="page"><div className="empty-state"><div className="e-icon">⏳</div><div>加载中…</div></div></main>
      </AppShell>
    );
  }

  const paramScope: Record<string, number> = {};
  for (const [k, v] of Object.entries(project.params)) {
    const n = Number(v);
    if (Number.isFinite(n)) paramScope[k] = n;
  }

  const renderBlock = (block: NonNullable<typeof step>['blocks'][number]) => {
    switch (block.type) {
      case 'safety':
        return (
          <div className="safety-banner" role="alert">
            <div className="sb-icon" aria-hidden>⚠️</div>
            <div>
              <strong>安全须知（操作以教师现场要求为准）</strong>
              <ul>{block.items.map((s, i) => <li key={i}>{s}</li>)}</ul>
            </div>
          </div>
        );
      case 'params':
        return (
          <Panel title={block.title ?? '参数'}>
            <div className="form-grid">
              {block.fields.map((fid) => {
                const field = experiment.params.find((p) => p.id === fid);
                if (!field) return null;
                return (
                  <div key={fid}>
                    <div className="field-label">
                      <span>{field.label}</span>
                      {field.unit && <span className="mono">[{field.unit}]</span>}
                    </div>
                    <input
                      className="input"
                      value={project.params[fid] ?? ''}
                      placeholder={field.defaultText ?? ''}
                      inputMode={field.kind === 'text' ? 'text' : 'decimal'}
                      onChange={(e) => updateProject((p) => { p.params[fid] = e.target.value; })}
                    />
                    {field.hint && <div className="field-help">{field.hint}</div>}
                    {field.instrumentErrorNote && (
                      <div className="field-help" style={{ color: 'var(--warning)' }}>ⓘ {field.instrumentErrorNote}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </Panel>
        );
      case 'table': {
        const ds = experiment.datasets.find((d) => d.id === block.tableId);
        if (!ds) return null;
        const cols: GridColumn[] = ds.columns.map((c) => ({
          id: c.id, header: c.header, unit: c.unit, kind: c.kind,
          expression: c.expression, formulaLatex: c.formulaLatex, decimals: c.decimals,
        }));
        const rows = project.tables[ds.id] ?? Array.from({ length: ds.defaultRows ?? 8 }, () => ds.columns.map(() => ''));
        return (
          <Panel title={ds.title} sub={ds.hint}>
            <DataGrid
              columns={cols}
              rows={rows}
              derivedScope={paramScope}
              excludedRows={project.excludedRows[ds.id] ?? []}
              onToggleExclude={(r) => updateProject((p) => {
                const cur = p.excludedRows[ds.id] ?? [];
                p.excludedRows[ds.id] = cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r];
                p.auditLog.push({ at: new Date().toISOString(), action: cur.includes(r) ? '恢复行' : '排除行', detail: `${ds.title} 第 ${r + 1} 行` });
              })}
              onChange={(newRows) => updateProject((p) => { p.tables[ds.id] = newRows; })}
              defaultRows={ds.defaultRows ?? 8}
              title=""
            />
            <div className="small muted" style={{ marginTop: 6 }}>点击行号排除/恢复该行（写入审计日志，绝不自动删除数据）。</div>
          </Panel>
        );
      }
      case 'fits':
        return (
          <div className="stack">
            {block.fitIds.map((fid) => {
              const fit = computation?.fits[fid];
              const spec = experiment.fits.find((f) => f.id === fid);
              if (!fit || !spec || ('error' in fit)) {
                return (
                  <Panel key={fid} title={spec?.title ?? fid}>
                    <div className="field-help">{fit && 'error' in fit ? fit.error : '数据不足或存在非法输入'}</div>
                  </Panel>
                );
              }
              const ols = fit.ols;
              const org = fit.origin;
              return (
                <Panel key={fid} title={spec.title} sub={ols ? `n=${ols.n}，ν=${ols.dof}` : org ? `n=${org.n}，ν=${org.dof}` : ''}>
                  <Tex tex={spec.modelLatex} display />
                  {ols ? (
                    <table className="contrib-table" style={{ marginTop: 8 }}>
                      <tbody>
                        <tr><td>截距 a</td><td className="num">{ols.a.toPrecision(8)}</td><td>斜率 b</td><td className="num">{ols.b.toPrecision(8)}</td></tr>
                        <tr><td>相关系数 r</td><td className="num">{ols.r.toPrecision(6)}</td><td>t 因子</td><td className="num">{ols.t.toPrecision(6)}</td></tr>
                        <tr><td>Sa</td><td className="num">{ols.sa.toPrecision(8)}</td><td>Sb</td><td className="num">{ols.sb.toPrecision(8)}</td></tr>
                        <tr><td>Δa = t·Sa</td><td className="num">{ols.deltaA.toPrecision(8)}</td><td>Δb = t·Sb</td><td className="num">{ols.deltaB.toPrecision(8)}</td></tr>
                        <tr><td>SSE</td><td className="num">{ols.sse.toPrecision(8)}</td><td>S</td><td className="num">{ols.s.toPrecision(8)}</td></tr>
                      </tbody>
                    </table>
                  ) : org ? (
                    <table className="contrib-table" style={{ marginTop: 8 }}>
                      <tbody>
                        <tr><td>斜率 b</td><td className="num">{org.b.toPrecision(8)}</td><td>R²</td><td className="num">{org.r2.toPrecision(6)}</td></tr>
                        <tr><td>Sb</td><td className="num">{org.sb.toPrecision(8)}</td><td>Δb = t·Sb</td><td className="num">{org.deltaB.toPrecision(8)}</td></tr>
                      </tbody>
                    </table>
                  ) : null}
                  <div className="small muted" style={{ marginTop: 6 }}>课程模式首先显示 r；R² 为工程扩展指标。</div>
                </Panel>
              );
            })}
          </div>
        );
      case 'plot': {
        const spec = experiment.plots.find((p) => p.id === block.plotId);
        if (!spec) return null;
        const ds = experiment.datasets.find((d) => d.id === spec.tableId);
        if (!ds) return null;
        const parsed = parseTable(ds, { params: project.params, tables: project.tables, excludedRows: project.excludedRows }, paramScope);
        const points = parsed.rows
          .map((r) => ({ x: r[spec.xCol], y: r[spec.yCol] }))
          .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
        const series: PlotSeries[] = [{ name: '数据点', points, type: 'scatter' }];
        if (spec.fitId) {
          const fitRaw = computation?.fits[spec.fitId];
          const fit = fitRaw && 'spec' in fitRaw ? fitRaw : undefined;
          if (fit && fit.ols && points.length > 1) {
            const xs = points.map((p) => p.x);
            const min = Math.min(...xs);
            const max = Math.max(...xs);
            const pad = (max - min) * 0.05 || 1;
            series.push({
              name: spec.fitLabel ?? '拟合线', type: 'line', dashed: true, showSymbol: false,
              points: [min - pad, max + pad].map((x) => ({ x, y: fit.ols!.a + fit.ols!.b * x })),
            });
          } else if (fit && fit.origin && points.length > 1) {
            const xs = points.map((p) => p.x);
            const min = Math.min(...xs);
            const max = Math.max(...xs);
            series.push({
              name: spec.fitLabel ?? '拟合线（过原点）', type: 'line', dashed: true, showSymbol: false,
              points: [Math.min(0, min), max * 1.05].map((x) => ({ x, y: fit.origin!.b * x })),
            });
          }
        }
        return (
          <Panel title={spec.title}>
            {points.length === 0 ? (
              <div className="empty-state"><div className="empty-title">暂无有效数据点</div><div className="small">填写数据后将自动生成图表。</div></div>
            ) : (
              <>
                <PhysicsPlot title={spec.title} xLabel={spec.xLabel} yLabel={spec.yLabel} series={series} />
                <PlotChecklist title={spec.title} xLabel={spec.xLabel} yLabel={spec.yLabel} series={series} />
              </>
            )}
          </Panel>
        );
      }
      case 'results': {
        const items = results.filter((r) => block.resultIds.includes(r.id));
        const missing = block.resultIds.filter((id) => !results.some((r) => r.id === id));
        return (
          <div className="stack">
            {block.title && <Panel title={block.title}><div /></Panel>}
            {items.map((item) => <ResultCard key={item.id} item={item} profileName={profile.shortName} />)}
            {missing.length > 0 && (
              <Panel title="待计算">
                <div className="field-help">缺少所需数据或参数：{missing.join('、')}</div>
              </Panel>
            )}
          </div>
        );
      }
      case 'note':
        return <div className="notice notice-info"><div className="n-body">{block.text}</div></div>;
      case 'custom':
        if (block.component === 'forced-plots') {
          return <ForcedPlotsBlock series={computation?.custom['forced-series'] as never} />;
        }
        if (block.component === 'quasi-diagnostics') {
          return <QuasiDiagnosticsBlock data={computation?.custom['quasi'] as never} />;
        }
        if (block.component === 'michelson-checklist') {
          return <MichelsonChecklistBlock />;
        }
        return null;
      default:
        return null;
    }
  };

  const mdExport = computation
    ? buildDataProcessingMarkdown(project, experiment, computation, profile, settings.mathStyle)
    : '';

  return (
    <AppShell
      topbar={
        <>
          <button className="btn btn-sm" onClick={() => navigate('/projects')}>返回项目</button>
          <span className="title">{project.title}</span>
          <Badge variant="default">{experiment.title}</Badge>
          <StandardProfileBadge />
          <span className={`save-dot ${saveState}`} title={saveState === 'saved' ? '已保存（本浏览器）' : saveState === 'saving' ? '保存中…' : '保存失败'} />\n          <span className="save-label">{saveState === 'saved' ? '已保存' : saveState === 'saving' ? '保存中…' : '保存失败'}</span>
          <button className="btn btn-sm" onClick={() => setInspectorOpen((v) => !v)}>{inspectorOpen ? '隐藏结果' : '显示结果'}</button>
          <button className="btn btn-sm btn-primary" onClick={() => setExportOpen(true)}>导出</button>
        </>
      }
    >
      <div className={inspectorOpen ? '' : 'inspector-collapsed'}>
        <div className="workbench">
          <nav className="workbench-steps" aria-label="实验步骤">
            {experiment.steps.map((s, i) => (
              <button
                key={s.id}
                className={`step-item${i === stepIdx ? ' active' : ''}`}
                onClick={() => setStepIdx(i)}
              >
                <span className="num">{i + 1}</span>
                <span>{s.title}</span>
              </button>
            ))}
          </nav>
          <main className="workbench-main">
            {migrationNote && (
              <div className="notice notice-warning" style={{ marginBottom: 12 }}>
                <span className="n-icon">⚠</span>
                <div className="n-body">{migrationNote}<button className="btn btn-sm btn-ghost" onClick={() => setMigrationNote(null)}>知道了</button></div>
              </div>
            )}
            {step?.id === experiment.steps[0].id && experiment.metadataFields.length > 0 && (
              <Panel title="实验信息">
                <div className="form-grid">
                  {experiment.metadataFields.map((f) => (
                    <div key={f.id}>
                      <div className="field-label">{f.label}</div>
                      <input
                        className="input"
                        value={project.metadata[f.id] ?? ''}
                        onChange={(e) => updateProject((p) => { p.metadata[f.id] = e.target.value; })}
                      />
                    </div>
                  ))}
                </div>
              </Panel>
            )}
            <h2>{stepIdx + 1}. {step?.title}</h2>
            <div className="stack">{step?.blocks.map((b, i) => <div key={i}>{renderBlock(b)}</div>)}</div>
          </main>
          <aside className="workbench-inspector" aria-label="结果检查器">
            <div className="panel-title">结果检查器
              <span className="spacer" style={{ flex: 1 }} />
              <button className="btn btn-sm btn-ghost inspector-toggle" onClick={() => setInspectorOpen(false)}>收起</button>
            </div>
            {computation && computation.diagnostics.length > 0 && (
              <div className="notice notice-warning">
                <span className="n-icon">⚠</span>
                <div className="n-body">
                  <div className="n-title">数据诊断</div>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>{computation.diagnostics.map((d, i) => <li key={i}>{d}</li>)}</ul>
                </div>
              </div>
            )}
            {results.length === 0 ? (
              <div className="empty-state"><div className="empty-title">等待计算结果</div><div className="small">填写当前步骤所需数据后，结果会在这里出现。</div></div>
            ) : (
              results.map((item) => <ResultCard key={item.id} item={item} profileName={profile.shortName} />)
            )}
          </aside>
        </div>
      </div>

      <Modal open={exportOpen} onClose={() => setExportOpen(false)} title="导出" wide>
        <div className="stack">
          <Panel title="数据处理报告（Markdown）">
            <div className="row">
              <CopyButton text={() => mdExport} label="复制 Markdown" />
              <button
                className="btn btn-sm"
                onClick={() => download(new Blob([mdExport], { type: 'text/markdown' }), `${project.title}-数据处理.md`)}
              >下载 .md</button>
            </div>
            <pre style={{ maxHeight: 260, overflow: 'auto', fontSize: 12 }}>{mdExport.slice(0, 4000)}{mdExport.length > 4000 ? '\n…（完整内容请下载）' : ''}</pre>
          </Panel>
          <Panel title="最终结果（LaTeX）">
            <div className="row">
              <CopyButton text={() => computation ? buildResultLatex(computation) : ''} label="复制 LaTeX" />
            </div>
            <pre style={{ maxHeight: 160, overflow: 'auto', fontSize: 12 }}>{computation ? buildResultLatex(computation) : '—'}</pre>
          </Panel>
          <Panel title="表格 CSV / 项目 JSON">
            <div className="row">
              {experiment.datasets.map((ds) => (
                <button
                  key={ds.id}
                  className="btn btn-sm"
                  onClick={() => download(new Blob(['\ufeff' + tableToCSV(ds, project)], { type: 'text/csv' }), `${ds.id}.csv`)}
                >{ds.title} CSV</button>
              ))}
              <button
                className="btn btn-sm"
                onClick={() => download(new Blob([serializeProject(project)], { type: 'application/json' }), `${project.title}.json`)}
              >项目 JSON</button>
            </div>
            <div className="small muted" style={{ marginTop: 6 }}>导出可选附带标准 profile、公式来源、修约规则与软件版本（Markdown 首部已包含）。</div>
          </Panel>
        </div>
      </Modal>
    </AppShell>
  );
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.replace(/[\\/:*?"<>|]/g, '_');
  a.click();
  URL.revokeObjectURL(url);
  toast('已开始下载');
}
