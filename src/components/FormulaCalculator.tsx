/**
 * FormulaCalculator — 公式计算器。
 * 选目标变量 → 填数值与单位 → 可选不确定度 → 计算 → 代入过程 + 传播贡献。
 * 求解路径：constants + 变量 scope → expression / solutions[target] / customCompute →
 * （可传播时）propagateUncertainty → formatMeasurement（按当前 profile）。
 * 正确性约定：
 * - 求解目标本身不要求填写；解出其他量时，原式结果量（解式引用，如 UH）自动转为输入字段；
 * - 无显式解式的目标给出明确提示并禁用计算，不输出 NaN 结果卡；
 * - 单位换算失败（量纲不相容/未知单位）字段标红 + 字段级错误 + 阻止计算（AGENTS.md §7）；
 * - 输入值/单位/目标量任一变化即清除上一次结果。
 */
import { useEffect, useMemo, useState } from 'react';
import { FormulaDefinition } from '../formulas/types';
import { compileExpression, evaluateExpression } from '../core/expression';
import { parseNumericText } from '../core/numeric';
import { propagateUncertainty } from '../core/uncertainty';
import { tryGetUnitDef, unitsOfFamily, convert } from '../core/quantity';
import { formatMeasurement } from '../core/sigfig';
import { ResultCard } from './ResultInspector';
import { makeResult, ResultItem } from '../core/results';
import { Tex } from './katex';
import { varSymbolTex } from './varSymbol';
import { useSettings } from '../stores/settings';
import { Badge, Button, CopyButton, Notice, toast } from './ui';
import { MarkdownInline, MarkdownList } from './Markdown';
import { DataGrid } from './DataGrid';
import { buildFormulaProcessMarkdown, downloadTextFile } from '../export';

interface VarState { raw: string; unit: string; uncRaw: string }

interface FieldSpec {
  name: string;
  /** 字段符号的 LaTeX */
  labelTex: string;
  label: string;
  unit: string;
  note?: string;
  isTarget: boolean;
  defaultBadge?: string;
}

