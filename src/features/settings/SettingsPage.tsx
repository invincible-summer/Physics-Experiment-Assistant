/** 设置页（plan §3）：标准配置 / 外观 / 数值与有效数字 / 单位与量纲 / 图表导出 / 数据隐私 / 功能开关 */
import { useRef, useState } from 'react';
import { Preferences, useSettings } from '../../stores/settings';
import {
  buildCustomProfile, CustomProfileOptions, DEFAULT_PROFILE_ID, listProfiles, ProfileKind,
} from '../../standards/registry';
import {
  Badge, BadgeVariant, Button, ConfirmButton, Field, Modal, Notice, Panel, Tabs, toast,
} from '../../components/ui';
import { clearAllProjects, importProjectJson } from '../../persistence/db';
import { Tex } from '../../components/katex';
import { MarkdownBlock, MarkdownInline, MarkdownList } from '../../components/Markdown';

const KIND_META: Record<ProfileKind, { label: string; variant: BadgeVariant }> = {
  course: { label: '课程模式', variant: 'accent' },
  gbt: { label: 'GB/T 标准', variant: 'info' },
  custom: { label: '自定义', variant: 'warning' },
};

const THEME_TABS = [
  { id: 'system', label: '跟随系统' },
  { id: 'light', label: '浅色' },
  { id: 'dark', label: '深色' },
];

const FONT_SCALE_TABS: { id: string; label: string }[] = [
  { id: '0.9', label: '90%' },
  { id: '1', label: '100%' },
  { id: '1.1', label: '110%' },
  { id: '1.25', label: '125%' },
  { id: '1.4', label: '140%' },
];

const FEATURE_FLAGS = [
  ['showSafety', '显示实验安全提示', '实验工作台顶部展示该实验的安全须知'],
  ['showProvenance', '显示公式来源标注', '公式与结果显示 provenance（资料原式 / 由资料推导 / 通用扩展）'],
  ['showDiagnostics', '显示计算诊断', '基于已输入数据给出残差、趋势、单位异常等客观诊断'],
  ['expertMode', '专家模式', '显示表达式 AST、灵敏度系数等进阶信息'],
] as const;

/** 课程记号 Δ 与 GB/T 记号 u/u_c/U 统一转 LaTeX 片段 */
function texOf(symbol: string): string {
  return symbol.replace(/Δ/g, '\\Delta ');
}

