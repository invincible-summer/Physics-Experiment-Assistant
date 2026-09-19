/** 科学计算器（plan §9.5）：安全 AST 求值，支持角度/弧度与单位标记 */
import { useMemo, useState } from 'react';
import { compileExpression, evaluateExpression, ExpressionError } from '../../core/expression';
import { Panel, CopyButton } from '../../components/ui';
import { useSettings } from '../../stores/settings';

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
      <h1>科学计算器</h1>
      <p className="muted">安全 AST 求值（无 eval）。当前角度模式：<strong>{angleUnit === 'deg' ? '度（°）' : '弧度（rad）'}</strong>（可在设置修改）</p>
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
            {result === null ? '​' : 'error' in result ? <span style={{ color: 'var(--danger)' }}>{result.error}</span> : result.value}
          </div>
          <div className="calc-pad" style={{ marginTop: 10 }}>
            {KEYS.flat().map((k) => (
              <button key={k} className="btn calc-key" onClick={() => append(k)}>{k.replace('(', '')}</button>
            ))}
            <button className="btn calc-key" onClick={() => setText((t) => t.slice(0, -1))}>⌫</button>
            <button className="btn calc-key" onClick={() => setText('')}>C</button>
            <button className="btn calc-key" onClick={() => setText((t) => t + '(')}>（</button>
            <button className="btn calc-key" onClick={() => setText((t) => t + ')')}>）</button>
            <button
              className="btn btn-primary calc-key"
              onClick={() => {
                if (result && 'value' in result) {
                  setHistory((h) => [{ expr: text, value: String(result.value) }, ...h].slice(0, 20));
                  setText(String(result.value));
                }
              }}
            >=</button>
          </div>
        </Panel>
        {history.length > 0 && (
          <Panel title="历史" actions={<button className="btn btn-sm" onClick={() => setHistory([])}>清空</button>}>
            {history.map((h, i) => (
              <div key={i} className="row" style={{ justifyContent: 'space-between' }}>
                <span className="mono small">{h.expr} = <strong>{h.value}</strong></span>
                <CopyButton text={h.value} label="复制" />
              </div>
            ))}
          </Panel>
        )}
      </div>
    </main>
  );
}

