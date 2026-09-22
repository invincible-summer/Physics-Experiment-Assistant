/** 科学计算器：core/expression 安全 AST 求值（无 eval），支持角度/弧度切换、Ans 回填与最近 20 条历史。 */
import { useMemo, useRef, useState } from 'react';
import { compileExpression, evaluateExpression } from '../../core/expression';
import { Badge, Button, CopyButton, EmptyState, Panel } from '../../components/ui';
import { MarkdownBlock, MarkdownInline } from '../../components/Markdown';
import { useSettings } from '../../stores/settings';
import { useToolDraft } from './use-tool-draft';

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

interface CalcDraft {
  text: string;
  history: { expr: string; value: string; angleUnit?: 'deg' | 'rad' }[];
}

export function CalculatorPage() {
  const angleUnit = useSettings((s) => s.angleUnit);
  const set = useSettings((s) => s.set);
  const [draft, setDraft] = useToolDraft<CalcDraft>('calculator', { text: '', history: [] });
  const { text, history } = draft;
  const setText = (v: string | ((t: string) => string)) =>
    setDraft((d) => ({ ...d, text: typeof v === 'function' ? v(d.text) : v }));
  const [ans, setAns] = useState(history[0]?.value ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

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

  const edit = (insert: string, backspace = false) => {
    const start = inputRef.current?.selectionStart ?? text.length;
    const end = inputRef.current?.selectionEnd ?? start;
    const from = backspace && start === end ? Math.max(0, start - 1) : start;
    setText(text.slice(0, from) + insert + text.slice(end));
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(from + insert.length, from + insert.length);
    });
  };
  const append = (s: string) => edit(s);

  const commit = (replace: boolean) => {
    if (!result || !('value' in result)) return;
    const entry = { expr: text.trim(), value: String(result.value), angleUnit };
    setAns(entry.value);
    setDraft((d) => ({ ...d, history: [entry, ...d.history].slice(0, 20), text: replace ? entry.value : d.text }));
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
        <div className="page-lead">
          <MarkdownBlock>{'输入表达式即可预览结果，按 **Enter** 或 **=** 保存到历史。\n\n- **常用运算**：四则、幂 `^`、开方 `sqrt`、指数 `exp` 与对数 `ln/log`。\n- **三角函数**：`sin/cos/tan`、`atan`；计算前请确认右上角的角度或弧度模式。\n- **常量与科学记数**：`pi`、`e`、`E`；点击 **Ans** 可插入上次结果。'}</MarkdownBlock>
        </div>
      </header>

      <div className="stack-lg" style={{ maxWidth: 620 }}>
        <Panel title="表达式" sub="Enter 计算并记入历史；= 记入历史并回填结果；Ans 插入上次结果">
          <input
            className="input mono"
            ref={inputRef}
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
          {result && 'value' in result && <div className="row-right" style={{ marginTop: 8 }}><CopyButton text={String(result.value)} label="复制当前结果" /></div>}
          <div className="calc-pad">
            {PAD.map((k) => (
              <Button key={k} className="calc-key" onClick={() => append(k)}>
                {k.length > 1 ? k.replace('(', '') : k}
              </Button>
            ))}
            <Button className="calc-key" title="退格" onClick={() => edit('', true)}>⌫</Button>
            <Button className="calc-key" title="清空输入" onClick={() => setText('')}>C</Button>
            <Button
              className="calc-key"
              title="插入上次计算结果"
              disabled={ans === ''}
              onClick={() => append(ans)}
            >
              Ans
            </Button>
            <Button variant="primary" className="calc-key" style={{ gridColumn: 'span 2' }} disabled={!result || 'error' in result} onClick={() => commit(true)}>=</Button>
          </div>
        </Panel>

        <Panel
          title="历史"
          sub="最近 20 条（本浏览器内保留）"
          actions={history.length > 0 ? <Button size="sm" onClick={() => setDraft((d) => ({ ...d, history: [] }))}>清空</Button> : undefined}
        >
          {history.length === 0 ? (
            <EmptyState icon="calculator" title="暂无历史记录" hint="计算成功后按 Enter 或 = 将表达式与结果记入历史" />
          ) : (
            <div className="stack">
              {history.map((h, i) => (
                <div key={i} className="row-between">
                  <span className="mono small wrap"><MarkdownInline>{`\`${h.expr}\` = **${h.value}**`}</MarkdownInline></span>
                  <div className="row">
                    <Button size="sm" onClick={() => {
                      setText(h.expr);
                      if (h.angleUnit) set('angleUnit', h.angleUnit);
                      inputRef.current?.focus();
                    }}>重新计算</Button>
                    <CopyButton text={h.value} label="复制结果" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}