export function FormulaCalculator({ formula, resultSymbol, resultUnit, profileName }: {
  formula: FormulaDefinition; resultSymbol: string; resultUnit: string; profileName: string;
}) {
  const profile = useSettings((s) => s.activeProfile());
  const mathStyle = useSettings((s) => s.mathStyle);
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
  const [computed, setComputed] = useState<ResultItem | null>(null);

  const targetVar = target === '__primary__' ? null : target;
  const targetDef = targetVar ? formula.variables.find((v) => v.name === targetVar) : undefined;
  /** 无显式解式的目标：只给提示，不输出 NaN 结果卡 */
  const targetUnsupported = targetVar !== null && !formula.solutions?.[targetVar];

  /** 非主目标求解时，解式会引用原式结果量（如 UH = KH·I·B 中的 UH），补为输入字段 */
  const extraResultInputs = useMemo(() => {
    if (!targetVar || targetUnsupported) return [] as string[];
    const sol = formula.solutions?.[targetVar];
    if (!sol) return [] as string[];
    let needed: string[];
    try {
      needed = compileExpression(sol).variables;
    } catch {
      return [] as string[];
    }
    const known = new Set([
      ...formula.variables.map((v) => v.name),
      ...(formula.constants ?? []).map((c) => c.name),
    ]);
    return needed.filter((n) => !known.has(n));
  }, [formula, targetVar, targetUnsupported]);

  const stateOf = (name: string, fallbackUnit: string): VarState =>
    vars[name] ?? { raw: '', unit: fallbackUnit, uncRaw: '' };

  const patchVar = (name: string, fallbackUnit: string, patch: Partial<VarState>) =>
    setVars((s) => ({
      ...s,
      [name]: { ...(s[name] ?? { raw: '', unit: fallbackUnit, uncRaw: '' }), ...patch },
    }));

  // 输入值、单位、目标量（或修约标准）任一变化时清除上一次结果
  useEffect(() => {
    setComputed(null);
  }, [vars, target, profile.name]);

  const unitOptions = (unit: string): string[] => {
    if (!unit) return [];
    const def = tryGetUnitDef(unit);
    if (!def) return [unit];
    return unitsOfFamily(def.family);
  };

  const targets = useMemo(() => {
    const list: { id: string; label: string }[] = [
      // <option> 只收纯文本：resultSymbol 是 LaTeX，需转 Unicode 纯文本
      { id: '__primary__', label: `${plainSymbol(resultSymbol) || formula.title}（按原式求）` },
    ];
    for (const t of formula.solveFor) {
      const v = formula.variables.find((x) => x.name === t);
      list.push({ id: t, label: `解出 ${t}${v ? `（${v.label}）` : ''}` });
    }
    return list;
  }, [formula, resultSymbol]);

  /** 输入字段清单：变量（排除求解目标）+ 非主目标求解时的原式结果量 */
  const fieldSpecs = useMemo<FieldSpec[]>(() => [
    ...formula.variables.map((v) => ({
      name: v.name,
      labelTex: varSymbolTex(v.name),
      label: v.label,
      unit: v.unit,
      note: v.note,
      isTarget: v.name === targetVar,
      defaultBadge: v.defaultValue !== undefined ? `默认 ${v.defaultValue}` : undefined,
    })),
    ...extraResultInputs.map((n) => ({
      name: n,
      labelTex: resultSymbol || varSymbolTex(n),
      label: '原式结果量（现作输入）',
      unit: resultUnit,
      note: undefined,
      isTarget: false,
      defaultBadge: undefined,
    })),
  ], [formula, targetVar, extraResultInputs, resultSymbol, resultUnit]);

  /** 收集输入（换算到变量默认单位）；单位换算失败记录错误并拒绝按原值计算 */
  const collected = useMemo(() => {
    const inputs: { name: string; value: number; unit: string; uncertainty?: number }[] = [];
    const unitErrors: { name: string; message: string }[] = [];
    for (const spec of fieldSpecs) {
      if (spec.isTarget) continue;
      const st = stateOf(spec.name, spec.unit);
      if (st.raw.trim() === '') continue;
      const p = parseNumericText(st.raw);
      if (!p.ok) continue;
      let value = p.value;
      let uncertainty: number | undefined;
      if (st.uncRaw.trim() !== '') {
        const u = parseNumericText(st.uncRaw);
        if (u.ok) uncertainty = u.value;
      }
      if (st.unit !== spec.unit && st.unit && spec.unit) {
        try {
          value = convert(value, st.unit, spec.unit);
          if (uncertainty !== undefined) uncertainty = convert(uncertainty, st.unit, spec.unit);
        } catch {
          unitErrors.push({
            name: spec.name,
            message: `**${spec.label}**：单位 \`${st.unit}\` 无法换算为 \`${spec.unit}\`（量纲不相容或未知单位），请修正后再计算`,
          });
          continue;
        }
      }
      inputs.push({ name: spec.name, value, unit: spec.unit, uncertainty });
    }
    return { inputs, unitErrors };
  }, [vars, fieldSpecs]);

  const requiredSpecs = fieldSpecs.filter((s) => !s.isTarget);
  const allFilled = requiredSpecs.every((s) => stateOf(s.name, s.unit).raw.trim() !== '');
  const invalidNames = new Set(
    requiredSpecs
      .filter((s) => {
        const raw = stateOf(s.name, s.unit).raw.trim();
        return raw !== '' && !parseNumericText(raw).ok;
      })
      .map((s) => s.name),
  );
  const hasInvalid = invalidNames.size > 0;
  const unitErrorOf = (name: string) => collected.unitErrors.find((e) => e.name === name);
  const blocked = targetUnsupported || collected.unitErrors.length > 0;

  const compute = (): ResultItem | null => {
    if (blocked) return null;
    try {
      const scope: Record<string, number> = {};
      for (const c of formula.constants ?? []) scope[c.name] = c.value;
      for (const i of collected.inputs) scope[i.name] = i.value;

      let expressionSource: string;
      let symbol: string;
      if (targetVar === null) {
        expressionSource = formula.expression;
        symbol = resultSymbol || formula.id;
      } else {
        // blocked 已排除无解式目标，此处必有显式解
        expressionSource = formula.solutions![targetVar];
        symbol = varSymbolTex(targetVar);
      }
      const value =
        formula.customCompute && targetVar === null
          ? formula.customCompute(scope)
          : evaluateExpression(compileExpression(expressionSource), scope);
      if (!Number.isFinite(value)) {
        return makeResult({
          id: 'formula-error', title: '计算失败', finalText: '—',
          warnings: ['求值结果不是有限数值，请检查输入是否满足公式约束'],
          provenance: formula.provenance,
        });
      }

      const withUnc = collected.inputs.filter((i) => i.uncertainty !== undefined && i.uncertainty > 0);
      let propagation: ReturnType<typeof propagateUncertainty> | null = null;
      if (withUnc.length > 0 && formula.uncertainty?.propagatable) {
        try {
          propagation = propagateUncertainty(
            expressionSource,
            withUnc.map((i) => ({ symbol: i.name, value: i.value, uncertainty: i.uncertainty! })),
            profile.sigfig,
          );
        } catch { /* 传播失败不影响主结果 */ }
      }

      const substitution = collected.inputs
        .map((i) => `${i.name}=${formatFull(i.value)}${i.unit ? ` ${i.unit}` : ''}`)
        .join('，');
      const formatted = formatMeasurement(value, propagation?.combined ?? 0, { ...profile.sigfig });

      return makeResult({
        id: 'formula-result',
        title: formula.title,
        symbol: symbol,
        unit: resultUnit,
        finalText: propagation ? formatted.text : formatNum(value),
        relativeText: propagation && propagation.relative ? `${(propagation.relative * 100).toPrecision(3)}%` : undefined,
        steps: [
          { formulaLatex: formula.latex, substitution, unrounded: formatFull(value) },
        ],
        components: propagation?.terms
          .filter((t) => t.contribution > 0)
          .map((t) => ({
            symbol: varSymbolTex(t.symbol), label: `灵敏度 $c=${formatFull(t.sensitivity)}$`,
            value: t.contribution, fraction: t.fraction,
          })),
        roundingNote: formatted.roundingNote,
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

  /** 复制最终表达：符号 = 已修约值 ± 不确定度（科学记数转上标）+ 单位 */
  const buildFinalCopyText = (): string => {
    if (!computed || computed.id !== 'formula-result') return '';
    const sym = plainSymbol(computed.symbol ?? '');
    const base = toUnicodeExponent(computed.finalText ?? '');
    const unit = computed.unit ? ` ${prettyUnit(computed.unit)}` : '';
    return `${sym} = ${base}${unit}`;
  };

  /** 完整过程 Markdown：公式 → 代入 → 未修约 → 修约 → 最终表达（AGENTS §12） */
  const buildProcessMarkdown = (): string => {
    if (!computed) return '';
    return buildFormulaProcessMarkdown(formula, computed, { profileName, mathStyle });
  };

  /** 列聚合派生值填回输入框（保留完整精度文本，不修约） */
  const fillAggregates = (values: Record<string, number>) => {
    setVars((s) => {
      const next = { ...s };
      for (const [k, v] of Object.entries(values)) {
        const unit = formula.variables.find((x) => x.name === k)?.unit ?? '';
        next[k] = { ...(next[k] ?? { raw: '', unit, uncRaw: '' }), raw: formatAggValue(v) };
      }
      return next;
    });
    toast(`已填入 ${Object.keys(values).join('、')}`);
  };

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
        {targetVar && (
          <Badge variant="accent">
            {`求解目标：$${varSymbolTex(targetVar)}$${targetDef ? `（${targetDef.label}）` : ''}`}
          </Badge>
        )}
      </div>
      {targetUnsupported && (
        <div style={{ margin: '0 0 10px' }}>
          <Notice variant="danger" title="暂不支持该求解目标">
            <MarkdownInline>{`该公式暂不支持解出 $${varSymbolTex(targetVar ?? '')}$，可换选其他目标量。`}</MarkdownInline>
          </Notice>
        </div>
      )}
      {collected.unitErrors.length > 0 && (
        <div style={{ margin: '0 0 10px' }}>
          <Notice variant="danger" title="单位换算失败，已阻止计算">
            <MarkdownList items={collected.unitErrors.map((e) => e.message)} />
          </Notice>
        </div>
      )}
      {formula.aggregates && (
        <AggregatePanel formula={formula} onFill={fillAggregates} />
      )}
      <div className="form-grid">
        {fieldSpecs.map((spec) => {
          const st = stateOf(spec.name, spec.unit);
          const options = unitOptions(spec.unit);
          const unitError = unitErrorOf(spec.name);
          const parseInvalid = invalidNames.has(spec.name);
          return (
            <div key={spec.name} className="field">
              <div className="field-label">
                <Tex tex={spec.labelTex} />
                <span><MarkdownInline>{spec.label}</MarkdownInline></span>
                {spec.defaultBadge && <Badge variant="default">{spec.defaultBadge}</Badge>}
                {spec.isTarget && <Badge variant="accent">求解目标</Badge>}
              </div>
              {spec.isTarget ? (
                <div className="field-help">
                  <MarkdownInline>{'该量为**求解目标**，无需填写；由其余输入量解出。'}</MarkdownInline>
                </div>
              ) : (
                <>
                  <div className="input-unit">
                    <input
                      className={`input${unitError || parseInvalid ? ' invalid' : ''}`}
                      value={st.raw}
                      placeholder={spec.unit ? `按 ${spec.unit} 输入` : '数值'}
                      inputMode="decimal"
                      onChange={(e) => patchVar(spec.name, spec.unit, { raw: e.target.value })}
                    />
                    {options.length > 1 ? (
                      <select
                        className="select"
                        value={st.unit}
                        onChange={(e) => patchVar(spec.name, spec.unit, { unit: e.target.value })}
                        aria-label={`${spec.label}单位`}
                      >
                        {options.map((u) => <option key={u} value={u}>{u}</option>)}
                      </select>
                    ) : spec.unit ? <span className="unit-chip"><MarkdownInline>{spec.unit}</MarkdownInline></span> : null}
                  </div>
                  {unitError && (
                    <div className="field-error"><MarkdownInline>{unitError.message}</MarkdownInline></div>
                  )}
                  {!unitError && parseInvalid && (
                    <div className="field-error"><MarkdownInline>无法解析为数值</MarkdownInline></div>
                  )}
                  {spec.note && <div className="field-help"><MarkdownInline>{spec.note}</MarkdownInline></div>}
                  {showUnc && (
                    <input
                      className="input"
                      placeholder={`不确定度 ±（${spec.unit || '同输入'}，可选）`}
                      value={st.uncRaw}
                      inputMode="decimal"
                      onChange={(e) => patchVar(spec.name, spec.unit, { uncRaw: e.target.value })}
                    />
                  )}
                </>
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
        <Button variant="primary" onClick={() => setComputed(compute())} disabled={!allFilled || hasInvalid || blocked}>
          计算
        </Button>
        {!allFilled && <span className="small muted"><MarkdownInline>请填写除求解目标外的全部输入量</MarkdownInline></span>}
        {hasInvalid && <span className="small" style={{ color: 'var(--danger)' }}><MarkdownInline>存在非法数值输入</MarkdownInline></span>}
      </div>
      {computed && (
        <>
          <ResultCard item={computed} profileName={profileName} />
          {computed.id === 'formula-result' && (
            <div className="row-right" style={{ marginTop: 6 }}>
              <CopyButton text={buildFinalCopyText} label="复制最终表达" />
              <CopyButton text={buildProcessMarkdown} label="复制完整过程 Markdown" />
              <Button
                size="sm"
                icon="download"
                onClick={() => {
                  downloadTextFile(`${formula.id}-计算过程.md`, buildProcessMarkdown());
                  toast('已开始下载');
                }}
              >下载 .md</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** 列聚合输入面板：粘贴原始数据列 → 派生公式变量（如 S、n），拒绝让用户手工求和 */
function AggregatePanel({ formula, onFill }: {
  formula: FormulaDefinition;
  onFill: (values: Record<string, number>) => void;
}) {
  const agg = formula.aggregates!;
  const [rows, setRows] = useState<string[][]>(() =>
    Array.from({ length: 8 }, () => agg.columns.map(() => '')));

  /** 逐行配对解析：任一列空缺/非法则整行跳过（不篡改输入） */
  const parsedCols = useMemo(() => {
    const cols: number[][] = agg.columns.map(() => []);
    for (const row of rows) {
      const cells: number[] = [];
      let ok = true;
      agg.columns.forEach((_, j) => {
        const raw = (row[j] ?? '').trim();
        if (raw === '') { ok = false; return; }
        const p = parseNumericText(raw);
        if (!p.ok) { ok = false; return; }
        cells.push(p.value);
      });
      if (ok) cells.forEach((v, j) => cols[j].push(v));
    }
    return cols;
  }, [rows, agg]);

  const derived = useMemo(() => {
    try {
      return agg.derive(parsedCols);
    } catch {
      return null;
    }
  }, [agg, parsedCols]);

  return (
    <details className="fold agg-panel" open>
      <summary><MarkdownInline>{`从数据列自动计算（不必手工求和）`}</MarkdownInline></summary>
      <div className="fold-body">
        <div className="small muted" style={{ margin: '2px 0 8px' }}><MarkdownInline>{agg.note}</MarkdownInline></div>
        <DataGrid
          columns={agg.columns.map((c) => ({ id: c.id, header: c.label }))}
          rows={rows}
          onChange={setRows}
          defaultRows={8}
          hint="从 Excel 粘贴整列；空缺或非法行自动跳过，不参与派生"
        />
        {derived ? (
          <div className="row" style={{ marginTop: 8, flexWrap: 'wrap', gap: 8 }}>
            {Object.entries(derived).map(([k, v]) => (
              <Badge key={k} variant="info">{`${k} = ${formatAggValue(v)}`}</Badge>
            ))}
            <Button size="sm" variant="primary" icon="arrow-right" onClick={() => onFill(derived)}>填入输入框</Button>
          </div>
        ) : (
          <div className="small muted" style={{ marginTop: 8 }}><MarkdownInline>有效数据行不足，继续输入后此处自动给出派生值</MarkdownInline></div>
        )}
      </div>
    </details>
  );
}

/** 派生值 → 输入框文本：整数原样，其余保留 12 位有效数字（完整精度，不修约语义） */
function formatAggValue(v: number): string {
  if (!Number.isFinite(v)) return String(v);
  if (Number.isInteger(v)) return String(v);
  return String(Number(v.toPrecision(12)));
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

/** LaTeX 符号 → 纯文本（希腊字母转 Unicode，去掉分组括号） */
function plainSymbol(texSym: string): string {
  const greek: Record<string, string> = {
    alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', zeta: 'ζ',
    eta: 'η', theta: 'θ', iota: 'ι', kappa: 'κ', lambda: 'λ', mu: 'μ',
    nu: 'ν', xi: 'ξ', pi: 'π', rho: 'ρ', sigma: 'σ', tau: 'τ',
    phi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω',
    Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ', Pi: 'Π',
    Sigma: 'Σ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
  };
  return texSym
    .replace(/\\mathrm\{([^}]*)\}/g, '$1')
    .replace(/\\bar\{([^}]*)\}/g, '$1̄')
    .replace(/\\([A-Za-z]+)/g, (m, name: string) => greek[name] ?? name)
    .replace(/[{}]/g, '')
    .trim();
}

const SUPERSCRIPT: Record<string, string> = {
  '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
  '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
};

/** `× 10^-3` → `× 10⁻³`（纯文本上标） */
function toUnicodeExponent(text: string): string {
  return text.replace(/× 10\^(-?\d+)/g, (_m, exp: string) =>
    `× 10${[...exp].map((c) => SUPERSCRIPT[c] ?? c).join('')}`);
}

/** 单位串中的幂次转 Unicode 上标：m3/C → m³/C，m-3 → m⁻³ */
function prettyUnit(unit: string): string {
  return unit.replace(/(-?\d+)/g, (m) => [...m].map((c) => SUPERSCRIPT[c] ?? c).join(''));
}
