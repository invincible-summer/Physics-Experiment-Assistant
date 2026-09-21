/** 科学计算器：core/expression 安全 AST 求值（无 eval），支持角度/弧度切换与最近 20 条历史。 */
import { useMemo, useState } from 'react';
import { compileExpression, evaluateExpression } from '../../core/expression';
import { Badge, Button, CopyButton, EmptyState, Panel } from '../../components/ui';
import { MarkdownInline } from '../../components/Markdown';
import { useSettings } from '../../stores/settings';

/** 键盘 token（5 列网格自动排布）；token 原样插入表达式，键面显示时去掉左括号。 */
const PAD: string[] = [
  '7', '8', '9', '/', 'sqrt(',
  '4', '5', '6', '*', 'sin(',
  '1', '2', '3', '-', 'cos(',
  '0', '.', 'E', '+', 'tan(',
  'pi', 'e', '^', 'ln(', 'log(',
  '(', ')', 'exp(', 'abs(', 'atan(',
];

type EvalResult = { value: number } | { error: string };

export function CalculatorPage() {
  const angleUnit = useSettings((s) => s.angleUnit);
  const set = useSettings((s) => s.set);
  const [text, setText] = useState('');
  const [history, setHistory] = useState<{ expr: string; value: string }[]>([]);

  const result = useMemo<EvalResult | null>(() => {
    const src = text.trim();
    if (!src) return null;
    try {
      const compiled = compileExpression(src);
      if (compiled.variables.length > 0) {
        return { error: `包含未知变量：${compiled.variables.join(', ')}` };
      }
      return { value: evaluateExpression(compiled, {}, { angleMode: angleUnit }) };
    } catch (err) {
      return { error: (err as Error).message };
    }
  }, [text, angleUnit]);

  const append = (s: string) => setText((t) => t + s);

  const commit = (replace: boolean) => {
    if (!result || !('value' in result)) return;
    const entry = { expr: text.trim(), value: String(result.value) };
    setHistory((h) => [entry, ...h].slice(0, 20));
    if (replace) setText(entry.value);
  };

  return (
    <>
      <header className="page-head">
        <div className="row-between">
          <h1 className="page-title"><MarkdownInline>科学计算器</MarkdownInline></h1>
          <Button
            variant="ghost"
            size="sm"
            title="点击切换角度/弧度（也可在设置中修改）"
            onClick={() => set('angleUnit', angleUnit === 'deg' ? 'rad' : 'deg')}
          >
            <Badge variant="accent">{`角度：${angleUnit === 'deg' ? 'deg（°）' : 'rad（弧度）'}`}</Badge>
          </Button>
        </div>
        <p className="page-lead">
          <MarkdownInline>{'安全 AST 求值（无 `eval`）。支持四则、幂 `^`、`sqrt`、`sin/cos/tan`、`ln/log`、`exp/abs/atan`、常量 `pi`/`e` 与科学记数 `E`；三角函数按当前角度模式解释。'}</MarkdownInline>
        </p>
      </header>

      <div className="stack-lg" style={{ maxWidth: 620 }}>
        <Panel title="表达式" sub="Enter 计算并记入历史；= 记入历史并回填结果">
          <input
            className="input mono"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') commit(false); }}
            placeholder="如 2*pi*1.5E3 或 sqrt(3^2+4^2)"
            aria-label="表达式"
            spellCheck={false}
          />
          <div className="calc-display" style={{ marginTop: 8 }} aria-live="polite">
            {result === null ? (
              <span className="muted"><MarkdownInline>输入表达式后实时预览结果</MarkdownInline></span>
            ) : 'error' in result ? (
              <span className="muted small"><MarkdownInline>{result.error}</MarkdownInline></span>
            ) : (
              String(result.value)
            )}
          </div>
          <div className="calc-pad">
            {PAD.map((k) => (
              <Button key={k} className="calc-key" onClick={() => append(k)}>
                {k.replace('(', '')}
              </Button>
            ))}
            <Button className="calc-key" title="退格" onClick={() => setText((t) => t.slice(0, -1))}>⌫</Button>
            <Button className="calc-key" title="清空输入" onClick={() => setText('')}>C</Button>
            <Button variant="primary" className="calc-key" style={{ gridColumn: 'span 3' }} onClick={() => commit(true)}>=</Button>
          </div>
        </Panel>

        <Panel
          title="历史"
          sub="最近 20 条"
          actions={history.length > 0 ? <Button size="sm" onClick={() => setHistory([])}>清空</Button> : undefined}
        >
          {history.length === 0 ? (
            <EmptyState title="暂无历史记录" hint="计算成功后按 Enter 或 = 将表达式与结果记入历史" />
          ) : (
            <div className="stack">
              {history.map((h, i) => (
                <div key={i} className="row-between">
                  <span className="mono small wrap"><MarkdownInline>{`\`${h.expr}\` = **${h.value}**`}</MarkdownInline></span>
                  <CopyButton text={h.value} label="复制结果" />
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}
