/** 设置页（plan §3）：标准与课程 / 数值与有效数字 / 单位 / 图表导出 / 数据隐私 / 实验功能 */
import { useRef, useState } from 'react';
import { useSettings, MathStyle, UnitOutput } from '../../stores/settings';
import {
  listProfiles, buildCustomProfile, CustomProfileOptions,
  TSINGHUA_A1_2026, TSINGHUA_FOUNDATION_2020, GBT_27418_2017,
} from '../../standards/registry';
import { Panel, Badge, Modal, ConfirmButton, toast } from '../../components/ui';
import { clearAllProjects, importProjectJson } from '../../persistence/db';
import { Tex } from '../../components/katex';
import { MarkdownInline, MarkdownList } from '../../components/Markdown';

export function SettingsPage() {
  const settings = useSettings();
  const profile = settings.activeProfile();
  const [rulesOpen, setRulesOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [importCount, setImportCount] = useState(0);

  const profileCards = [
    { p: TSINGHUA_A1_2026, recommended: true },
    { p: TSINGHUA_FOUNDATION_2020, recommended: false },
    { p: GBT_27418_2017, recommended: false },
  ];

  return (
    <main className="page">
      <h1><MarkdownInline>设置</MarkdownInline></h1>

      <Panel title="标准与课程" sub="课程模式与 GB/T 模式严格隔离；切换后所有计算按新标准">
        <div className="card-grid">
          {profileCards.map(({ p, recommended }) => (
            <div
              key={p.id}
              className="panel"
              style={{ marginBottom: 0, cursor: 'pointer', outline: settings.standardProfileId === p.id ? '2px solid var(--accent)' : 'none' }}
              onClick={() => settings.set('standardProfileId', p.id)}
            >
              <div className="fc-title">
                <span><MarkdownInline>{p.name}</MarkdownInline></span>
                {recommended && <Badge variant="accent">默认·推荐</Badge>}
                {settings.standardProfileId === p.id && <Badge variant="success">当前</Badge>}
              </div>
              <div className="small muted" style={{ margin: '6px 0' }}><MarkdownInline>{p.description}</MarkdownInline></div>
              <MarkdownList items={p.rulesSummary.slice(0, 5)} className="small" />
              <button className="btn btn-sm" style={{ marginTop: 8 }} onClick={(e) => { e.stopPropagation(); setRulesOpen(true); }}>
                <MarkdownInline allowLinks={false}>{`查看规则（${p.name}）`}</MarkdownInline>
              </button>
            </div>
          ))}
          <div
            className="panel"
            style={{ marginBottom: 0, cursor: 'pointer', outline: settings.standardProfileId === 'custom' ? '2px solid var(--accent)' : 'none' }}
            onClick={() => settings.set('standardProfileId', 'custom')}
          >
            <div className="fc-title"><span><MarkdownInline>自定义</MarkdownInline></span>{settings.standardProfileId === 'custom' && <Badge variant="success">当前</Badge>}</div>
            <div className="notice notice-warning" style={{ marginTop: 6 }}>
              <div className="n-body small"><MarkdownInline>自定义规则，不代表课程或 GB/T 标准</MarkdownInline></div>
            </div>
            <div className="form-grid" style={{ marginTop: 8 }} onClick={(e) => e.stopPropagation()}>
              <label className="small"><span className="field-label"><MarkdownInline>包含概率 P</MarkdownInline></span>
                <input className="input" type="number" step="0.01" min="0.5" max="0.999" value={settings.customOptions.confidence}
                  onChange={(e) => settings.setCustomOptions({ confidence: Number(e.target.value) })} />
              </label>
              <label className="small"><span className="field-label"><MarkdownInline>A 类乘 t 因子</MarkdownInline></span>
                <select className="select" value={settings.customOptions.typeAWithTFactor ? '1' : '0'}
                  onChange={(e) => settings.setCustomOptions({ typeAWithTFactor: e.target.value === '1' })}>
                  <option value="1">是</option><option value="0">否（GB/T 风格）</option>
                </select>
              </label>
              <label className="small"><span className="field-label"><MarkdownInline>B 类模式</MarkdownInline></span>
                <select className="select" value={settings.customOptions.bMode}
                  onChange={(e) => settings.setCustomOptions({ bMode: e.target.value as CustomProfileOptions['bMode'] })}>
                  <option value="instrument-limit">误差限（课程式）</option>
                  <option value="distribution">分布换算（GB/T 式）</option>
                </select>
              </label>
              <label className="small"><span className="field-label"><MarkdownInline>不确定度位数</MarkdownInline></span>
                <select className="select" value={String(settings.customOptions.uncertaintyDigits)}
                  onChange={(e) => settings.setCustomOptions({ uncertaintyDigits: Number(e.target.value) as 1 | 2 })}>
                  <option value="1">1 位</option><option value="2">2 位</option>
                </select>
              </label>
              <label className="small"><span className="field-label"><MarkdownInline>首位≥3 压缩 1 位</MarkdownInline></span>
                <select className="select" value={settings.customOptions.allowLeadingDigitCompress ? '1' : '0'}
                  onChange={(e) => settings.setCustomOptions({ allowLeadingDigitCompress: e.target.value === '1' })}>
                  <option value="1">允许</option><option value="0">不允许</option>
                </select>
              </label>
              <label className="small"><span className="field-label"><MarkdownInline>{'ΔA < ΔB/3 简化'}</MarkdownInline></span>
                <select className="select" value={settings.customOptions.simplificationEnabled ? '1' : '0'}
                  onChange={(e) => settings.setCustomOptions({ simplificationEnabled: e.target.value === '1' })}>
                  <option value="1">启用</option><option value="0">禁用</option>
                </select>
              </label>
            </div>
            {settings.customOptions.typeAWithTFactor && settings.customOptions.bMode === 'distribution' && (
              <div className="notice notice-danger" style={{ marginTop: 8 }}>
                <div className="n-body small"><MarkdownInline>此组合把 t 因子化的 A 类与标准不确定度形式的 B 类混算，与 GB/T 相悖（`AGENTS §3`）。</MarkdownInline></div>
              </div>
            )}
          </div>
        </div>
        <div className="small muted" style={{ marginTop: 10 }}>
          <MarkdownInline>{`**当前生效：**${profile.name} · 记号 ${profile.notation.combined} · B 类 ${profile.bType.mode === 'instrument-limit' ? 'ΔB=Δ仪' : '分布换算'}`}</MarkdownInline>
        </div>
      </Panel>

      <Panel title="数值与有效数字">
        <div className="form-grid">
          <div>
            <div className="field-label"><MarkdownInline>最终不确定度有效数字</MarkdownInline></div>
            <select className="select" value={String(settings.uncertaintyDigitsOverride)} onChange={(e) => settings.set('uncertaintyDigitsOverride', e.target.value === 'profile' ? 'profile' : Number(e.target.value) as 1 | 2)}>
              <option value="profile">由标准决定</option><option value="1">1 位</option><option value="2">2 位</option>
            </select>
            <div className="field-help"><MarkdownInline>选择“由标准决定”时，局部组件不得覆盖（`plan §3.2`）</MarkdownInline></div>
          </div>
          <div>
            <div className="field-label"><MarkdownInline>相对不确定度位数（标准内）</MarkdownInline></div>
            <select className="select" value={String(profile.sigfig.relativeDigits)} disabled>
              <option value="2">2 位（{profile.shortName}）</option>
            </select>
          </div>
          <div>
            <div className="field-label"><MarkdownInline>角度显示</MarkdownInline></div>
            <select className="select" value={settings.angleUnit} onChange={(e) => settings.set('angleUnit', e.target.value as 'deg' | 'rad')}>
              <option value="deg">度（°）</option><option value="rad">弧度（rad）</option>
            </select>
          </div>
          <div>
            <div className="field-label"><MarkdownInline>主题</MarkdownInline></div>
            <select className="select" value={settings.theme} onChange={(e) => settings.set('theme', e.target.value as 'light' | 'dark')}>
              <option value="light">亮色</option><option value="dark">暗色</option>
            </select>
          </div>
        </div>
        <div className="small muted" style={{ marginTop: 8 }}><MarkdownInline>修约策略集中在 `core/sigfig`；中间计算永远保留全精度，仅显示修约（`AGENTS §4.2/§4.5`）。</MarkdownInline></div>
      </Panel>

      <Panel title="单位与物理量">
        <div className="form-grid">
          <div>
            <div className="field-label"><MarkdownInline>内部自动转换到 SI</MarkdownInline></div>
            <input className="input" value="始终开启" disabled />
          </div>
          <div>
            <div className="field-label"><MarkdownInline>显示维度检查信息</MarkdownInline></div>
            <select className="select" value={settings.showDimensionCheck ? '1' : '0'} onChange={(e) => settings.set('showDimensionCheck', e.target.value === '1')}>
              <option value="1">显示</option><option value="0">隐藏</option>
            </select>
          </div>
        </div>
      </Panel>

      <Panel title="图表与导出">
        <div className="form-grid">
          <div>
            <div className="field-label"><MarkdownInline>默认导出格式</MarkdownInline></div>
            <select className="select" value={settings.defaultPlotFormat} onChange={(e) => settings.set('defaultPlotFormat', e.target.value as 'svg' | 'png')}>
              <option value="svg">SVG（优先）</option><option value="png">PNG</option>
            </select>
          </div>
          <div>
            <div className="field-label"><MarkdownInline>Markdown 数学风格</MarkdownInline></div>
            <select className="select" value={settings.mathStyle} onChange={(e) => settings.set('mathStyle', e.target.value as MathStyle)}>
              <option value="dollar">$...$</option><option value="parens">\(...\)</option>
            </select>
          </div>
          <div>
            <div className="field-label"><MarkdownInline>图表默认显示 r</MarkdownInline></div>
            <select className="select" value={settings.showFitR ? '1' : '0'} onChange={(e) => settings.set('showFitR', e.target.value === '1')}>
              <option value="1">显示</option><option value="0">隐藏</option>
            </select>
          </div>
        </div>
        <div className="small muted" style={{ marginTop: 8 }}><MarkdownInline>科学图表导出固定白底可打印样式（`AGENTS §12`）。</MarkdownInline></div>
      </Panel>

      <Panel title="数据与隐私">
        <div className="small" style={{ marginBottom: 8 }}><MarkdownInline>**数据默认仅保存在本浏览器（IndexedDB）**，不上传任何服务器。</MarkdownInline></div>
        <div className="row">
          <label className="row small">
            <input type="checkbox" checked={settings.autosave} onChange={(e) => settings.set('autosave', e.target.checked)} />
            <MarkdownInline>自动保存</MarkdownInline>
          </label>
          <button className="btn btn-sm" onClick={() => { fileRef.current?.click(); }}><MarkdownInline allowLinks={false}>导入项目 JSON</MarkdownInline></button>
          <input
            ref={fileRef} type="file" accept="application/json" style={{ display: 'none' }}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const text = await file.text();
              const result = await importProjectJson(text);
              if (result.ok) {
                setImportCount((c) => c + 1);
                toast(`导入成功：${result.project?.title}${result.migrationNote ? '（' + result.migrationNote + '）' : ''}`);
              } else {
                toast(`导入失败：${result.error}`);
              }
              e.target.value = '';
            }}
          />
          <ConfirmButton
            className="btn btn-sm btn-danger"
            question="清空本浏览器中的全部项目数据？此操作不可恢复。"
            onConfirm={async () => {
              await clearAllProjects();
              toast('已清空全部项目数据');
            }}
          ><MarkdownInline allowLinks={false}>清空本地数据（二次确认）</MarkdownInline></ConfirmButton>
          {importCount > 0 && <span className="small muted"><MarkdownInline>{`本次已导入 ${importCount} 个项目`}</MarkdownInline></span>}
        </div>
      </Panel>

      <Panel title="实验功能">
        <div className="form-grid">
          {([
            ['showSafety', '显示实验安全提示'],
            ['showProvenance', '显示公式来源'],
            ['showDiagnostics', '显示计算诊断'],
            ['expertMode', '专家模式（AST、灵敏度系数等）'],
          ] as const).map(([key, label]) => (
            <label key={key} className="row small">
              <input
                type="checkbox"
                checked={settings[key]}
                onChange={(e) => settings.set(key, e.target.checked)}
              />
              <MarkdownInline>{label}</MarkdownInline>
            </label>
          ))}
        </div>
      </Panel>

      <Modal open={rulesOpen} onClose={() => setRulesOpen(false)} title={`${profile.name} 规则详情`} wide>
        <Tex tex="\Delta = \sqrt{\Delta_A^2 + \Delta_B^2},\quad \Delta_A = t_{0.95}(\nu) \frac{S}{\sqrt n}" display />
        <MarkdownList items={profile.rulesSummary} />
        <div className="small muted"><MarkdownInline>{`**来源：**${profile.source}`}</MarkdownInline></div>
      </Modal>
    </main>
  );
}