export function SettingsPage() {
  const settings = useSettings();
  const profile = settings.activeProfile();
  const co = settings.customOptions;
  const [rulesOpen, setRulesOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [importCount, setImportCount] = useState(0);

  const profiles = listProfiles().filter((p) => p.id !== 'custom');
  const customActive = settings.standardProfileId === 'custom';
  const conflict = co.typeAWithTFactor && co.bMode === 'distribution';

  const formulaTex = profile.bType.mode === 'instrument-limit'
    ? '\\Delta = \\sqrt{\\Delta_A^2 + \\Delta_B^2},\\qquad \\Delta_A = t_{P}(\\nu)\\,S_{\\bar{x}},\\quad \\nu = n-1'
    : 'u_{c}(y) = \\sqrt{\\sum_{i} c_i^2\\,u^2(x_i)},\\qquad c_i = \\frac{\\partial f}{\\partial x_i}';

  const notationItems = [
    `直接测量不确定度：$${texOf(profile.notation.direct)}$`,
    `合成不确定度：$${texOf(profile.notation.combined)}$`,
    ...(profile.notation.expanded
      ? [`扩展不确定度：$${texOf(profile.notation.expanded)}$（报告必须注明 $k$ 或 $p$，不得与标准不确定度混用）`]
      : ['课程模式统一使用 $\\Delta$ 记号，不与 GB/T 的 $u$/$U$ 混用语义']),
    ...(profile.simplification?.enabled && profile.bType.mode === 'instrument-limit'
      ? [`课程简化规则：${profile.simplification.label}`]
      : []),
  ];

  return (
    <div className="stack-lg">
      <header className="page-head">
        <h1 className="page-title"><MarkdownInline>设置</MarkdownInline></h1>
        <div className="page-lead">
          <MarkdownBlock>{'标准配置、外观、数值与有效数字规则、图表导出与本地数据管理。课程模式与 GB/T 27418-2017 模式严格隔离，禁止混算。'}</MarkdownBlock>
        </div>
      </header>

      <Panel
        title="标准配置"
        icon="book"
        sub="切换后所有计算立即按新标准执行"
        actions={<Button size="sm" onClick={() => setRulesOpen(true)}>{`查看当前规则详情（${profile.shortName}）`}</Button>}
      >
        <div className="card-grid" role="radiogroup" aria-label="标准配置">
          {profiles.map((p) => {
            const active = settings.standardProfileId === p.id;
            const kind = KIND_META[p.kind];
            return (
              <label key={p.id} className={`check-item${active ? ' checked' : ''}`} style={{ cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="standard-profile"
                  aria-label={p.name}
                  checked={active}
                  onChange={() => settings.set('standardProfileId', p.id)}
                />
                <span className="stack" style={{ gap: 7, flex: 1 }}>
                  <span className="row">
                    <span className="strong"><MarkdownInline>{p.name}</MarkdownInline></span>
                    <Badge variant={kind.variant}>{kind.label}</Badge>
                    {p.id === DEFAULT_PROFILE_ID && <Badge variant="accent">默认·推荐</Badge>}
                    {active && <Badge variant="success">当前</Badge>}
                  </span>
                  <span className="small muted"><MarkdownInline>{p.description}</MarkdownInline></span>
                  <MarkdownList items={p.rulesSummary.slice(0, 4)} className="small" />
                  <span className="xs faint">
                    <MarkdownInline>{`${p.shortName}${p.supportsExperiments ? ` · 内置 ${p.supportsExperiments.length} 个实验工作台` : ' · 不含实验工作台'}`}</MarkdownInline>
                  </span>
                </span>
              </label>
            );
          })}

          <div className={`check-item${customActive ? ' checked' : ''}`} style={{ display: 'block' }}>
            <label className="row-nowrap" style={{ cursor: 'pointer' }}>
              <input
                type="radio"
                name="standard-profile"
                aria-label="自定义配置"
                checked={customActive}
                onChange={() => settings.set('standardProfileId', 'custom')}
              />
              <span className="strong"><MarkdownInline>自定义配置</MarkdownInline></span>
              <Badge variant="warning">自定义</Badge>
              {customActive && <Badge variant="success">当前</Badge>}
            </label>
            <div className="small muted" style={{ marginTop: 6 }}>
              <MarkdownBlock>由显式参数组成，禁止隐式继承相互矛盾的规则；不代表课程或 GB/T 标准。</MarkdownBlock>
            </div>
            <div className="form-grid" style={{ marginTop: 10 }}>
              <Field label="包含概率 $P$" hint="A 类 $t$ 因子对应的置信概率">
                <select
                  className="select"
                  value={String(co.confidence)}
                  onChange={(e) => settings.setCustomOptions({ confidence: Number(e.target.value) })}
                >
                  {[0.95, 0.99].includes(co.confidence) ? null : (
                    <option value={String(co.confidence)}>{co.confidence}</option>
                  )}
                  <option value="0.95">0.95</option>
                  <option value="0.99">0.99</option>
                </select>
              </Field>
              <Field label="B 类评定方式" hint="课程式取仪器误差限；GB/T 式按概率分布换算为标准不确定度">
                <select
                  className="select"
                  value={co.bMode}
                  onChange={(e) => settings.setCustomOptions({ bMode: e.target.value as CustomProfileOptions['bMode'] })}
                >
                  <option value="instrument-limit">误差限（课程式）</option>
                  <option value="distribution">分布换算（GB/T 式）</option>
                </select>
              </Field>
              <Field label="不确定度有效数字" hint="合成/总不确定度保留的有效数字位数">
                <select
                  className="select"
                  value={String(co.uncertaintyDigits)}
                  onChange={(e) => settings.setCustomOptions({ uncertaintyDigits: Number(e.target.value) as 1 | 2 })}
                >
                  <option value="1">1 位</option>
                  <option value="2">2 位</option>
                </select>
              </Field>
            </div>
            <div className="stack" style={{ gap: 7, marginTop: 10 }}>
              <label className="row-nowrap">
                <input
                  type="checkbox"
                  checked={co.typeAWithTFactor}
                  onChange={(e) => settings.setCustomOptions({ typeAWithTFactor: e.target.checked })}
                />
                <span className="small"><MarkdownInline>{'A 类乘 $t$ 因子（课程式）；关闭则直接用平均值标准不确定度（GB/T 风格）'}</MarkdownInline></span>
              </label>
              <label className="row-nowrap">
                <input
                  type="checkbox"
                  checked={co.allowLeadingDigitCompress}
                  onChange={(e) => settings.setCustomOptions({ allowLeadingDigitCompress: e.target.checked })}
                />
                <span className="small"><MarkdownInline>不确定度首位 ≥ 3 时允许压缩为 1 位有效数字</MarkdownInline></span>
              </label>
              <label className="row-nowrap">
                <input
                  type="checkbox"
                  checked={co.simplificationEnabled}
                  onChange={(e) => settings.setCustomOptions({ simplificationEnabled: e.target.checked })}
                />
                <span className="small"><MarkdownInline>{'启用课程简化：$\\Delta_A < \\Delta_B/3$ 时取 $\\Delta = \\Delta_B$（界面会提示）'}</MarkdownInline></span>
              </label>
            </div>
            {conflict && (
              <div style={{ marginTop: 10 }}>
                <Notice variant="danger" title="规则混算警告">
                  <MarkdownBlock>{'此组合把 $t$ 因子化的 A 类与标准不确定度形式的 B 类混算，与 GB/T 27418-2017 相悖。请核对自定义配置：关闭「A 类乘 $t$ 因子」或改用误差限 B 类。'}</MarkdownBlock>
                </Notice>
              </div>
            )}
          </div>
        </div>
        <div className="small muted" style={{ marginTop: 12 }}>
          <MarkdownBlock>{`**当前生效：** ${profile.name}（${profile.shortName}） · 合成记号 $${texOf(profile.notation.combined)}$ · B 类 ${profile.bType.mode === 'instrument-limit' ? '取仪器误差限 $\\Delta_B = \\Delta_{仪}$' : '按分布换算为标准不确定度'}`}</MarkdownBlock>
        </div>
      </Panel>

      <Panel title="外观" icon="sun" sub="亮/暗主题均遵循 WCAG AA 对比度；字号档位改变全站文字，图标与边框保持不变">
        <Field label="主题" hint="「跟随系统」随操作系统的亮暗设置自动切换">
          <Tabs
            ariaLabel="主题"
            tabs={THEME_TABS}
            active={settings.theme}
            onChange={(id) => settings.set('theme', id as Preferences['theme'])}
          />
        </Field>
        <Field label="界面字号" hint="立即生效并保存；正文、按钮、表格与公式随档位缩放">
          <Tabs
            ariaLabel="界面字号"
            tabs={FONT_SCALE_TABS}
            active={String(settings.fontScale)}
            onChange={(id) => settings.set('fontScale', Number(id) as Preferences['fontScale'])}
          />
        </Field>
      </Panel>

      <Panel title="数值与有效数字" icon="calculator" sub="中间计算保留完整精度，只在显示和导出最终结果时修约">
        <div className="form-grid">
          <Field label="最终不确定度有效数字" hint="选择「由标准配置决定」后，结果统一遵循当前标准的有效数字规则">
            <select
              className="select"
              value={String(settings.uncertaintyDigitsOverride)}
              onChange={(e) => settings.set(
                'uncertaintyDigitsOverride',
                e.target.value === 'profile' ? 'profile' : (Number(e.target.value) as 1 | 2),
              )}
            >
              <option value="profile">由标准配置决定</option>
              <option value="1">强制 1 位</option>
              <option value="2">强制 2 位</option>
            </select>
          </Field>
          <Field label="相对不确定度有效数字（标准内）" hint="由当前标准配置固定，不可覆盖">
            <select className="select" value={String(profile.sigfig.relativeDigits)} disabled>
              <option value={String(profile.sigfig.relativeDigits)}>{`${profile.sigfig.relativeDigits} 位（${profile.shortName}）`}</option>
            </select>
          </Field>
          <Field label="角度单位" hint="三角函数计算与角度显示的默认单位">
            <select
              className="select"
              value={settings.angleUnit}
              onChange={(e) => settings.set('angleUnit', e.target.value as Preferences['angleUnit'])}
            >
              <option value="deg">度（°）</option>
              <option value="rad">弧度（rad）</option>
            </select>
          </Field>
        </div>
        <div className="small muted" style={{ marginTop: 10 }}>
          <MarkdownBlock>修约策略集中在 `core/sigfig`；有效数字只作用于显示与最终导出，不作用于计算链上游。</MarkdownBlock>
        </div>
      </Panel>

      <Panel title="单位与量纲" icon="ruler">
        <div className="check-list">
          <label className="check-item checked" style={{ opacity: 0.8 }}>
            <input type="checkbox" checked disabled readOnly />
            <span className="small"><MarkdownInline>内部计算统一转换为 SI 单位（始终开启，不可关闭）</MarkdownInline></span>
          </label>
          <label className={`check-item${settings.showDimensionCheck ? ' checked' : ''}`}>
            <input
              type="checkbox"
              checked={settings.showDimensionCheck}
              onChange={(e) => settings.set('showDimensionCheck', e.target.checked)}
            />
            <span className="small"><MarkdownInline>显示量纲一致性检查信息</MarkdownInline></span>
          </label>
        </div>
        <div className="small muted" style={{ marginTop: 10 }}>
          <MarkdownBlock>摄氏温度与温差分别处理（温度转换含偏置，温差只缩放）；维度不相容时拒绝计算（`AGENTS.md §7`）。</MarkdownBlock>
        </div>
      </Panel>

      <Panel title="图表与导出" icon="chart">
        <div className="form-grid">
          <Field label="默认导出格式" hint="SVG 为矢量格式，打印优先；PNG 用于位图场景">
            <select
              className="select"
              value={settings.defaultPlotFormat}
              onChange={(e) => settings.set('defaultPlotFormat', e.target.value as Preferences['defaultPlotFormat'])}
            >
              <option value="svg">SVG（优先）</option>
              <option value="png">PNG</option>
            </select>
          </Field>
          <Field label="Markdown 数学风格" hint="导出 Markdown 报告时行内/块级数学的定界符">
            <select
              className="select"
              value={settings.mathStyle}
              onChange={(e) => settings.set('mathStyle', e.target.value as Preferences['mathStyle'])}
            >
              <option value="dollar">$...$</option>
              <option value="parens">\(...\)</option>
            </select>
          </Field>
          <Field label="LaTeX 单位风格" hint="导出 LaTeX 结果时单位的包裹方式（`\mathrm{}` 为正体直立，`\text{}` 随正文）">
            <select
              className="select"
              value={settings.latexUnitStyle ? 'mathrm' : 'text'}
              onChange={(e) => settings.set('latexUnitStyle', e.target.value === 'mathrm')}
            >
              <option value="mathrm">{'\\mathrm{}（默认）'}</option>
              <option value="text">{'\\text{}'}</option>
            </select>
          </Field>
        </div>
        <div className="check-list" style={{ marginTop: 10 }}>
          <label className={`check-item${settings.plotWhiteBackground ? ' checked' : ''}`}>
            <input
              type="checkbox"
              checked={settings.plotWhiteBackground}
              onChange={(e) => settings.set('plotWhiteBackground', e.target.checked)}
            />
            <span className="small"><MarkdownInline>{'图表导出使用白底可打印样式（`AGENTS.md §12` 默认要求）'}</MarkdownInline></span>
          </label>
          <label className={`check-item${settings.showFitR ? ' checked' : ''}`}>
            <input
              type="checkbox"
              checked={settings.showFitR}
              onChange={(e) => settings.set('showFitR', e.target.checked)}
            />
            <span className="small"><MarkdownInline>{'拟合图默认显示相关系数 $r$（课程模式优先展示 $r$，$R^2$ 为附加指标）'}</MarkdownInline></span>
          </label>
          <label className={`check-item${settings.showRR2 ? ' checked' : ''}`}>
            <input
              type="checkbox"
              checked={settings.showRR2}
              onChange={(e) => settings.set('showRR2', e.target.checked)}
            />
            <span className="small"><MarkdownInline>{'拟合结果同时显示 $R^2$（工程扩展指标，课程模式仍以 $r$ 为准）'}</MarkdownInline></span>
          </label>
          <label className={`check-item${settings.defaultErrorBars ? ' checked' : ''}`}>
            <input
              type="checkbox"
              checked={settings.defaultErrorBars}
              onChange={(e) => settings.set('defaultErrorBars', e.target.checked)}
            />
            <span className="small"><MarkdownInline>实验图默认绘制误差棒（数据点带不确定度时生效）</MarkdownInline></span>
          </label>
        </div>
      </Panel>

      <Panel title="数据与隐私" icon="folder" sub="实验数据不上传任何服务器">
        <Notice variant="info">
          <MarkdownBlock>{'**项目和偏好仅保存在当前浏览器，不会上传。**\n\n清空浏览器站点数据会删除项目。请先使用「导出全部项目 JSON」备份；在其他浏览器或设备上，可通过「导入项目 JSON」恢复。'}</MarkdownBlock>
        </Notice>
        <div className="check-list" style={{ marginTop: 10 }}>
          <label className={`check-item${settings.autosave ? ' checked' : ''}`}>
            <input
              type="checkbox"
              checked={settings.autosave}
              onChange={(e) => settings.set('autosave', e.target.checked)}
            />
            <span className="small"><MarkdownInline>自动保存（编辑后保存在本浏览器）</MarkdownInline></span>
          </label>
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <Button size="sm" onClick={() => fileRef.current?.click()}>导入项目 JSON</Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            aria-label="选择要导入的项目 JSON 文件"
            style={{ display: 'none' }}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const text = await file.text();
              const result = await importProjectJson(text);
              if (result.ok) {
                setImportCount((c) => c + result.imported);
                toast(
                  `导入完成：新增 ${result.imported} 个项目`
                  + `${result.skipped > 0 ? `，跳过 ${result.skipped} 条无效数据` : ''}`
                  + `${result.migrationNote ? `（${result.migrationNote}）` : ''}`,
                );
              } else {
                toast(`导入失败：${result.error}`);
              }
              e.target.value = '';
            }}
          />
          <ConfirmButton
            variant="danger"
            size="sm"
            question="清空本浏览器中的全部项目数据？此操作不可恢复，请先导出需要保留的项目 JSON。"
            onConfirm={async () => {
              await clearAllProjects();
              toast('已清空全部本地项目数据');
            }}
          >清空全部本地项目</ConfirmButton>
          {importCount > 0 && (
            <span className="small muted"><MarkdownInline>{`本次会话已导入 ${importCount} 个项目`}</MarkdownInline></span>
          )}
        </div>
        <div className="small muted" style={{ marginTop: 8 }}>
          <MarkdownBlock>导入支持：单项目信封、「导出全部」归档（逐条校验，坏条目跳过并计数）与旧版裸数据；项目页也可直接导入。</MarkdownBlock>
        </div>
      </Panel>

      <Panel title="功能开关" icon="settings">
        <div className="check-list">
          {FEATURE_FLAGS.map(([key, label, desc]) => (
            <label key={key} className={`check-item${settings[key] ? ' checked' : ''}`}>
              <input
                type="checkbox"
                checked={settings[key]}
                onChange={(e) => settings.set(key, e.target.checked)}
              />
              <span className="stack" style={{ gap: 2 }}>
                <span className="small strong"><MarkdownInline>{label}</MarkdownInline></span>
                <span className="xs muted"><MarkdownInline>{desc}</MarkdownInline></span>
              </span>
            </label>
          ))}
        </div>
      </Panel>

      <Panel title="恢复默认设置" sub="一键回到初始偏好；不影响已保存的项目数据" icon="undo">
        <div className="row">
          <ConfirmButton
            variant="danger"
            size="sm"
            question="将全部设置恢复为默认值？包括标准配置、主题、数值规则与功能开关（项目数据不受影响）。"
            onConfirm={() => {
              settings.resetToDefaults();
              toast('已恢复全部默认设置');
            }}
          >恢复全部默认设置</ConfirmButton>
          <span className="small muted"><MarkdownInline>{'重置后立即生效，标准配置恢复为 **2026 秋物理实验 A(1)**；已保存的项目保留。'}</MarkdownInline></span>
        </div>
      </Panel>

      <Modal open={rulesOpen} onClose={() => setRulesOpen(false)} title={`规则详情 · ${profile.name}`} wide>
        <div className="stack">
          <div>
            <div className="field-label"><MarkdownInline>合成模型</MarkdownInline></div>
            <Tex tex={formulaTex} display />
          </div>
          <div>
            <div className="field-label"><MarkdownInline>不确定度记号</MarkdownInline></div>
            <MarkdownList items={notationItems} className="small" />
          </div>
          <div>
            <div className="field-label"><MarkdownInline>规则摘要（全量）</MarkdownInline></div>
            <MarkdownList items={profile.rulesSummary} />
          </div>
          <div className="small muted"><MarkdownBlock>{`**规则来源：** ${profile.source}`}</MarkdownBlock></div>
        </div>
      </Modal>
    </div>
  );
}
