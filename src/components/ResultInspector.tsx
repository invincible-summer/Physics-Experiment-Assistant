/**
 * ResultInspector — 结果检查器。
 * 统一层级：最终结果 → 标准规则 → 公式 → 数值代入 → 未修约 → 分量 → 修约 → 来源 → 诊断。
 */
import { ReactNode } from 'react';
import { ResultItem } from '../core/results';
import { Tex } from './katex';
import { SourceBadge } from './ui';
import { useSettings } from '../stores/settings';
import { MarkdownInline, MarkdownList } from './Markdown';

export function ResultInspector({ results, profileName }: { results: ResultItem[]; profileName?: string }) {
  const showProvenance = useSettings((s) => s.showProvenance);
  if (results.length === 0) {
    return (
      <div className="empty-state">
        <div className="small muted"><MarkdownInline>等待输入数据后显示计算结果</MarkdownInline></div>
      </div>
    );
  }
  return (
    <div>
      {results.map((r) => (
        <ResultCard key={r.id} item={r} profileName={profileName} showProvenance={showProvenance} />
      ))}
    </div>
  );
}

export function ResultCard({ item, profileName, showProvenance = true }: {
  item: ResultItem; profileName?: string; showProvenance?: boolean;
}) {
  return (
    <div className="result-card">
      <div className="rc-head">
        <span>
          {item.symbol ? <Tex tex={`${item.symbol} = `} /> : null}
          <MarkdownInline>{item.title}</MarkdownInline>
        </span>
        <span className="spacer" />
        {item.warnings && item.warnings.length > 0 && (
          <span className="badge badge-warning" title={item.warnings.join('\n')}>
            <MarkdownInline allowLinks={false}>{`警告 ${item.warnings.length}`}</MarkdownInline>
          </span>
        )}
      </div>
      <div className="rc-body">
        {(item.finalText ?? item.finalValue !== undefined) && (
          <div className="result-final">
            {item.finalText ? (
              <span className="value"><MarkdownInline>{item.finalText}</MarkdownInline></span>
            ) : (
              <span className="value">{item.finalValue}</span>
            )}
            {item.unit && <span className="unit"><MarkdownInline>{item.unit}</MarkdownInline></span>}
            {item.relativeText && (
              <span className="rel"><MarkdownInline>{`相对不确定度 ${item.relativeText}`}</MarkdownInline></span>
            )}
          </div>
        )}
        {item.ruleNotes && item.ruleNotes.length > 0 && (
          <Section label={`当前标准规则${profileName ? `（${profileName}）` : ''}`}>
            <MarkdownList items={item.ruleNotes} />
          </Section>
        )}
        {item.steps.length > 0 && (
          <Section label="公式 → 数值代入 → 未修约值" defaultOpen>
            {item.steps.map((s, i) => (
              <div key={i} style={{ marginBottom: 7 }}>
                {s.formulaLatex && <Tex tex={s.formulaLatex} display />}
                {s.substitution && <div className="subst"><MarkdownInline>{s.substitution}</MarkdownInline></div>}
                {s.unrounded && (
                  <div className="subst unrounded"><MarkdownInline>{`**未修约：**${s.unrounded}`}</MarkdownInline></div>
                )}
                {s.note && <div className="small muted"><MarkdownInline>{s.note}</MarkdownInline></div>}
              </div>
            ))}
          </Section>
        )}
        {item.components && item.components.length > 0 && (
          <Section label="不确定度分量">
            <ContributionChart components={item.components} />
          </Section>
        )}
        {item.roundingNote && (
          <Section label="修约依据">
            <div className="small"><MarkdownInline>{item.roundingNote}</MarkdownInline></div>
          </Section>
        )}
        {showProvenance && item.provenance && (
          <Section label="来源">
            <div className="row">
              <SourceBadge provenance={item.provenance} />
              {item.provenance.document && <span className="small muted"><MarkdownInline>{item.provenance.document}</MarkdownInline></span>}
              {item.provenance.section && <span className="small muted"><MarkdownInline>{item.provenance.section}</MarkdownInline></span>}
            </div>
          </Section>
        )}
        {item.warnings && item.warnings.length > 0 && (
          <Section label="诊断提示">
            <MarkdownList items={item.warnings} className="warning-list" />
          </Section>
        )}
      </div>
    </div>
  );
}

function Section({ label, children, defaultOpen = false }: { label: string; children: ReactNode; defaultOpen?: boolean }) {
  return (
    <details className="fold" open={defaultOpen}>
      <summary><MarkdownInline>{label}</MarkdownInline></summary>
      <div className="fold-body">{children}</div>
    </details>
  );
}

export function ContributionChart({ components }: { components: NonNullable<ResultItem['components']> }) {
  const total = components.reduce((s, c) => s + (c.fraction ?? 0), 0);
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="contrib-table">
        <thead>
          <tr>
            <th><MarkdownInline>分量</MarkdownInline></th>
            <th><MarkdownInline>说明</MarkdownInline></th>
            <th className="num"><MarkdownInline>数值</MarkdownInline></th>
            {total > 0.001 ? <th style={{ minWidth: 96 }}><MarkdownInline>贡献率</MarkdownInline></th> : null}
          </tr>
        </thead>
        <tbody>
          {components.map((c, i) => (
            <tr key={i}>
              <td><Tex tex={c.symbol} /></td>
              <td>
                <MarkdownInline>{c.label}</MarkdownInline>
                {c.formulaLatex ? <span className="muted small"> · <Tex tex={c.formulaLatex} /></span> : null}
              </td>
              <td className="num">{fmtNum(c.value)}</td>
              {total > 0.001 ? (
                <td>
                  <div className="row row-nowrap" style={{ gap: 6 }}>
                    <div className="contrib-bar" style={{ width: `${Math.max(1, (c.fraction ?? 0) * 84)}px` }} />
                    <span className="small mono">{((c.fraction ?? 0) * 100).toFixed(1)}%</span>
                  </div>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
      {components.some((c) => c.substitution) && (
        <div className="small muted" style={{ marginTop: 4 }}>
          {components.filter((c) => c.substitution).map((c, i) => (
            <div key={i}><MarkdownInline>{`${c.symbol}：${c.substitution}`}</MarkdownInline></div>
          ))}
        </div>
      )}
    </div>
  );
}

function fmtNum(v: number): string {
  if (!Number.isFinite(v)) return '—';
  if (v === 0) return '0';
  const a = Math.abs(v);
  if (a >= 1e6 || a < 1e-4) return v.toExponential(4);
  return Number(v.toPrecision(6)).toString();
}
