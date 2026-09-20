/** QuantityInput — 数值+单位输入（保留原始文本与有效数字元数据） */
import { ReactNode, useMemo } from 'react';
import { parseNumericText } from '../core/numeric';
import { tryGetUnitDef, unitsOfFamily, sameDimension } from '../core/quantity';
import { MarkdownInline, markdownInlineNode } from './Markdown';

export interface QuantityInputProps {
  label?: ReactNode;
  value: string;
  onChange: (rawText: string) => void;
  unit?: string;
  onUnitChange?: (unit: string) => void;
  /** 单位族（下拉列表来源） */
  unitFamily?: string;
  hint?: string;
  errorHint?: boolean;
  placeholder?: string;
  /** 附加内容（如不确定度输入） */
  extra?: ReactNode;
}

export function QuantityInput({ label, value, onChange, unit, onUnitChange, unitFamily, hint, errorHint, placeholder, extra }: QuantityInputProps) {
  const parsed = useMemo(() => parseNumericText(value), [value]);
  const unitOptions = useMemo(() => (unitFamily ? unitsOfFamily(unitFamily) : []), [unitFamily]);
  const invalid = errorHint !== false && value.trim() !== '' && !parsed.ok;
  return (
    <div>
      {label && <div className="field-label">{markdownInlineNode(label)}</div>}
      <div className="input-unit">
        <input
          className={`input${invalid ? ' invalid' : ''}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? '如 15.0'}
          inputMode="decimal"
        />
        {unit !== undefined && onUnitChange && unitFamily && unitOptions.length > 0 ? (
          <select
            className="select"
            style={{ maxWidth: 96 }}
            value={unit}
            onChange={(e) => onUnitChange(e.target.value)}
          >
            {unitOptions.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        ) : unit !== undefined ? (
          <span className="unit-chip"><MarkdownInline>{unit}</MarkdownInline></span>
        ) : null}
      </div>
      {invalid && <div className="field-error"><MarkdownInline>{parsed.error}</MarkdownInline></div>}
      {!invalid && hint && <div className="field-help"><MarkdownInline>{hint}</MarkdownInline></div>}
      {extra}
    </div>
  );
}

/** 单位换算下拉时校验同量纲 */
export function isUnitCompatible(from: string, to: string): boolean {
  if (from === to) return true;
  const a = tryGetUnitDef(from);
  const b = tryGetUnitDef(to);
  if (!a || !b) return false;
  return sameDimension(from, to);
}
