/** 快速统计页（plan §9.1） */
import { useMemo, useState } from 'react';
import { ColumnInput } from './tool-inputs';
import {
  mean, median, sampleStd, stdErrorOfMean, minOf, maxOf, rangeOf, halfRange,
} from '../../core/statistics';
import { courseDirect, gbtDirect } from '../../core/uncertainty';
import { useSettings } from '../../stores/settings';
import { ResultCard } from '../../components/ResultInspector';
import { makeResult } from '../../core/results';
import { EmptyState, Notice, Panel } from '../../components/ui';
import { QuantityInput } from '../../components/QuantityInput';
import { formatSigDigitsPercent } from '../../core/sigfig';
import { MarkdownBlock, MarkdownInline } from '../../components/Markdown';

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
    <div className="stack-lg">
      <header className="page-head">
        <h1 className="page-title"><MarkdownInline>快速统计</MarkdownInline></h1>
        <p className="page-lead">
          <MarkdownInline>{`粘贴一列数据，得到统计量与当前标准（**${profileName}**）下的直接测量不确定度`}</MarkdownInline>
        </p>
      </header>
      <div className="tool-layout">
        <Panel title="数据输入" sub="测量列与不确定度输入参数">
          <div className="stack">
            <ColumnInput label="测量列" placeholder="每行一个数值" onChange={setValues} />
            <QuantityInput
              label={profile.kind === 'gbt' ? 'B 类半宽 $a$（默认矩形分布）' : '仪器误差限 $\\Delta_{仪}$'}
              value={instrumentError}
              onChange={setInstrumentError}
              placeholder="如 0.02"
              hint={profile.kind === 'gbt'
                ? '矩形分布半宽 $a$，如 0.02，单位与数据相同；按 $u_B=a/\\sqrt{3}$ 换算'
                : '$\\Delta_{仪}$，如 0.02，单位与数据相同'}
            />
            <QuantityInput
              label="已定系统误差修正值（可选）"
              value={correction}
              onChange={setCorrection}
              placeholder="如 -0.01"
              hint={'可为空；已定系统误差先修正再报告：$\\bar{x}_{\\text{修正}}=\\bar{x}+c$'}
            />
          </div>
        </Panel>
        <div className="stack">
          <Panel title="统计量">
            {!stats ? (
              <EmptyState title="等待数据输入" hint="在左侧粘贴测量列后自动计算" />
            ) : (
              <table className="stat-table">
                <tbody>
                  <StatRow label="$n$" value={stats.n} />
                  <StatRow label={'平均值 $\\bar{x}$'} value={stats.mean} />
                  <StatRow label="中位数（通用扩展）" value={stats.median} />
                  <StatRow label="样本标准偏差 $S$（贝塞尔）" value={stats.sampleStd} />
                  <StatRow label={'平均值标准偏差 $S_{\\bar{x}}$'} value={stats.sem} />
                  <StatRow label="最小值" value={stats.min} />
                  <StatRow label="最大值" value={stats.max} />
                  <StatRow label="极差" value={stats.range} />
                  <StatRow label="半极差" value={stats.halfRange} />
                </tbody>
              </table>
            )}
          </Panel>
          <Panel title={`不确定度（${profileName}）`}>
            {uncertaintyResult && 'error' in uncertaintyResult ? (
              <Notice variant="danger"><MarkdownInline>{uncertaintyResult.error}</MarkdownInline></Notice>
            ) : resultItem ? (
              <ResultCard item={resultItem} profileName={profileName} />
            ) : (
              <EmptyState title="等待仪器误差限" hint="填写左侧仪器误差限后计算" />
            )}
          </Panel>
          {profile.kind === 'gbt' && (
            <Notice variant="info">
              <MarkdownBlock>{'GB/T 模式：A 类不加 $t$ 因子；B 类默认按矩形分布换算 $u_B=a/\\sqrt{3}$。如需三角/正态分布请用公式工作台的 GB/T 公式族。'}</MarkdownBlock>
            </Notice>
          )}
        </div>
      </div>
    </div>
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
