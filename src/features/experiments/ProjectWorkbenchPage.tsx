/**
 * ProjectWorkbenchPage — 实验工作台三栏布局（plan §4.2）。
 * 步骤导航（StepNav） | 主工作区（数据表/图/表单） | 唯一可折叠结果检查器。
 * 自动保存到 IndexedDB（debounce 800ms，尊重 autosave 开关）；导出对话框；行排除审计。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getProject, saveProject, StoredProject } from '../../persistence/db';
import { getExperiment } from '../../experiments';
import { ExperimentState, StepBlock } from '../../experiments/types';
import { parseTable } from '../../experiments/engine';
import { useSettings } from '../../stores/settings';
import { AppShell } from '../../app/shell/AppShell';
import { StepNav } from '../../app/shell/StepNav';
import { StandardProfileBadge } from '../../components/StandardProfileBadge';
import { DataGrid, GridColumn } from '../../components/DataGrid';
import { PhysicsPlot, PlotSeries, PlotChecklist } from '../../components/PhysicsPlot';
import { ResultCard, ResultInspector } from '../../components/ResultInspector';
import {
  Badge, Button, CopyButton, EmptyState, Field, FormulaBlock, Modal, Notice, Panel, SafetyNotice, Tabs, toast,
} from '../../components/ui';
import { Tex } from '../../components/katex';
import { buildDataProcessingMarkdown, buildResultLatex, tableToCSV, serializeProject } from '../../export';
import { ForcedPlotsBlock, QuasiDiagnosticsBlock, MichelsonChecklistBlock } from './custom-blocks';
import { MarkdownBlock, MarkdownInline, MarkdownList } from '../../components/Markdown';

type SaveState = 'saved' | 'saving' | 'dirty' | 'error';

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
  const [exportTab, setExportTab] = useState<'md' | 'latex' | 'data'>('md');
  const [saveState, setSaveState] = useState<SaveState>('saved');
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

  // 自动保存（防抖 800ms）；autosave 关闭时只标记 dirty，由「立即保存」手动落盘
  const scheduleSave = useCallback((p: StoredProject) => {
    if (!settings.autosave) { setSaveState('dirty'); return; }
    setSaveState('saving');
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      saveProject(p)
        .then(() => setSaveState('saved'))
        .catch(() => setSaveState('error'));
    }, 800);
  }, [settings.autosave]);

  const saveNow = useCallback(() => {
    if (!project) return;
    window.clearTimeout(saveTimer.current);
    setSaveState('saving');
    saveProject(project)
      .then(() => setSaveState('saved'))
      .catch(() => setSaveState('error'));
  }, [project]);

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
        <EmptyState title="项目加载失败" hint={loadError}>
          <Button onClick={() => navigate('/projects')}>返回项目列表</Button>
        </EmptyState>
      </AppShell>
    );
  }
  if (project && !experiment) {
    return (
      <AppShell>
        <EmptyState title="实验定义不存在" hint={`找不到实验 \`${project.experimentId ?? ''}\` 的定义，可能来自更新的软件版本。`}>
          <Button onClick={() => navigate('/projects')}>返回项目列表</Button>
        </EmptyState>
      </AppShell>
    );
  }
  if (!project || !experiment) {
    return (
      <AppShell>
        <EmptyState title="加载中…" hint="正在从本浏览器读取项目数据。" />
      </AppShell>
    );
  }

  const paramScope: Record<string, number> = {};
  for (const [k, v] of Object.entries(project.params)) {
    const n = Number(v);
    if (Number.isFinite(n)) paramScope[k] = n;
  }

  const renderBlock = (block: StepBlock) => {
    switch (block.type) {
      case 'safety':
        return settings.showSafety ? <SafetyNotice items={block.items} /> : null;
      case 'params':
        return (
          <Panel title={block.title ?? '参数'}>
            <div className="form-grid">
              {block.fields.map((fid) => {
                const field = experiment.params.find((p) => p.id === fid);
                if (!field) return null;
                return (
                  <Field key={fid} label={field.label} hint={field.hint}>
                    <div className="input-unit">
                      <input
                        className="input"
                        value={project.params[fid] ?? ''}
                        placeholder={field.defaultText ?? ''}
                        inputMode={field.kind === 'text' ? 'text' : 'decimal'}
                        onChange={(e) => updateProject((p) => { p.params[fid] = e.target.value; })}
                      />
                      {field.unit && <span className="unit-chip"><MarkdownInline>{field.unit}</MarkdownInline></span>}
                    </div>
                    {field.instrumentErrorNote && (
                      <div className="field-help" style={{ color: 'var(--warning)' }}><MarkdownInline>{field.instrumentErrorNote}</MarkdownInline></div>
                    )}
                  </Field>
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
              hint="点击行号排除/恢复该行（写入审计日志，绝不自动删除数据）。"
            />
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
                    <Notice variant="warning">
                      <MarkdownInline>{fit && 'error' in fit ? fit.error : '数据不足或存在非法输入'}</MarkdownInline>
                    </Notice>
                  </Panel>
                );
              }
              const ols = fit.ols;
              const org = fit.origin;
              return (
                <Panel
                  key={fid}
                  title={spec.title}
                  sub={ols ? `$n=${ols.n}$，$\\nu=${ols.dof}$` : org ? `$n=${org.n}$，$\\nu=${org.dof}$` : ''}
                >
                  <FormulaBlock latex={spec.modelLatex} />
                  {ols ? (
                    <table className="stat-table" style={{ marginTop: 8 }}>
                      <tbody>
                        <tr><th><Tex tex="a" /></th><td className="num">{ols.a.toPrecision(8)}</td><th><Tex tex="b" /></th><td className="num">{ols.b.toPrecision(8)}</td></tr>
                        <tr><th><Tex tex="r" /></th><td className="num">{ols.r.toPrecision(6)}</td><th><Tex tex="t" /></th><td className="num">{ols.t.toPrecision(6)}</td></tr>
                        <tr><th><Tex tex="S_a" /></th><td className="num">{ols.sa.toPrecision(8)}</td><th><Tex tex="S_b" /></th><td className="num">{ols.sb.toPrecision(8)}</td></tr>
                        <tr><th><Tex tex="\Delta a = t\,S_a" /></th><td className="num">{ols.deltaA.toPrecision(8)}</td><th><Tex tex="\Delta b = t\,S_b" /></th><td className="num">{ols.deltaB.toPrecision(8)}</td></tr>
                        <tr><th><Tex tex="\mathrm{SSE}" /></th><td className="num">{ols.sse.toPrecision(8)}</td><th><Tex tex="S" /></th><td className="num">{ols.s.toPrecision(8)}</td></tr>
                      </tbody>
                    </table>
                  ) : org ? (
                    <table className="stat-table" style={{ marginTop: 8 }}>
                      <tbody>
                        <tr><th><Tex tex="b" /></th><td className="num">{org.b.toPrecision(8)}</td><th><Tex tex="R^2" /></th><td className="num">{org.r2.toPrecision(6)}</td></tr>
                        <tr><th><Tex tex="S_b" /></th><td className="num">{org.sb.toPrecision(8)}</td><th><Tex tex="\Delta b = t\,S_b" /></th><td className="num">{org.deltaB.toPrecision(8)}</td></tr>
                      </tbody>
                    </table>
                  ) : null}
                  <div className="small muted" style={{ marginTop: 6 }}><MarkdownInline>课程模式首先显示 $r$；$R^2$ 为工程扩展指标。</MarkdownInline></div>
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
              <EmptyState title="暂无有效数据点" hint="填写数据后将自动生成图表。" />
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
        const content = (
          <div className="stack">
            {items.map((item) => <ResultCard key={item.id} item={item} profileName={profile.shortName} />)}
            {missing.length > 0 && (
              <EmptyState title="待计算" hint={`缺少所需数据或参数：${missing.join('、')}`} />
            )}
          </div>
        );
        return block.title ? <Panel title={block.title}>{content}</Panel> : content;
      }
      case 'note':
        return (
          <Notice variant="info">
            <MarkdownBlock>{block.text}</MarkdownBlock>
          </Notice>
        );
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

  const saveLabel =
    (saveState === 'saved' ? '已保存'
      : saveState === 'saving' ? '保存中…'
      : saveState === 'dirty' ? '未保存'
      : '保存失败') + (settings.autosave ? '' : '（手动）');
  const saveTitle =
    saveState === 'saved' ? '已保存（本浏览器）'
      : saveState === 'saving' ? '保存中…'
      : saveState === 'dirty' ? '有未保存的更改（自动保存已关闭）'
      : '保存失败';

  return (
    <AppShell
      wide
      topbar={
        <>
          <Button variant="ghost" size="sm" onClick={() => navigate('/projects')}>返回项目</Button>
          <span className="topbar-title"><MarkdownInline>{project.title}</MarkdownInline></span>
          <Badge variant="default">{experiment.title}</Badge>
          <StandardProfileBadge />
          <span className={`save-state ${saveState}`} title={saveTitle}>
            <span className="save-dot" />
            <MarkdownInline>{saveLabel}</MarkdownInline>
          </span>
          {!settings.autosave && (
            <Button variant="ghost" size="sm" onClick={saveNow}>立即保存</Button>
          )}
          <span className="spacer" />
          <Button size="sm" onClick={() => setInspectorOpen((v) => !v)}>{inspectorOpen ? '隐藏结果' : '显示结果'}</Button>
          <Button variant="primary" size="sm" onClick={() => setExportOpen(true)}>导出</Button>
        </>
      }
    >
      <div className={`workbench${inspectorOpen ? '' : ' inspector-hidden'}`}>
        <div className="wb-steps">
          <StepNav
            steps={experiment.steps.map((s) => ({ id: s.id, title: s.title }))}
            currentId={step?.id ?? ''}
            onSelect={(id) => {
              const i = experiment.steps.findIndex((s) => s.id === id);
              if (i >= 0) setStepIdx(i);
            }}
          />
        </div>
        <div className="wb-main">
          {migrationNote && (
            <Notice variant="warning" title="版本提示">
              <MarkdownBlock>{migrationNote}</MarkdownBlock>
              <div className="row" style={{ marginTop: 8 }}>
                <Button size="sm" variant="ghost" onClick={() => setMigrationNote(null)}>知道了</Button>
              </div>
            </Notice>
          )}
          {step?.id === experiment.steps[0].id && experiment.metadataFields.length > 0 && (
            <Panel title="实验信息">
              <div className="form-grid">
                {experiment.metadataFields.map((f) => (
                  <Field key={f.id} label={f.label} hint={f.hint}>
                    <input
                      className="input"
                      value={project.metadata[f.id] ?? ''}
                      placeholder={f.defaultText ?? ''}
                      onChange={(e) => updateProject((p) => { p.metadata[f.id] = e.target.value; })}
                    />
                  </Field>
                ))}
              </div>
            </Panel>
          )}
          <h2><MarkdownInline>{`${stepIdx + 1}. ${step?.title ?? ''}`}</MarkdownInline></h2>
          <div className="stack">{step?.blocks.map((b, i) => <div key={i}>{renderBlock(b)}</div>)}</div>
          {settings.showDiagnostics && computation && computation.diagnostics.length > 0 && (
            <Notice variant="info" title="数据诊断（客观提示）">
              <MarkdownList items={computation.diagnostics} />
            </Notice>
          )}
        </div>
        {inspectorOpen && (
          <aside className="wb-inspector" aria-label="结果检查器">
            <Panel
              title="结果检查器"
              actions={<Button size="sm" variant="ghost" onClick={() => setInspectorOpen(false)}>收起</Button>}
            >
              <ResultInspector results={results} profileName={profile.shortName} />
            </Panel>
          </aside>
        )}
      </div>

      <Modal open={exportOpen} onClose={() => setExportOpen(false)} title="导出" wide>
        <div className="stack">
          <Tabs
            tabs={[
              { id: 'md', label: '数据处理 Markdown' },
              { id: 'latex', label: '结果 LaTeX' },
              { id: 'data', label: '表格 CSV / 项目 JSON' },
            ]}
            active={exportTab}
            onChange={(id) => setExportTab(id as 'md' | 'latex' | 'data')}
            ariaLabel="导出内容"
          />
          {exportTab === 'md' && (
            <>
              <div className="row">
                <CopyButton text={() => mdExport} label="复制 Markdown" />
                <Button size="sm" onClick={() => download(new Blob([mdExport], { type: 'text/markdown' }), `${project.title}-数据处理.md`)}>下载 .md</Button>
              </div>
              <pre style={{ maxHeight: 260, overflow: 'auto', fontSize: 12 }}>{mdExport.slice(0, 4000)}{mdExport.length > 4000 ? '\n…（完整内容请下载）' : ''}</pre>
            </>
          )}
          {exportTab === 'latex' && (
            <>
              <div className="row">
                <CopyButton text={() => computation ? buildResultLatex(computation) : ''} label="复制 LaTeX" />
              </div>
              <pre style={{ maxHeight: 260, overflow: 'auto', fontSize: 12 }}>{computation ? buildResultLatex(computation) : '—'}</pre>
            </>
          )}
          {exportTab === 'data' && (
            <>
              <div className="row wrap">
                {experiment.datasets.map((ds) => (
                  <Button
                    key={ds.id}
                    size="sm"
                    onClick={() => download(new Blob(['\ufeff' + tableToCSV(ds, project)], { type: 'text/csv' }), `${ds.id}.csv`)}
                  >{`${ds.title} CSV`}</Button>
                ))}
                <Button
                  size="sm"
                  onClick={() => download(new Blob([serializeProject(project)], { type: 'application/json' }), `${project.title}.json`)}
                >项目 JSON</Button>
              </div>
              <div className="small muted"><MarkdownInline>导出附带标准 `profile`、公式来源、修约规则与软件版本（Markdown 首部已包含）。</MarkdownInline></div>
            </>
          )}
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
