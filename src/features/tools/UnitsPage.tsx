/** 单位换算：量纲族/单位选择 + 数值输入，量纲检查，温度值与温差语义区分。 */
import { useMemo } from 'react';
import {
  convert, convertTemperature, dimensionToString, DimensionMismatchError,
  displayUnit, families, tryGetUnitDef, unitsOfFamily, unitZh,
} from '../../core/quantity';
import { Button, Field, Notice, Panel } from '../../components/ui';
import { MarkdownBlock, MarkdownInline, MarkdownList } from '../../components/Markdown';
import { useSettings } from '../../stores/settings';
import { useToolDraft } from './use-tool-draft';

const FAMILY_ZH: Record<string, string> = {
  length: '长度', area: '面积', volume: '体积', mass: '质量', time: '时间', frequency: '频率',
  temperature: '温度', force: '力', energy: '能量', power: '功率', current: '电流', voltage: '电压',
  resistance: '电阻', charge: '电荷', capacitance: '电容', inductance: '电感', magnetic: '磁场',
  pressure: '压强', density: '密度', thermal: '热学', electronic: '半导体/磁学', angle: '角度',
};

const EXAMPLES: string[] = [
  '磁感应强度：$1\\ \\mathrm{mT} = 10\\ \\mathrm{Gs}$',
  '密度：$1\\ \\mathrm{g}/\\mathrm{cm}^{3} = 1000\\ \\mathrm{kg}/\\mathrm{m}^{3}$',
  '体积：$1\\ \\mathrm{L} = 1000\\ \\mathrm{mL} = 1000\\ \\mathrm{cm}^{3}$',
  '电容：$1\\ \\mu\\mathrm{F} = 1000\\ \\mathrm{nF}$',
  '霍尔系数：$1\\ \\mathrm{cm}^{3}/\\mathrm{C} = 10^{-6}\\ \\mathrm{m}^{3}/\\mathrm{C}$',
  '温度值：$0\\ ^{\\circ}\\mathrm{C} = 273.15\\ \\mathrm{K}$；温差只缩放：$1\\ \\mathrm{K} = 1\\ ^{\\circ}\\mathrm{C}$',
];

type ConvResult = { value: number } | { error: string; mismatch: boolean };

/** 显示用格式化（仅最终展示，不参与换算） */
function formatValue(x: number): string {
  const ax = Math.abs(x);
  if (x !== 0 && (ax >= 1e12 || ax < 1e-6)) return x.toExponential(6);
  return String(Number(x.toPrecision(10)));
}

export function UnitsPage() {
  const showDimensionCheck = useSettings((s) => s.showDimensionCheck);
  const [draft, setDraft] = useToolDraft<{ family: string; from: string; to: string; value: string }>(
    'units',
    { family: 'length', from: 'm', to: 'mm', value: '1' },
  );
  const { family, from, to, value } = draft;
  const patch = (p: Partial<typeof draft>) => setDraft((d) => ({ ...d, ...p }));

  const units = useMemo(() => unitsOfFamily(family), [family]);
  const isTemp = family === 'temperature';

  const result = useMemo<ConvResult>(() => {
    const v = Number(value);
    if (!Number.isFinite(v)) return { error: '非法数值：请输入一个数字', mismatch: false };
    try {
      if (isTemp) return { value: convertTemperature(v, from, to) };
      return { value: convert(v, from, to) };
    } catch (err) {
      if (err instanceof DimensionMismatchError) return { error: err.message, mismatch: true };
      return { error: (err as Error).message, mismatch: false };
    }
  }, [value, from, to, isTemp]);

  const fromDef = tryGetUnitDef(from);
  const toDef = tryGetUnitDef(to);

  return (
    <>
      <header className="page-head">
        <h1 className="page-title"><MarkdownInline>单位换算</MarkdownInline></h1>
        <div className="page-lead">
          <MarkdownBlock>{'内部计算统一 SI，换算前做量纲检查，不相容即拒绝；摄氏温度区分**温度值**（含偏置）与**温差**（只缩放）两种语义。'}</MarkdownBlock>
        </div>
      </header>

      <div className="stack-lg" style={{ maxWidth: 620 }}>
        <Panel title="换算" sub="切换量纲族后，从/到下拉只列出该族单位">
          <div className="form-grid">
            <Field label="量纲族">
              <select
                className="select"
                value={family}
                onChange={(e) => {
                  const f = e.target.value;
                  const us = unitsOfFamily(f);
                  patch({ family: f, from: us[0] ?? '', to: us[1] ?? us[0] ?? '' });
                }}
              >
                {families().filter((f) => f !== 'dimensionless' && f !== 'angle').map((f) => (
                  <option key={f} value={f}>{FAMILY_ZH[f] ?? f}</option>
                ))}
              </select>
            </Field>
            <Field label="数值">
              <input className="input" value={value} inputMode="decimal" onChange={(e) => patch({ value: e.target.value })} />
            </Field>
            <Field label="从">
              <select className="select" value={from} onChange={(e) => patch({ from: e.target.value })}>
                {units.map((u) => <option key={u} value={u}>{`${displayUnit(u)}（${unitZh(u)}）`}</option>)}
              </select>
            </Field>
            <Field label="到">
              <select className="select" value={to} onChange={(e) => patch({ to: e.target.value })}>
                {units.map((u) => <option key={u} value={u}>{`${displayUnit(u)}（${unitZh(u)}）`}</option>)}
              </select>
            </Field>
          </div>
          <div className="row-right" style={{ marginTop: 10 }}>
            <Button size="sm" icon="swap" onClick={() => patch({ from: to, to: from })}>交换</Button>
          </div>

          {'error' in result && result.mismatch ? (
            <Notice variant="danger" title="量纲不相容">
              <MarkdownBlock>{result.error}</MarkdownBlock>
            </Notice>
          ) : (
            <div className="result-final" style={{ marginTop: 6 }}>
              {'error' in result ? (
                <span className="muted"><MarkdownInline>{result.error}</MarkdownInline></span>
              ) : (
                <>
                  <span className="value">{value.trim() || '0'}</span>
                  <span className="unit"><MarkdownInline>{displayUnit(from)}</MarkdownInline></span>
                  <span className="unit">=</span>
                  <span className="value">{formatValue(result.value)}</span>
                  <span className="unit"><MarkdownInline>{displayUnit(to)}</MarkdownInline></span>
                </>
              )}
            </div>
          )}

          {isTemp && !('error' in result) && (
            <Notice variant="info">
              <MarkdownBlock>{'℃ ↔ K 的温度值换算**含 273.15 偏置**；**温差换算只缩放、不偏置**（温差数值 ℃ 与 K 相同）。'}</MarkdownBlock>
            </Notice>
          )}

          {showDimensionCheck && !('error' in result) && fromDef && toDef && (
            <div className="small muted" style={{ marginTop: 8 }}>
              <MarkdownBlock>{`量纲：${fromDef.zh}（${dimensionToString(fromDef.dim)}）→ ${toDef.zh}（${dimensionToString(toDef.dim)}）`}</MarkdownBlock>
            </div>
          )}
        </Panel>

        <Panel title="常用换算示例">
          <MarkdownList items={EXAMPLES} className="muted small" />
        </Panel>

        <Notice variant="info" title="换算语义">
          <MarkdownBlock>{'内部计算统一 SI，换算前后物理量不变，往返换算不改变数值（属性测试覆盖）。角度视为无量纲：$1\\ \\mathrm{rad} = 1$，$1\\ \\mathrm{deg} = \\pi/180$。'}</MarkdownBlock>
        </Notice>
      </div>
    </>
  );
}
