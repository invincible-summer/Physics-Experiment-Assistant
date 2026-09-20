/** 科学计算器（plan §9.5）：安全 AST 求值，支持角度/弧度与单位标记 */
import { useMemo, useState } from 'react';
import { compileExpression, evaluateExpression, ExpressionError } from '../../core/expression';
import { Panel, CopyButton } from '../../components/ui';
import { useSettings } from '../../stores/settings';
import { MarkdownInline } from '../../components/Markdown';

const KEYS: string[][] = [
  ['7', '8', '9', '/', 'sqrt(', 'sin('],
  ['4', '5', '6', '*', '^', 'cos('],
  ['1', '2', '3', '-', '(', 'tan('],
  ['0', '.', 'E', '+', ')', 'ln('],
  ['pi', 'e', 'exp(', 'log(', 'abs(', 'atan('],
];

export function CalculatorPage() {
  const angleUnit = useSettings((s) => s.angleUnit);
  const [text, setText] = useState('');
  const [history, setHistory] = useState<{ expr: string; value: string }[]>([]);

  const result = useMemo(() => {
    const src = text.trim();
    if (!src) return null;
    try {
      const compiled = compileExpression(src);
      if (compiled.variables.length > 0) {
        return { error: `包含未知变量：${compiled.variables.join(', ')}` };
      }
      const value = evaluateExpression(compiled, {}, { angleMode: angleUnit });
      return { value };
    } catch (err) {
      return { error: (err as Error).message };
    }
  }, [text, angleUnit]);

  const append = (s: string) => setText((t) => t + s);

  return (
    <main className="page">
      <h1><MarkdownInline>科学计算器</MarkdownInline></h1>
      <p className="muted"><MarkdownInline>{`安全 AST 求值（无 \\`eval\\`）。当前角度模式：**${angleUnit === 'deg' ? '度（°）' : '弧度（rad）'}**（可在设置修改）`}</MarkdownInline></p>
      <div style={{ maxWidth: 640 }}>
        <Panel title="表达式">
          <input
            className="input" style={{ fontSize: 16 }}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && result && 'value' in result) {
                setHistory((h) => [{ expr: text, value: String(result.value) }, ...h].slice(0, 20));
              }
            }}
            placeholder="如 2*pi*1.5e3 或 sqrt(3^2+4^2)"
          />
          <div className="calc-display" style={{ marginTop: 8 }}>
            {result === null ? '​' : 'error' in result ? <span style={{ color: 'var(--danger)' }}><MarkdownInline>{result.error}</MarkdownInline></span> : result.value}
          </div>
          <div className="calc-pad" style={{ marginTop: 10 }}>
            {KEYS.flat().map((k) => (
              <button key={k} className="btn calc-key" onClick={() => append(k)}><MarkdownInline allowLinks={false}>{k.replace('(', '')}</MarkdownInline></button>
            ))}
            <button className="btn calc-key" onClick={() => setText((t) => t.slice(0, -1))}><MarkdownInline allowLinks={false}>⌫</MarkdownInline></button>
            <button className="btn calc-key" onClick={() => setText('')}><MarkdownInline allowLinks={false}>C</MarkdownInline></button>
            <button className="btn calc-key" onClick={() => setText((t) => t + '(')}><MarkdownInline allowLinks={false}>（</MarkdownInline></button>
            <button className="btn calc-key" onClick={() => setText((t) => t + ')')}><MarkdownInline allowLinks={false}>）</MarkdownInline></button>
            <button
              className="btn btn-primary calc-key"
              onClick={() => {
                if (result && 'value' in result) {
                  setHistory((h) => [{ expr: text, value: String(result.value) }, ...h].slice(0, 20));
                  setText(String(result.value));
                }
              }}
            ><MarkdownInline allowLinks={false}>=</MarkdownInline></button>
          </div>
        </Panel>
        {history.length > 0 && (
          <Panel title="历史" actions={<button className="btn btn-sm" onClick={() => setHistory([])}><MarkdownInline allowLinks={false}>清空</MarkdownInline></button>}>
            {history.map((h, i) => (
              <div key={i} className="row" style={{ justifyContent: 'space-between' }}>
                <span className="mono small"><MarkdownInline>{`${h.expr} = **${h.value}**`}</MarkdownInline></span>
                <CopyButton text={h.value} label="复制" />
              </div>
            ))}
          </Panel>
        )}
      </div>
    </main>
  );
}

