/** 快速统计页（plan §9.1） */
import { useMemo, useState } from 'react';
import { ColumnInput } from './tool-inputs';
import {
  mean, median, sampleStd, stdErrorOfMean, minOf, maxOf, rangeOf, halfRange, covariance, correlation,
} from '../../core/statistics';
import { courseDirect, gbtDirect } from '../../core/uncertainty';
import { useSettings } from '../../stores/settings';
import { ResultCard } from '../../components/ResultInspector';
import { makeResult } from '../../core/results';
import { Panel } from '../../components/ui';
import { formatSigDigitsPercent } from '../../core/sigfig';
import { MarkdownInline } from '../../components/Markdown';

export function StatisticsPage() {
  const profile = useSettings((s) => s.activeProfile());
  const profileName = profile.shortName;
  const [values, setValues] = useState<number[]>([]);
  const [instrumentError, setInstrumentError] = useState('');
  const [correction, setCorrection] = useState('');

  const stats = useMemo(() => {
    if (values.length === 0) return null;
    const n = values.length;
    const base = {
      n,
      mean: mean(values),
      median: median(values),
      min: minOf(values),
      max: maxOf(values),
      range: rangeOf(values),
      halfRange: halfRange(values),
    };
    if (n < 2) return { ...base, sampleStd: NaN, sem: NaN };
    return { ...base, sampleStd: sampleStd(values), sem: stdErrorOfMean(values) };
  }, [values]);

  const dInst = instrumentError.trim() === '' ? undefined : Number(instrumentError);
  const corr = correction.trim() === '' ? 0 : Number(correction);

  const uncertaintyResult = useMemo(() => {
    if (values.length === 0 || dInst === undefined || !Number.isFinite(dInst)) return null;
    try {
      return profile.kind === 'gbt'
        ? gbtDirect({ readings: values, instrumentError: dInst, correction: corr, distribution: 'rectangular' }, profile)
        : courseDirect({ readings: values, instrumentError: dInst, correction: corr }, profile);
    } catch (err) {
      return { error: (err as Error).message } as { error: string };
    }
  }, [values, dInst, corr, profile]);

  const resultItem = useMemo(() => {
    if (!uncertaintyResult || 'error' in uncertaintyResult) return null;
    const r = uncertaintyResult;
    return makeResult({
      id: 'direct-uncertainty',
      title: '直接测量不确定度（当前标准）',
      symbol: profile.notation.combined,
      finalText: r.formatted.text,
      relativeText: Number.isFinite(r.relative) ? formatSigDigitsPercent(r.relative, profile.sigfig.relativeDigits) : undefined,
      steps: [
        {
          formulaLatex: profile.kind === 'gbt'
            ? 'u_A = \\frac{S}{\\sqrt{n}},\\quad u_B = \\frac{a}{\\sqrt{3}},\\quad u_c = \\sqrt{u_A^2 + u_B^2}'
            : '\\Delta_A = t_{0.95}(\\nu)\\frac{S}{\\sqrt{n}},\\quad \\Delta_B = \\Delta_{仪},\\quad \\Delta = \\sqrt{\\Delta_A^2 + \\Delta_B^2}',
          substitution: `n=${r.n}，S=${r.sampleStd.toPrecision(6)}，${profile.kind === 'gbt' ? 'u_A' : 'ΔA'}=${r.typeA.toPrecision(6)}，${profile.kind === 'gbt' ? 'u_B' : 'ΔB'}=${r.typeB.toPrecision(6)}`,
          unrounded: `${profile.notation.combined} = ${r.combined.toPrecision(10)}`,
        },
      ],
      components: r.components.map((c) => ({ symbol: c.symbol, label: c.label, value: c.value, substitution: c.substitution })),
      roundingNote: r.formatted.roundingNote,
      ruleNotes: r.ruleNotes,
      provenance: {
        status: 'source-explicit',
        document: profile.kind === 'gbt' ? 'GB/T 27418-2017' : '2026秋物理实验A(1)教学资料',
      },
    });
  }, [uncertaintyResult, profile]);

  return (
    <main className="page">
      <h1><MarkdownInline>快速统计</MarkdownInline></h1>
      <p className="muted"><MarkdownInline>{`粘贴一列数据，得到统计量与当前标准（**${profileName}**）下的直接测量不确定度`}</MarkdownInline></p>
      <div className="tool-layout">
        <div className="stack">
          <Panel title="数据">
            <ColumnInput label="测量列" onChange={setValues} />
          </Panel>
          <Panel title="统计结果">
            {!stats ? (
              <div className="empty-state"><div><MarkdownInline>等待数据输入</MarkdownInline></div></div>
            ) : (
              <table className="contrib-table">
                <tbody>
                  <StatRow label="n" value={stats.n} />
                  <StatRow label="平均值 x̄" value={stats.mean} />
                  <StatRow label="中位数（通用扩展）" value={stats.median} />
                  <StatRow label="样本标准偏差 S（贝塞尔）" value={stats.sampleStd} />
                  <StatRow label="平均值标准偏差 S_x̄" value={stats.sem} />
                  <StatRow label="最小值" value={stats.min} />
                  <StatRow label="最大值" value={stats.max} />
                  <StatRow label="极差" value={stats.range} />
                  <StatRow label="半极差" value={stats.halfRange} />
                </tbody>
              </table>
            )}
          </Panel>
        </div>
        <div className="stack">
          <Panel title={`不确定度（${profileName}）`}>
            <div className="form-grid">
              <div>
                <div className="field-label"><MarkdownInline>{`仪器误差限 ${profile.kind === 'gbt' ? '（B 类半宽 a，默认矩形分布）' : 'Δ仪'}`}</MarkdownInline></div>
                <input className="input" value={instrumentError} inputMode="decimal" placeholder="如 0.02" onChange={(e) => setInstrumentError(e.target.value)} />
              </div>
              <div>
                <div className="field-label"><MarkdownInline>已定系统误差修正值（可选）</MarkdownInline></div>
                <input className="input" value={correction} inputMode="decimal" placeholder="如 -0.01" onChange={(e) => setCorrection(e.target.value)} />
              </div>
            </div>
            {uncertaintyResult && 'error' in uncertaintyResult ? (
              <div className="notice notice-danger"><div className="n-body"><MarkdownInline>{uncertaintyResult.error}</MarkdownInline></div></div>
            ) : resultItem ? (
              <ResultCard item={resultItem} profileName={profileName} />
            ) : (
              <div className="field-help" style={{ marginTop: 8 }}><MarkdownInline>填写仪器误差限后计算</MarkdownInline></div>
            )}
          </Panel>
          {profile.kind === 'gbt' && (
            <div className="notice notice-info">
              <div className="n-body"><MarkdownInline>GB/T 模式：A 类不加 `t` 因子；B 类默认按矩形分布换算 `a/√3`。如需三角/正态分布请用公式工作台的 GB/T 公式族。</MarkdownInline></div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function StatRow({ label, value }: { label: string; value: number }) {
  return (
    <tr>
      <td><MarkdownInline>{label}</MarkdownInline></td>
      <td className="num">{Number.isFinite(value) ? value.toPrecision(8).replace(/\.?0+$/, '') : '—'}</td>
    </tr>
  );
}
