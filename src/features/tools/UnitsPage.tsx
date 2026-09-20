/** 单位换算页（plan §11 单位换算工具） */
import { useMemo, useState } from 'react';
import { convert, convertTemperature, families, unitsOfFamily, tryGetUnitDef, DimensionMismatchError, dimensionToString } from '../../core/quantity';
import { Panel } from '../../components/ui';
import { useSettings } from '../../stores/settings';
import { MarkdownInline } from '../../components/Markdown';

export function UnitsPage() {
  const showDimensionCheck = useSettings((s) => s.showDimensionCheck);
  const [family, setFamily] = useState('length');
  const [from, setFrom] = useState('m');
  const [to, setTo] = useState('mm');
  const [value, setValue] = useState('1');

  const units = useMemo(() => unitsOfFamily(family), [family]);
  const isTemp = family === 'temperature';

  const result = useMemo(() => {
    const v = Number(value);
    if (!Number.isFinite(v)) return { error: '非法数值' };
    try {
      if (isTemp) {
        return { value: convertTemperature(v, from, to), note: '温度（绝对值）换算，含 273.15 偏置' };
      }
      return { value: convert(v, from, to) };
    } catch (err) {
      if (err instanceof DimensionMismatchError) return { error: err.message };
      return { error: (err as Error).message };
    }
  }, [value, from, to, isTemp]);

  const fromDef = tryGetUnitDef(from);
  const toDef = tryGetUnitDef(to);

  return (
    <main className="page">
      <h1><MarkdownInline>单位换算</MarkdownInline></h1>
      <p className="muted"><MarkdownInline>维度检查：不相容的单位拒绝换算；摄氏温度区分温度值与温差语义</MarkdownInline></p>
      <div style={{ maxWidth: 620 }}>
        <Panel title="换算">
          <div className="form-grid">
            <div>
              <div className="field-label"><MarkdownInline>单位族</MarkdownInline></div>
              <select
                className="select"
                value={family}
                onChange={(e) => {
                  setFamily(e.target.value);
                  const us = unitsOfFamily(e.target.value);
                  setFrom(us[0] ?? '');
                  setTo(us[1] ?? us[0] ?? '');
                }}
              >
                {families().filter((f) => f !== 'dimensionless' && f !== 'angle').map((f) => (
                  <option key={f} value={f}>{familyZh(f)}</option>
                ))}
              </select>
            </div>
            <div>
              <div className="field-label"><MarkdownInline>数值</MarkdownInline></div>
              <input className="input" value={value} inputMode="decimal" onChange={(e) => setValue(e.target.value)} />
            </div>
            <div>
              <div className="field-label"><MarkdownInline>从</MarkdownInline></div>
              <select className="select" value={from} onChange={(e) => setFrom(e.target.value)}>
                {units.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <div className="field-label"><MarkdownInline>到</MarkdownInline></div>
              <select className="select" value={to} onChange={(e) => setTo(e.target.value)}>
                {units.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
          <div className="result-final" style={{ marginTop: 14 }}>
            {'error' in result ? (
              <span style={{ color: 'var(--danger)' }}><MarkdownInline>{result.error}</MarkdownInline></span>
            ) : (
              <>
                <span className="value"><MarkdownInline>{`${value} ${from}`}</MarkdownInline></span>
                <span className="unit">=</span>
                <span className="value"><MarkdownInline>{result.value.toPrecision(10)}</MarkdownInline></span>
                <span className="unit"><MarkdownInline>{to}</MarkdownInline></span>
              </>
            )}
          </div>
          {'note' in result && result.note ? <div className="field-help"><MarkdownInline>{`${result.note}（温差换算只缩放不偏置）`}</MarkdownInline></div> : null}
          {showDimensionCheck && fromDef && toDef && (
            <div className="field-help" style={{ marginTop: 6 }}>
              <MarkdownInline>{`量纲：${fromDef.zh}（${dimensionStr(fromDef)}）→ ${toDef.zh}（${dimensionStr(toDef)}）`}</MarkdownInline>
            </div>
          )}
        </Panel>
        <div className="notice notice-info">
          <div className="n-body">
            <MarkdownInline>内部计算统一 SI。单位换算往返不改变物理量（属性测试覆盖）。角度视为无量纲：`rad=1`、`deg=π/180`。</MarkdownInline>
          </div>
        </div>
      </div>
    </main>
  );
}

const FAMILY_ZH: Record<string, string> = {
  length: '长度', area: '面积', volume: '体积', mass: '质量', time: '时间', frequency: '频率',
  temperature: '温度', force: '力', energy: '能量', power: '功率', current: '电流', voltage: '电压',
  resistance: '电阻', charge: '电荷', capacitance: '电容', inductance: '电感', magnetic: '磁场',
  pressure: '压强', density: '密度', thermal: '热学', electronic: '半导体/磁学', angle: '角度',
};

function familyZh(f: string): string {
  return FAMILY_ZH[f] ?? f;
}

function dimensionStr(def: NonNullable<ReturnType<typeof tryGetUnitDef>>): string {
  return dimensionToString(def.dim);
}
