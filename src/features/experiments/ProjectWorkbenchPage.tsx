/**
 * ProjectWorkbenchPage — 实验工作台三栏布局（plan §4.2）。
 * 步骤导航（StepNav） | 主工作区（数据表/图/表单） | 唯一可折叠结果检查器。
 * 自动保存到 IndexedDB（debounce 800ms，尊重 autosave 开关）；导出对话框；行排除审计。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getProject, saveProject, StoredProject } from '../../persistence/db';
import { getExperiment } from '../../experiments';
import { ExperimentComputation, ExperimentState, StepBlock } from '../../experiments/types';
import { parseTable, stepStatuses } from '../../experiments/engine';
import { parseNumericText } from '../../core/numeric';
import { fitParameterDisplay } from '../../core/sigfig';
import { fmtDisplay } from '../tools/fmt';
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
import { buildDataProcessingMarkdown, tableToCSV, serializeProject } from '../../export';
import { buildFullReportLatex, buildFullReportMarkdown } from '../../export/report';
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
  const [exportTab, setExportTab] = useState<'report-md' | 'report-latex' | 'md' | 'data'>('report-md');
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

  // 版本迁移提示（plan §13）：只提示，确认后才把版本标记写入项目（落盘可追溯）
  const [migration, setMigration] = useState<{ note: string; versionBump: boolean } | null>(null);
  const dismissedNote = useRef<string | null>(null);
  useEffect(() => {
    if (!project || !experiment) return;
    let next: { note: string; versionBump: boolean } | null = null;
    if (project.experimentVersion !== undefined && project.experimentVersion < experiment.version) {
      next = {
        note: `实验定义已从 v${project.experimentVersion} 升级到 v${experiment.version}，旧数据按新定义解释前请核对；核对无误后点击下方按钮把版本标记写入项目。`,
        versionBump: true,
      };
    } else if (project.standardProfileId !== profile.id) {
      next = {
        note: `项目标准（${project.standardProfileId}）与当前全局标准（${profile.id}）不同。项目按保存时的标准计算，可在设置切换。`,
        versionBump: false,
      };
    }
    if (next && dismissedNote.current === next.note) return;
    setMigration(next);
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

  // 计算管线：失败时保留上次成功结果并给出醒目错误（绝不用 NaN 冒充结果，也不静默清空）
  const [computation, setComputation] = useState<ExperimentComputation | null>(null);
  const [computeError, setComputeError] = useState<string | null>(null);
  const lastComputeErr = useRef<string | null>(null);
  useEffect(() => {
    if (!project || !experiment) return;
    const state: ExperimentState = {
      params: project.params,
      tables: project.tables,
      excludedRows: project.excludedRows,
    };
    try {
      setComputation(experiment.compute(state, profile));
      setComputeError(null);
      lastComputeErr.current = null;
    } catch (err) {
      const msg = (err as Error).message;
      setComputeError(msg);
      if (lastComputeErr.current !== msg) {
        toast(`计算失败：${msg}`);
        lastComputeErr.current = msg;
      }
    }
  }, [project, experiment, profile]);

  // 步骤完成度（done/todo/attention）驱动 stepper 状态点与顶栏进度
  const statuses = useMemo(() => {
    if (!project || !experiment) return {};
    const state: ExperimentState = {
      params: project.params,
      tables: project.tables,
      excludedRows: project.excludedRows,
    };
    return stepStatuses(experiment, state, computation);
  }, [experiment, project, computation]);

  // 首次产生结果时自动展开一次检查器（之后完全由用户控制）
  const autoOpenedInspector = useRef(false);
  useEffect(() => {
    if (autoOpenedInspector.current) return;
    if (computation && computation.results.length > 0) {
      autoOpenedInspector.current = true;
      setInspectorOpen(true);
    }
  }, [computation]);

  // 手动保存模式下存在未保存更改时，关闭/刷新页面前提示
  useEffect(() => {
    if (saveState !== 'dirty') return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [saveState]);

  const step = experiment?.steps[stepIdx];
  const results = computation?.results ?? [];
  const warnCount = results.reduce((s, r) => s + (r.warnings?.length ?? 0), 0);
  const doneSteps = experiment ? experiment.steps.filter((s) => statuses[s.id] === 'done').length : 0;

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
                const raw = project.params[fid] ?? '';
                const parsedNum = raw.trim() === '' ? null : parseNumericText(raw);
                const invalid = field.kind !== 'text' && parsedNum !== null && !parsedNum.ok;
                return (
                  <Field key={fid} label={field.label} hint={field.hint} error={invalid && parsedNum && !parsedNum.ok ? parsedNum.error : undefined}>
                    <div className="input-unit">
                      <input
                        className={`input${invalid ? ' invalid' : ''}`}
                        value={raw}
                        placeholder={field.defaultText ?? ''}
                        inputMode={field.kind === 'text' ? 'text' : 'decimal'}
                        aria-invalid={invalid || undefined}
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
              // 课程修约表达（绪论课规则：a 末位与 yi 取齐、b 与 xi 有效位一致）
              let courseText: string | null = null;
              if (ols) {
                const ds = experiment.datasets.find((d) => d.id === spec.tableId);
                if (ds) {
                  const parsed = parseTable(ds, { params: project.params, tables: project.tables, excludedRows: project.excludedRows }, paramScope);
                  const rawXs = parsed.rawRows.map((r) => r[spec.xCol] ?? '');
                  const rawYs = parsed.rawRows.map((r) => r[spec.yCol] ?? '');
                  const disp = fitParameterDisplay(ols.a, ols.b, rawXs, rawYs);
                  courseText = `a = ${disp.aText}，b = ${disp.bText}，r = ${fmtDisplay(ols.r, 4)}`;
                }
              }
              return (
                <Panel
                  key={fid}
                  title={spec.title}
                  sub={ols ? `$n=${ols.n}$，$\\nu=${ols.dof}$` : org ? `$n=${org.n}$，$\\nu=${org.dof}$` : ''}
                  actions={ols || org ? (
                    <CopyButton
                      label="复制拟合结果"
                      text={courseText
                        ? `${spec.title}：y = a + bx，${courseText}`
                        : `${spec.title}：y = bx，b = ${fmtDisplay(org!.b)}，Δb = ${fmtDisplay(org!.deltaB)}`}
                    />
                  ) : undefined}
                >
                  <FormulaBlock latex={spec.modelLatex} />
                  {ols ? (
                    <table className="stat-table" style={{ marginTop: 8 }}>
                      <tbody>
                        <tr><th><Tex tex="a" /></th><td className="num">{fmtDisplay(ols.a, 8)}</td><th><Tex tex="b" /></th><td className="num">{fmtDisplay(ols.b, 8)}</td></tr>
                        <tr><th><Tex tex="r" /></th><td className="num">{fmtDisplay(ols.r, 8)}</td><th><Tex tex="t" /></th><td className="num">{fmtDisplay(ols.t)}</td></tr>
                        <tr><th><Tex tex="S_a" /></th><td className="num">{fmtDisplay(ols.sa, 8)}</td><th><Tex tex="S_b" /></th><td className="num">{fmtDisplay(ols.sb, 8)}</td></tr>
                        <tr><th><Tex tex="\Delta a = t\,S_a" /></th><td className="num">{fmtDisplay(ols.deltaA, 8)}</td><th><Tex tex="\Delta b = t\,S_b" /></th><td className="num">{fmtDisplay(ols.deltaB, 8)}</td></tr>
                        <tr><th><Tex tex="\mathrm{SSE}" /></th><td className="num">{fmtDisplay(ols.sse, 8)}</td><th><Tex tex="S" /></th><td className="num">{fmtDisplay(ols.s, 8)}</td></tr>
                      </tbody>
                    </table>
                  ) : org ? (
                    <table className="stat-table" style={{ marginTop: 8 }}>
                      <tbody>
                        <tr><th><Tex tex="b" /></th><td className="num">{fmtDisplay(org.b, 8)}</td><th><Tex tex="R^2" /></th><td className="num">{fmtDisplay(org.r2, 8)}</td></tr>
                        <tr><th><Tex tex="S_b" /></th><td className="num">{fmtDisplay(org.sb, 8)}</td><th><Tex tex="\Delta b = t\,S_b" /></th><td className="num">{fmtDisplay(org.deltaB, 8)}</td></tr>
                      </tbody>
                    </table>
                  ) : null}
                  {courseText && (
                    <div className="small" style={{ marginTop: 8 }}>
                      <MarkdownInline>{`**课程修约表达：**${courseText}`}</MarkdownInline>
                    </div>
                  )}
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
        const annotations: { text: string }[] = [];
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
            annotations.push(
              { text: `y = ${fmtDisplay(fit.ols.a, 4)} + ${fmtDisplay(fit.ols.b, 4)}·x` },
              { text: `r = ${fmtDisplay(fit.ols.r, 5)}` },
            );
          } else if (fit && fit.origin && points.length > 1) {
            const xs = points.map((p) => p.x);
            const min = Math.min(...xs);
            const max = Math.max(...xs);
            series.push({
              name: spec.fitLabel ?? '拟合线（过原点）', type: 'line', dashed: true, showSymbol: false,
              points: [Math.min(0, min), max * 1.05].map((x) => ({ x, y: fit.origin!.b * x })),
            });
            annotations.push({ text: `y = ${fmtDisplay(fit.origin.b, 4)}·x` });
          }
        }
        return (
          <Panel title={spec.title}>
            {points.length === 0 ? (
              <EmptyState icon="chart" title="暂无有效数据点" hint="填写数据后将自动生成图表。" />
            ) : (
              <>
                <PhysicsPlot title={spec.title} xLabel={spec.xLabel} yLabel={spec.yLabel} series={series} annotations={annotations.length > 0 ? annotations : undefined} />
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
              <EmptyState
                icon="target"
                title={`还有 ${missing.length} 项结果待生成`}
                hint={settings.expertMode
                  ? `补齐本步骤数据后自动生成（内部 id：${missing.join('、')}）`
                  : '补齐本步骤的数据与参数后，结果会自动出现在这里'}
              />
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
  const reportMd = computation
    ? buildFullReportMarkdown(project, experiment, computation, profile, { mathStyle: settings.mathStyle })
    : '';
  const reportTex = computation
    ? buildFullReportLatex(project, experiment, computation, profile)
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
          <Button variant="ghost" size="sm" icon="arrow-left" onClick={() => navigate('/projects')}>返回项目</Button>
          <span className="topbar-title"><MarkdownInline>{project.title}</MarkdownInline></span>
          <Badge variant="default">{experiment.title}</Badge>
          <StandardProfileBadge />
          <span className="topbar-progress" title={`步骤完成度：${doneSteps}/${experiment.steps.length} 步已就绪`}>
            <MarkdownInline>{`第 ${stepIdx + 1}/${experiment.steps.length} 步`}</MarkdownInline>
            <span className="progress-track" style={{ width: 72 }}>
              <span className="progress-fill" style={{ width: `${Math.round((doneSteps / experiment.steps.length) * 100)}%`, display: 'block' }} />
            </span>
          </span>
          <span className={`save-state ${saveState}`} title={saveTitle}>
            <span className="save-dot" />
            <MarkdownInline>{saveLabel}</MarkdownInline>
          </span>
          {!settings.autosave && (
            <Button variant="ghost" size="sm" onClick={saveNow}>立即保存</Button>
          )}
          <span className="spacer" />
          <Button size="sm" icon="panel-left" onClick={() => setInspectorOpen((v) => !v)}>
            {inspectorOpen ? '隐藏结果' : `结果 ${results.length}${warnCount > 0 ? ` · 警告 ${warnCount}` : ''}`}
          </Button>
          <Button variant="primary" size="sm" icon="download" onClick={() => setExportOpen(true)}>导出</Button>
        </>
      }
    >
      <div className={`workbench${inspectorOpen ? '' : ' inspector-hidden'}`}>
        <div className="wb-steps">
          <StepNav
            steps={experiment.steps.map((s) => ({ id: s.id, title: s.title, status: statuses[s.id] }))}
            currentId={step?.id ?? ''}
            onSelect={(id) => {
              const i = experiment.steps.findIndex((s) => s.id === id);
              if (i >= 0) setStepIdx(i);
            }}
          />
        </div>
        <div className="wb-main">
          {migration && (
            <Notice variant="warning" title="版本提示">
              <MarkdownBlock>{migration.note}</MarkdownBlock>
              <div className="row" style={{ marginTop: 8 }}>
                {migration.versionBump && (
                  <Button
                    size="sm"
                    onClick={() => {
                      updateProject((p) => { p.experimentVersion = experiment.version; });
                      dismissedNote.current = migration.note;
                      setMigration(null);
                      toast('已把实验定义版本写入项目');
                    }}
                  >已核对，标记为新版本</Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    dismissedNote.current = migration.note;
                    setMigration(null);
                  }}
                >知道了</Button>
              </div>
            </Notice>
          )}
          {computeError && (
            <Notice variant="danger" title="计算管线出错">
              <MarkdownBlock>{`最近一次计算失败：${computeError}。${computation ? '下方显示的是**上一次成功**的结果，请修正标红的输入后再看结果。' : '请检查标红的输入单元格与参数。'}`}</MarkdownBlock>
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
          <div className="step-pager">
            <Button
              variant="ghost"
              icon="arrow-left"
              disabled={stepIdx === 0}
              onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
            >上一步</Button>
            <span className="small muted">
              <MarkdownInline>{
                statuses[step?.id ?? ''] === 'done' ? '本步骤已就绪'
                  : statuses[step?.id ?? ''] === 'attention' ? '本步骤有需要处理的问题'
                  : '本步骤待完成'
              }</MarkdownInline>
            </span>
            {stepIdx < experiment.steps.length - 1 ? (
              <Button variant="primary" icon="arrow-right" onClick={() => setStepIdx((i) => Math.min(experiment.steps.length - 1, i + 1))}>下一步</Button>
            ) : (
              <Button variant="primary" icon="download" onClick={() => setExportOpen(true)}>去导出</Button>
            )}
          </div>
        </div>
        {inspectorOpen && (
          <aside className="wb-inspector" aria-label="结果检查器">
            <Panel
              title="结果检查器"
              actions={<Button size="sm" variant="ghost" onClick={() => setInspectorOpen(false)}>收起</Button>}
            >
              <ResultInspector results={results} profileName={profile.shortName} />
              {project.auditLog.length > 0 && (
                <details className="fold" style={{ marginTop: 10 }}>
                  <summary><MarkdownInline>{`审计日志（${project.auditLog.length} 条）`}</MarkdownInline></summary>
                  <div className="fold-body">
                    <div className="stack" style={{ gap: 4 }}>
                      {[...project.auditLog].reverse().slice(0, 50).map((entry, i) => (
                        <div key={i} className="small muted">
                          <MarkdownInline>{`**${entry.action}**${entry.detail ? ` — ${entry.detail}` : ''}（${formatAuditTime(entry.at)}）`}</MarkdownInline>
                        </div>
                      ))}
                      {project.auditLog.length > 50 && (
                        <div className="small faint"><MarkdownInline>仅显示最近 50 条</MarkdownInline></div>
                      )}
                    </div>
                  </div>
                </details>
              )}
            </Panel>
          </aside>
        )}
      </div>

      <Modal open={exportOpen} onClose={() => setExportOpen(false)} title="导出" wide>
        <div className="stack">
          <Tabs
            tabs={[
              { id: 'report-md', label: '完整报告 Markdown' },
              { id: 'report-latex', label: '完整报告 LaTeX' },
              { id: 'md', label: '数据处理片段' },
              { id: 'data', label: '表格 CSV / 项目 JSON' },
            ]}
            active={exportTab}
            onChange={(id) => setExportTab(id as 'report-md' | 'report-latex' | 'md' | 'data')}
            ariaLabel="导出内容"
          />
          {exportTab === 'report-md' && (
            <>
              <div className="row">
                <CopyButton text={() => reportMd} label="复制完整报告" />
                <Button size="sm" onClick={() => download(new Blob([reportMd], { type: 'text/markdown' }), `${project.title}-实验报告.md`)}>下载 .md</Button>
              </div>
              <div className="small muted"><MarkdownInline>含实验信息、参数、数据表、拟合、全部计算过程、规则摘要、诊断与审计日志；主观结论由实验者补充。</MarkdownInline></div>
              <pre style={{ maxHeight: 300, overflow: 'auto', fontSize: 12 }}>{reportMd.slice(0, 4000)}{reportMd.length > 4000 ? '\n…（完整内容请下载）' : ''}</pre>
            </>
          )}
          {exportTab === 'report-latex' && (
            <>
              <div className="row">
                <CopyButton text={() => reportTex} label="复制 LaTeX 源码" />
                <Button size="sm" onClick={() => download(new Blob([reportTex], { type: 'text/x-tex' }), `${project.title}-实验报告.tex`)}>下载 .tex</Button>
              </div>
              <div className="small muted"><MarkdownInline>{'完整可编译文档（ctexart + booktabs，建议 XeLaTeX 编译）；单位样式跟随设置（`\\mathrm{}` / `\\text{}`）。'}</MarkdownInline></div>
              <pre style={{ maxHeight: 300, overflow: 'auto', fontSize: 12 }}>{reportTex.slice(0, 4000)}{reportTex.length > 4000 ? '\n…（完整内容请下载）' : ''}</pre>
            </>
          )}
          {exportTab === 'md' && (
            <>
              <div className="row">
                <CopyButton text={() => mdExport} label="复制 Markdown" />
                <Button size="sm" onClick={() => download(new Blob([mdExport], { type: 'text/markdown' }), `${project.title}-数据处理.md`)}>下载 .md</Button>
              </div>
              <pre style={{ maxHeight: 260, overflow: 'auto', fontSize: 12 }}>{mdExport.slice(0, 4000)}{mdExport.length > 4000 ? '\n…（完整内容请下载）' : ''}</pre>
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

function formatAuditTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
