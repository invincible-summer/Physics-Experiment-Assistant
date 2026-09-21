/**
 * FormulaCalculator — 公式计算器。
 * 选目标变量 → 填数值与单位 → 可选不确定度 → 计算 → 代入过程 + 传播贡献。
 * 求解路径：constants + 变量 scope → expression / solutions[target] / customCompute →
 * （可传播时）propagateUncertainty → formatMeasurement（按当前 profile）。
 */
import { useMemo, useState } from 'react';
import { FormulaDefinition } from '../formulas/types';
import { compileExpression, evaluateExpression } from '../core/expression';
import { parseNumericText } from '../core/numeric';
import { propagateUncertainty } from '../core/uncertainty';
import { tryGetUnitDef, unitsOfFamily, convert } from '../core/quantity';
import { formatMeasurement } from '../core/sigfig';
import { ResultCard } from './ResultInspector';
import { makeResult } from '../core/results';
import { Tex } from './katex';
import { useSettings } from '../stores/settings';
import { Badge, Button, Notice } from './ui';
import { MarkdownInline } from './Markdown';

interface VarState { raw: string; unit: string; uncRaw: string }

export function FormulaCalculator({ formula, resultSymbol, resultUnit, profileName }: {
  formula: FormulaDefinition; resultSymbol: string; resultUnit: string; profileName: string;
}) {
  const profile = useSettings((s) => s.activeProfile());
  const [target, setTarget] = useState<string>('__primary__');
  const [vars, setVars] = useState<Record<string, VarState>>(() => {
    const init: Record<string, VarState> = {};
    for (const v of formula.variables) {
      init[v.name] = {
        raw: v.defaultValue !== undefined ? String(v.defaultValue) : '',
        unit: v.unit,
        uncRaw: '',
      };
    }
    return init;
  });

  const unitOptions = (unit: string): string[] => {
    if (!unit) return [];
    const def = tryGetUnitDef(unit);
    if (!def) return [unit];
    return unitsOfFamily(def.family);
  };

  const targets = useMemo(() => {
    const list: { id: string; label: string }[] = [
      { id: '__primary__', label: `${resultSymbol || formula.title}（按原式求）` },
    ];
    for (const t of formula.solveFor) {
      const v = formula.variables.find((x) => x.name === t);
      list.push({ id: t, label: `解出 ${t}${v ? `（${v.label}）` : ''}` });
    }
    return list;
  }, [formula, resultSymbol]);

  /** 收集输入（换算到变量默认单位） */
  const inputs = useMemo(() => {
    const out: { name: string; value: number; unit: string; uncertainty?: number }[] = [];
    for (const v of formula.variables) {
      const st = vars[v.name];
      if (!st || st.raw.trim() === '') continue;
      const p = parseNumericText(st.raw);
      if (!p.ok) continue;
      let value = p.value;
      if (st.unit !== v.unit && st.unit && v.unit) {
        try { value = convert(p.value, st.unit, v.unit); } catch { /* 量纲不兼容时按原值 */ }
      }
      let uncertainty: number | undefined;
      if (st.uncRaw.trim() !== '') {
        const u = parseNumericText(st.uncRaw);
        if (u.ok) {
          uncertainty = u.value;
          if (st.unit !== v.unit && st.unit && v.unit) {
            try { uncertainty = convert(u.value, st.unit, v.unit); } catch { /* 原值 */ }
          }
        }
      }
      out.push({ name: v.name, value, unit: v.unit, uncertainty });
    }
    return out;
  }, [vars, formula]);

  const allFilled = formula.variables.every((v) => vars[v.name]?.raw.trim() !== '');
  const hasInvalid = formula.variables.some((v) => {
    const raw = vars[v.name]?.raw.trim() ?? '';
    return raw !== '' && !parseNumericText(raw).ok;
  });

  const compute = () => {
    try {
      const scope: Record<string, number> = {};
      for (const c of formula.constants ?? []) scope[c.name] = c.value;
      for (const i of inputs) scope[i.name] = i.value;

      let expressionSource: string;
      let symbol: string;
      if (target === '__primary__') {
        expressionSource = formula.expression;
        symbol = resultSymbol || formula.id;
      } else if (formula.solutions?.[target]) {
        expressionSource = formula.solutions[target];
        symbol = target;
      } else {
        expressionSource = formula.expression;
        symbol = target;
      }
      let value: number;
      if (target !== '__primary__' && !formula.solutions?.[target]) {
        value = NaN;
      } else if (formula.customCompute && target === '__primary__') {
        value = formula.customCompute(scope);
      } else {
        const compiled = compileExpression(expressionSource);
        value = evaluateExpression(compiled, scope);
        if (!Number.isFinite(value) && target !== '__primary__') {
          value = NaN;
        }
      }

      const withUnc = inputs.filter((i) => i.uncertainty !== undefined && i.uncertainty > 0);
      let propagation: ReturnType<typeof propagateUncertainty> | null = null;
      if (withUnc.length > 0 && formula.uncertainty?.propagatable) {
        try {
          propagation = propagateUncertainty(
            expressionSource,
            inputs
              .filter((i) => i.uncertainty !== undefined)
              .map((i) => ({ symbol: i.name, value: i.value, uncertainty: i.uncertainty! })),
            profile.sigfig,
          );
        } catch { /* 传播失败不影响主结果 */ }
      }

      const substitution = inputs
        .map((i) => `${i.name}=${formatFull(i.value)}${i.unit ? ` ${i.unit}` : ''}`)
        .join('，');
      const formatted = Number.isFinite(value)
        ? formatMeasurement(value, propagation?.combined ?? 0, { ...profile.sigfig })
        : null;

      return makeResult({
        id: 'formula-result',
        title: formula.title,
        symbol: symbol,
        unit: resultUnit,
        finalText: propagation
          ? `${formatNum(formatted?.value ?? value)} ± ${formatNum(formatted?.uncertainty ?? propagation.combined)}`
          : formatNum(value),
        relativeText: propagation && propagation.relative ? `${(propagation.relative * 100).toPrecision(3)}%` : undefined,
        steps: [
          { formulaLatex: formula.latex, substitution, unrounded: formatFull(value) },
        ],
        components: propagation?.terms
          .filter((t) => t.contribution > 0)
          .map((t) => ({
            symbol: t.symbol, label: `灵敏度 $c=${formatFull(t.sensitivity)}$`,
            value: t.contribution, fraction: t.fraction,
          })),
        roundingNote: formatted?.roundingNote,
        ruleNotes: [`${profile.name}：${profile.kind === 'gbt' ? 'GB/T 模式（$u$ 为标准不确定度）' : '课程模式（$\\Delta$ 为置信概率意义下的不确定度）'}`],
        provenance: formula.provenance,
      });
    } catch (err) {
      return makeResult({
        id: 'formula-error', title: '计算失败', finalText: '—',
        warnings: [(err as Error).message], provenance: formula.provenance,
      });
    }
  };

  const [computed, setComputed] = useState<ReturnType<typeof compute> | null>(null);
  const showUnc = formula.uncertainty?.propagatable === true;

  return (
    <div>
      <div className="row" style={{ margin: '4px 0 12px' }}>
        <span className="field-label" style={{ margin: 0 }}><MarkdownInline>求哪个量</MarkdownInline></span>
        <select
          className="select"
          style={{ maxWidth: 320 }}
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          aria-label="求解目标量"
        >
          {targets.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
      </div>
      <div className="form-grid">
        {formula.variables.map((v) => {
          const st = vars[v.name];
          const options = unitOptions(v.unit);
          return (
            <div key={v.name} className="field">
              <div className="field-label">
                <Tex tex={v.name} />
                <span><MarkdownInline>{v.label}</MarkdownInline></span>
                {v.defaultValue !== undefined && (
                  <Badge variant="default">{`默认 ${v.defaultValue}`}</Badge>
                )}
              </div>
              <div className="input-unit">
                <input
                  className="input"
                  value={st?.raw ?? ''}
                  placeholder={v.unit ? `按 ${v.unit} 输入` : '数值'}
                  inputMode="decimal"
                  onChange={(e) => setVars((s) => ({ ...s, [v.name]: { ...st, raw: e.target.value } }))}
                />
                {options.length > 1 && st ? (
                  <select
                    className="select"
                    value={st.unit}
                    onChange={(e) => setVars((s) => ({ ...s, [v.name]: { ...st, unit: e.target.value } }))}
                    aria-label={`${v.label}单位`}
                  >
                    {options.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                ) : v.unit ? <span className="unit-chip"><MarkdownInline>{v.unit}</MarkdownInline></span> : null}
              </div>
              {v.note && <div className="field-help"><MarkdownInline>{v.note}</MarkdownInline></div>}
              {showUnc && (
                <input
                  className="input"
                  placeholder={`不确定度 ±（${v.unit || '同输入'}，可选）`}
                  value={st?.uncRaw ?? ''}
                  inputMode="decimal"
                  onChange={(e) => setVars((s) => ({ ...s, [v.name]: { ...st, uncRaw: e.target.value } }))}
                />
              )}
            </div>
          );
        })}
      </div>
      {(formula.constants ?? []).length > 0 && (
        <div className="small muted" style={{ marginTop: 8 }}>
          <MarkdownInline>{`**常数：**${(formula.constants ?? []).map((c) => `${c.label} = ${c.value}${c.unit ? ` ${c.unit}` : ''}${c.isExact ? '（精确）' : ''}`).join('；')}`}</MarkdownInline>
        </div>
      )}
      {formula.conditions && (
        <div style={{ marginTop: 8 }}>
          <Notice variant="info"><MarkdownInline>{formula.conditions}</MarkdownInline></Notice>
        </div>
      )}
      <div className="row" style={{ margin: '12px 0' }}>
        <Button variant="primary" onClick={() => setComputed(compute())} disabled={!allFilled || hasInvalid}>
          计算
        </Button>
        {!allFilled && <span className="small muted"><MarkdownInline>请填写全部变量</MarkdownInline></span>}
        {hasInvalid && <span className="small" style={{ color: 'var(--danger)' }}><MarkdownInline>存在非法数值输入</MarkdownInline></span>}
      </div>
      {computed && <ResultCard item={computed} profileName={profileName} />}
    </div>
  );
}

function formatNum(v: number): string {
  if (!Number.isFinite(v)) return '—';
  if (v === 0) return '0';
  const a = Math.abs(v);
  if (a >= 1e6 || a < 1e-4) return v.toExponential(4);
  return Number(v.toPrecision(6)).toString();
}

function formatFull(v: number): string {
  if (!Number.isFinite(v)) return '—';
  return String(v);
}
