/** 不确定度传播页（plan §9.4） */
import { useMemo, useState } from 'react';
import { compileExpression } from '../../core/expression';
import { propagateUncertainty, gbtCombine, GBTComponent, GBTCorrelationPair } from '../../core/uncertainty';
import { parseNumericText } from '../../core/numeric';
import { useSettings } from '../../stores/settings';
import { Panel } from '../../components/ui';
import { makeResult } from '../../core/results';
import { ResultCard } from '../../components/ResultInspector';
import { Tex } from '../../components/katex';
import { formatSigDigitsPercent } from '../../core/sigfig';

export function UncertaintyPage() {
  const profile = useSettings((s) => s.activeProfile());
  const [expression, setExpression] = useState('pi/4 * (D^2 - d^2) * h');
  const [inputs, setInputs] = useState<Record<string, { raw: string; uncRaw: string }>>({});
  const [correlationsText, setCorrelationsText] = useState('');

  const variables = useMemo(() => {
    try {
      return compileExpression(expression).variables;
    } catch {
      return [];
    }
  }, [expression]);

  const evaluated = useMemo(() => {
    const scope: Record<string, number> = {};
    const uncs: Record<string, number> = {};
    for (const v of variables) {
      const st = inputs[v];
      if (!st || st.raw.trim() === '') return { incomplete: true as const };
      const p = parseNumericText(st.raw);
      if (!p.ok) return { error: `变量 ${v}：${p.error}` };
      scope[v] = p.value;
      if (st.uncRaw.trim() !== '') {
        const u = parseNumericText(st.uncRaw);
        if (!u.ok) return { error: `变量 ${v} 的不确定度：${u.error}` };
        uncs[v] = u.value;
      }
    }
    const correlations: GBTCorrelationPair[] = [];
    for (const line of correlationsText.split('\n').map((l) => l.trim()).filter(Boolean)) {
      const m = /^(\w+)\s+(\w+)\s+(-?\d*\.?\d+)$/.exec(line);
      if (m) correlations.push({ i: m[1], j: m[2], r: Number(m[3]) });
    }
    try {
      if (profile.kind === 'gbt') {
        const comps: GBTComponent[] = variables.map((v) => ({
          symbol: v, estimate: scope[v], standardUncertainty: uncs[v] ?? 0, source: 'B',
        }));
        const combined = gbtCombine(expression, comps, correlations);
        const prop = propagateUncertainty(
          expression,
          variables.map((v) => ({ symbol: v, value: scope[v], uncertainty: uncs[v] ?? 0 })),
          profile.sigfig,
        );
        return { gbt: combined, prop, scope, uncs };
      }
      const prop = propagateUncertainty(
        expression,
        variables.map((v) => ({ symbol: v, value: scope[v], uncertainty: uncs[v] ?? 0 })),
        profile.sigfig,
      );
      return { prop, scope, uncs };
    } catch (err) {
      return { error: (err as Error).message };
    }
  }, [expression, inputs, profile, variables, correlationsText]);

  const resultItem = useMemo(() => {
    if ('incomplete' in evaluated || 'error' in evaluated) return null;
    const { prop, gbt } = evaluated;
    const substitution = variables
      .map((v) => `${v} = ${evaluated.scope[v]}${evaluated.uncs[v] !== undefined ? ` ± ${evaluated.uncs[v]}` : ''}`)
      .join('，');
    return makeResult({
      id: 'propagation',
      title: `Y = ${expression}`,
      symbol: 'Y',
      finalText: gbt
        ? `y = ${prop.value.toPrecision(8)}，u_c = ${gbt.uc.toPrecision(6)}`
        : prop.formatted.text,
      relativeText: Number.isFinite(prop.relative) ? formatSigDigitsPercent(prop.relative, profile.sigfig.relativeDigits) : undefined,
      steps: [
        {
          formulaLatex: profile.kind === 'gbt'
            ? 'u_c^2(y) = \\sum_i \\left(\\frac{\\partial f}{\\partial x_i} u(x_i)\\right)^2'
            : '\\Delta_Y = \\sqrt{\\sum_i \\left(\\frac{\\partial f}{\\partial x_i}\\Delta_{x_i}\\right)^2}',
          substitution,
          unrounded: `Y = ${prop.value.toPrecision(12)}，${profile.kind === 'gbt' ? 'u_c' : 'ΔY'} = ${(gbt ? gbt.uc : prop.combined).toPrecision(10)}`,
        },
        {
          formulaLatex: '',
          substitution: prop.terms
            .filter((t) => t.contribution > 0)
            .map((t) => `∂f/∂${t.symbol} = ${t.sensitivity.toPrecision(6)}，|c·Δ| = ${t.contribution.toPrecision(6)}`)
            .join('\n'),
          note: gbt && gbt.covarianceContribution !== 0 ? `协方差项 2Σcicj u(xi,xj) = ${gbt.covarianceContribution.toPrecision(6)}` : undefined,
        },
      ],
      components: prop.terms
        .filter((t) => t.contribution > 0)
        .map((t) => ({ symbol: t.symbol, label: `灵敏度 ${t.sensitivity.toPrecision(4)}`, value: t.contribution, fraction: t.fraction })),
      roundingNote: prop.formatted.roundingNote,
      ruleNotes: profile.kind === 'gbt'
        ? ['GB/T：u(xᵢ) 为标准不确定度；相关项按 r·u·u', '需要扩展不确定度请显式乘 k 或 t_p(νeff)']
        : ['课程模式：Δxᵢ 为置信概率意义下的不确定度（独立输入假设）'],
      provenance: {
        status: 'source-explicit',
        document: profile.kind === 'gbt' ? 'GB/T 27418-2017' : '2026秋物理实验A(1)教学资料',
      },
    });
  }, [evaluated, expression, variables, profile]);

  return (
    <main className="page">
      <h1>不确定度传播</h1>
      <p className="muted">输入 Y = f(x₁, x₂, …)，自动符号偏导 → 灵敏度系数 → 贡献 → 合成（当前标准 {profile.shortName}）</p>
      <div className="tool-layout">
        <div className="stack">
          <Panel title="表达式">
            <input
              className="input" style={{ fontFamily: 'var(--mono)' }}
              value={expression} onChange={(e) => setExpression(e.target.value)}
              placeholder="如 pi/4 * (D^2 - d^2) * h"
            />
            <div className="field-help" style={{ marginTop: 4 }}>
              支持 + − * / ^、sqrt/exp/ln/log、sin/cos/tan（弧度）、pi、e。变量名自动识别。<strong>禁止任意 JS 执行</strong>（安全 AST）。
            </div>
            <div className="fc-latex" style={{ marginTop: 8 }}>
              <Tex tex={latexPreview(expression)} display />
            </div>
          </Panel>
          <Panel title="变量与不确定度">
            {variables.length === 0 ? (
              <div className="field-help">输入合法表达式后显示变量</div>
            ) : (
              <div className="form-grid">
                {variables.map((v) => (
                  <div key={v}>
                    <div className="field-label"><Tex tex={v} /></div>
                    <input
                      className="input" placeholder="数值" inputMode="decimal"
                      value={inputs[v]?.raw ?? ''}
                      onChange={(e) => setInputs((s) => ({ ...s, [v]: { ...(s[v] ?? { uncRaw: '' }), raw: e.target.value } }))}
                    />
                    <input
                      className="input" style={{ marginTop: 4 }} inputMode="decimal"
                      placeholder={profile.kind === 'gbt' ? 'u(x)（标准不确定度）' : '± Δx（可选）'}
                      value={inputs[v]?.uncRaw ?? ''}
                      onChange={(e) => setInputs((s) => ({ ...s, [v]: { ...(s[v] ?? { raw: '' }), uncRaw: e.target.value } }))}
                    />
                  </div>
                ))}
              </div>
            )}
            {profile.kind === 'gbt' && (
              <div style={{ marginTop: 10 }}>
                <div className="field-label">相关系数（可选，每行：变量1 变量2 r）</div>
                <textarea className="textarea" rows={3} value={correlationsText} onChange={(e) => setCorrelationsText(e.target.value)} placeholder="x y 0.5" />
              </div>
            )}
            {'error' in evaluated && evaluated.error && (
              <div className="notice notice-danger" style={{ marginTop: 8 }}><span className="n-icon">✕</span><div className="n-body">{evaluated.error}</div></div>
            )}
          </Panel>
        </div>
        <div className="stack">
          {resultItem ? <ResultCard item={resultItem} profileName={profile.shortName} /> : (
            <Panel title="传播结果"><div className="empty-state"><div className="e-icon">∑</div><div>填写全部变量后自动计算</div></div></Panel>
          )}
        </div>
      </div>
    </main>
  );
}

function latexPreview(source: string): string {
  try {
    return compileExpression(source).node.toTex({ parenthesis: 'auto' });
  } catch {
    return '\\text{（表达式有误）}';
  }
}
