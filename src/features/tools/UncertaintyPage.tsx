/** 不确定度传播页（plan §9.4）：课程 ΔY 方和根传播 / GB/T uc 合成 + 有效自由度 + 扩展不确定度 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { compileExpression } from '../../core/expression';
import { propagateUncertainty, gbtCombine, GBTComponent, GBTCorrelationPair } from '../../core/uncertainty';
import { parseNumericText } from '../../core/numeric';
import { formatSigDigitsPercent } from '../../core/sigfig';
import { makeResult, ResultItem } from '../../core/results';
import { useSettings } from '../../stores/settings';
import { Button, EmptyState, Field, FormulaBlock, Notice, Panel, toast } from '../../components/ui';
import { MarkdownBlock, MarkdownInline } from '../../components/Markdown';
import { Tex } from '../../components/katex';
import { QuantityInput } from '../../components/QuantityInput';
import { ResultCard } from '../../components/ResultInspector';
import { useToolDraft } from './use-tool-draft';
import { PayloadBanner } from './PayloadBanner';

type Outcome = { kind: 'ok'; item: ResultItem } | { kind: 'error'; error: string };

/** 相关项每行：变量1 变量2 r（空白或逗号分隔），r ∈ [-1,1] */
const CORRELATION_LINE = /^([A-Za-z_]\w*)[\s,]+([A-Za-z_]\w*)[\s,]+(-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)$/;

interface UncDraft {
  expression: string;
  inputs: Record<string, { raw: string; uncRaw: string }>;
  correlationsText: string;
}

const INITIAL_DRAFT: UncDraft = {
  expression: 'pi/4 * (D^2 - d^2) * h',
  inputs: {},
  correlationsText: '',
};

export function UncertaintyPage() {
  const profile = useSettings((s) => s.activeProfile());
  const isGbt = profile.kind === 'gbt';
  const [draft, setDraft] = useToolDraft<UncDraft>('uncertainty', INITIAL_DRAFT);
  const { expression, inputs, correlationsText } = draft;
  const setExpression = (v: string) => setDraft((d) => ({ ...d, expression: v }));
  const setInputs = (fn: (s: UncDraft['inputs']) => UncDraft['inputs']) => setDraft((d) => ({ ...d, inputs: fn(d.inputs) }));
  const setCorrelationsText = (v: string) => setDraft((d) => ({ ...d, correlationsText: v }));
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [switchNotice, setSwitchNotice] = useState<string | null>(null);

  // 实时解析表达式 → 变量列表 / 语法错误
  const parsed = useMemo(() => {
    try {
      return { compiled: compileExpression(expression) };
    } catch (err) {
      return { error: (err as Error).message };
    }
  }, [expression]);
  const compiled = 'compiled' in parsed ? parsed.compiled : null;
  const exprError = 'error' in parsed ? parsed.error : undefined;
  const variables = compiled?.variables ?? [];

  const previewLatex = useMemo(() => {
    if (!compiled) return null;
    try {
      return compiled.node.toTex({ parenthesis: 'auto' });
    } catch {
      return null;
    }
  }, [compiled]);

  // 输入变化后旧结果失效
  useEffect(() => {
    setOutcome(null);
  }, [expression, inputs, correlationsText]);

  // 标准模式切换：提醒两种模式语义不同、禁止混算，并清空旧结果
  const prevKind = useRef(profile.kind);
  useEffect(() => {
    if (prevKind.current === profile.kind) return;
    prevKind.current = profile.kind;
    setOutcome(null);
    setSwitchNotice(
      profile.kind === 'gbt'
        ? `已切换到 **${profile.shortName}**：不确定度列应填**标准不确定度** $u(x_i)$（误差限半宽需先按分布换算，如矩形分布 $u=a/\\sqrt{3}$），与课程模式的 $\\Delta$（含置信概率）语义不同，**禁止混算**。旧计算结果已清空。`
        : `已切换到 **${profile.shortName}**：不确定度列填课程约定的 $\\Delta X_i$（含置信概率 $P$），与 GB/T 的标准不确定度 $u$ 语义不同，**禁止混算**。旧计算结果已清空。`,
    );
  }, [profile.kind, profile.shortName]);

  const compute = () => {
    if (!compiled) {
      setOutcome({ kind: 'error', error: exprError ?? '表达式有误' });
      return;
    }
    const scope: Record<string, number> = {};
    const uncs: Record<string, number> = {};
    for (const v of variables) {
      const st = inputs[v];
      if (!st || st.raw.trim() === '') {
        setOutcome({ kind: 'error', error: `请填写变量 $${v}$ 的数值` });
        return;
      }
      const p = parseNumericText(st.raw);
      if (!p.ok) {
        setOutcome({ kind: 'error', error: `变量 $${v}$：${p.error}` });
        return;
      }
      scope[v] = p.value;
      if (st.uncRaw.trim() !== '') {
        const u = parseNumericText(st.uncRaw);
        if (!u.ok) {
          setOutcome({ kind: 'error', error: `变量 $${v}$ 的不确定度：${u.error}` });
          return;
        }
        uncs[v] = u.value;
      }
    }
    const correlations: GBTCorrelationPair[] = [];
    if (isGbt) {
      for (const line of correlationsText.split('\n').map((l) => l.trim()).filter(Boolean)) {
        const m = CORRELATION_LINE.exec(line);
        if (!m) {
          setOutcome({ kind: 'error', error: `相关项格式无法识别：\`${line}\`（每行应为「变量1 变量2 r」）` });
          return;
        }
        correlations.push({ i: m[1], j: m[2], r: Number(m[3]) });
      }
    }
    try {
      const prop = propagateUncertainty(
        expression,
        variables.map((v) => ({ symbol: v, value: scope[v], uncertainty: uncs[v] ?? 0 })),
        profile.sigfig,
      );
      const gbt = isGbt
        ? gbtCombine(
            expression,
            variables.map((v): GBTComponent => ({
              symbol: v, estimate: scope[v], standardUncertainty: uncs[v] ?? 0, source: 'B',
            })),
            correlations,
          )
        : null;
      const U95 = gbt ? gbt.expandedForP(0.95) : null;

      const substitution = variables
        .map((v) => `$${v}$ = ${scope[v]}${uncs[v] !== undefined ? ` $\\pm$ ${uncs[v]}` : ''}`)
        .join('，');
      const termLabel = isGbt ? '|c\\,u|' : '|c\\,\\Delta|';
      const sensitivityLines = prop.terms
        .filter((t) => t.contribution > 0)
        .map((t) => `$\\frac{\\partial f}{\\partial ${t.symbol}}$ = ${t.sensitivity.toPrecision(6)}，$${termLabel}$ = ${t.contribution.toPrecision(6)}`)
        .join('\n');
      const covNote = gbt && gbt.covarianceContribution !== 0
        ? `协方差项 $2\\sum c_i c_j\\,u(x_i,x_j)$ = ${gbt.covarianceContribution.toPrecision(6)}`
        : undefined;

      const item = makeResult({
        id: 'propagation',
        title: `\`Y = ${expression}\``,
        symbol: 'Y',
        finalText: gbt && U95 !== null
          ? `$y$ = ${prop.value.toPrecision(8)}，$u_c$ = ${gbt.uc.toPrecision(6)}，$U_{95}$ = ${U95.toPrecision(6)}`
          : prop.formatted.text,
        relativeText: Number.isFinite(prop.relative)
          ? formatSigDigitsPercent(prop.relative, profile.sigfig.relativeDigits)
          : undefined,
        steps: [
          {
            formulaLatex: isGbt
              ? 'u_c^2(y) = \\sum_i c_i^2\\,u^2(x_i) + 2\\sum_{i<j} c_i c_j\\,u(x_i,x_j)'
              : '\\Delta_Y = \\sqrt{\\sum_i \\left(\\frac{\\partial f}{\\partial X_i}\\,\\Delta X_i\\right)^2}',
            substitution,
            unrounded: `$Y$ = ${prop.value.toPrecision(12)}，${isGbt ? '$u_c$' : '$\\Delta_Y$'} = ${(gbt ? gbt.uc : prop.combined).toPrecision(10)}`,
          },
          ...(sensitivityLines || covNote
            ? [{ substitution: sensitivityLines || undefined, note: covNote }]
            : []),
          ...(gbt && U95 !== null
            ? [{
                formulaLatex: 'U_p = t_p(\\nu_{\\mathrm{eff}})\\,u_c',
                substitution: `$\\nu_{\\mathrm{eff}}$ = ${Number.isFinite(gbt.nuEff) ? gbt.nuEff.toPrecision(6) : '$\\infty$'}（Welch–Satterthwaite），取整 $\\nu$ = ${Number.isFinite(gbt.effectiveDof) ? gbt.effectiveDof : '$\\infty$'}`,
                unrounded: `$U_{95}$ = ${U95.toPrecision(10)}${gbt.uc > 0 ? `（$k = t_{0.95}(\\nu_{\\mathrm{eff}})$ ≈ ${(U95 / gbt.uc).toPrecision(4)}）` : ''}`,
              }]
            : []),
        ],
        components: prop.terms
          .filter((t) => t.contribution > 0)
          .map((t) => ({
            symbol: t.symbol,
            label: `灵敏度 ${t.sensitivity.toPrecision(4)}`,
            value: t.contribution,
            fraction: t.fraction,
          })),
        roundingNote: prop.formatted.roundingNote,
        ruleNotes: isGbt
          ? [
              'GB/T：$u(x_i)$ 为**标准不确定度**（一倍标准差）；相关项按 $u(x_i,x_j) = r\\,u(x_i)\\,u(x_j)$ 计入',
              '扩展不确定度必须标明含义：$U_p = t_p(\\nu_{\\mathrm{eff}})\\,u_c$（$\\nu_{\\mathrm{eff}}$ 为 Welch–Satterthwaite 有效自由度）；$u_c$ 与 $U$ 不得用同一模糊 $\\pm$ 表达',
            ]
          : [
              '课程模式：$\\Delta X_i$ 为课程约定的不确定度（含置信概率），默认假设各输入量相互独立',
              '合成不确定度通常保留 2 位有效数字（首位不小于 3 时可取 1 位）；测量值末位与不确定度末位对齐',
            ],
        provenance: {
          status: 'source-explicit',
          document: isGbt ? 'GB/T 27418-2017' : '2026秋物理实验A(1)教学资料',
        },
      });
      setOutcome({ kind: 'ok', item });
      setSwitchNotice(null);
    } catch (err) {
      setOutcome({ kind: 'error', error: (err as Error).message });
    }
  };

  return (
    <>
      <header className="page-head">
        <h1 className="page-title"><MarkdownInline>不确定度与传播</MarkdownInline></h1>
        <div className="page-lead">
          <MarkdownBlock>{`输入 $Y = f(X_1, X_2, \\ldots)$ 表达式，自动符号偏导 → 灵敏度系数 → 各分量贡献 → 合成。当前标准：**${profile.shortName}**。`}</MarkdownBlock>
        </div>
      </header>

      <div className="stack">
        <Notice variant="info" title="两种模式的合成规则">
          <MarkdownBlock>{[
            `**课程模式**（独立输入）：$\\Delta_Y = \\sqrt{\\sum_i \\left(\\frac{\\partial f}{\\partial X_i}\\,\\Delta X_i\\right)^2}$，$\\Delta X_i$ 为课程约定的不确定度（含置信概率）。`,
            `**GB/T 27418-2017**：$u_c^2(y) = \\sum_i c_i^2\\,u^2(x_i)$，$u(x_i)$ 为标准不确定度；输入相关时加入协方差项 $2\\sum_{i<j} c_i c_j\\,u(x_i,x_j)$。`,
            '两种模式的符号与语义不同，**禁止混算**。',
          ].join('\n\n')}</MarkdownBlock>
        </Notice>

        {switchNotice && (
          <Notice variant="warning" title="标准模式已切换">
            <MarkdownBlock>{switchNotice}</MarkdownBlock>
          </Notice>
        )}

        <PayloadBanner
          accept="scalar"
          onAccept={(p) => {
            if (p.kind !== 'scalar') return;
            // 优先按变量名匹配；否则填入第一个数值为空的变量
            const target = variables.includes(p.name)
              ? p.name
              : variables.find((v) => (inputs[v]?.raw ?? '').trim() === '');
            if (!target) {
              toast('没有可填入的变量：请先输入含变量的表达式');
              return;
            }
            setInputs((s) => ({
              ...s,
              [target]: {
                raw: p.valueText,
                uncRaw: p.uncText ?? s[target]?.uncRaw ?? '',
              },
            }));
            toast(`已把 ${p.name} 填入变量 ${target}`);
          }}
        />

        <div className="tool-layout">
          <div className="stack">
            <Panel title="表达式" sub="输入计算关系后，自动列出需要填写的变量">
              <Field
                error={expression.trim() !== '' ? exprError : undefined}
                hint={'支持 `+ - * / ^`、`sqrt/exp/ln/log`、`sin/cos/tan`（弧度）、常量 `pi`、`e`。例如 `x*y` 表示两变量相乘。'}
              >
                <input
                  className="input mono"
                  value={expression}
                  onChange={(e) => setExpression(e.target.value)}
                  placeholder="a*b/(c+d)"
                  aria-label="表达式"
                  spellCheck={false}
                />
              </Field>
            </Panel>

            <Panel
              title="变量与不确定度"
              sub={variables.length > 0 ? `识别到 ${variables.length} 个变量` : undefined}
            >
              {variables.length === 0 ? (
                <EmptyState title="暂无变量" hint="输入合法表达式后自动列出变量" />
              ) : (
                <div className="form-grid">
                  {variables.map((v) => (
                    <QuantityInput
                      key={v}
                      label={<Tex tex={v} />}
                      value={inputs[v]?.raw ?? ''}
                      onChange={(raw) => setInputs((s) => ({ ...s, [v]: { ...(s[v] ?? { uncRaw: '' }), raw } }))}
                      placeholder="数值，如 15.0"
                      extra={
                        <input
                          className="input mono"
                          style={{ marginTop: 6 }}
                          inputMode="decimal"
                          aria-label={`${v} 的不确定度`}
                          placeholder={isGbt ? 'u(x)：标准不确定度' : '± Δx（可选）'}
                          value={inputs[v]?.uncRaw ?? ''}
                          onChange={(e) => setInputs((s) => ({ ...s, [v]: { ...(s[v] ?? { raw: '' }), uncRaw: e.target.value } }))}
                        />
                      }
                    />
                  ))}
                </div>
              )}
              {isGbt && (
                <div className="stack" style={{ marginTop: 12 }}>
                  <Field
                    label="相关项（可选）"
                    hint={'每行一对：`变量1 变量2 r`（空白或逗号分隔），$r$ 为相关系数，$|r| \\le 1$。'}
                  >
                    <textarea
                      className="textarea mono"
                      rows={3}
                      value={correlationsText}
                      onChange={(e) => setCorrelationsText(e.target.value)}
                      placeholder="x1, x2, 0.5"
                      aria-label="相关项"
                    />
                  </Field>
                  <Notice variant="info" title="相关输入（仅 GB/T 模式）">
                    <MarkdownBlock>{'协方差由相关系数给出：$u(x_i,x_j) = r\\,u(x_i)\\,u(x_j)$，合成时加入 $2\\sum c_i c_j\\,u(x_i,x_j)$。课程模式默认输入相互独立，不显示此栏。'}</MarkdownBlock>
                  </Notice>
                </div>
              )}
            </Panel>
          </div>

          <div className="stack">
            <Panel title="公式预览" sub="检查公式是否与预期的计算关系一致">
              {previewLatex ? (
                <FormulaBlock latex={previewLatex} display />
              ) : (
                <EmptyState title="无法预览" hint={exprError ?? '请输入表达式'} />
              )}
            </Panel>
            <Button
              variant="primary"
              onClick={compute}
              disabled={!compiled || variables.length === 0}
              style={{ width: '100%' }}
            >
              计算不确定度传播
            </Button>
            {outcome?.kind === 'error' && (
              <Notice variant="danger" title="计算失败">
                <MarkdownBlock>{outcome.error}</MarkdownBlock>
              </Notice>
            )}
            {outcome?.kind === 'ok' && <ResultCard item={outcome.item} profileName={profile.shortName} />}
            {!outcome && (
              <Panel title="传播结果">
                <EmptyState
                  title="尚未计算"
                  hint={`填写全部变量数值后点击「计算」；不确定度列填 ${isGbt ? '标准不确定度 $u(x_i)$' : '课程约定 $\\Delta X_i$'}（可留空按 0 处理）`}
                />
              </Panel>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
