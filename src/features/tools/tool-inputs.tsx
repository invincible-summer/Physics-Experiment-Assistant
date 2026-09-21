/** 工具页共享组件：数据列文本域输入 */
import { useMemo, useState } from 'react';
import { parseNumericText } from '../../core/numeric';
import { parseTSV } from '../../components/DataGrid';
import { Field } from '../../components/ui';

/** 把文本按行/空白/逗号拆成数值 */
function parseColumn(text: string): { values: number[]; bad: number; count: number } {
  const lines = text.split(/[\n,;，；\s]+/).map((s) => s.trim()).filter((s) => s !== '');
  const values: number[] = [];
  let bad = 0;
  for (const line of lines) {
    const p = parseNumericText(line);
    if (p.ok) values.push(p.value);
    else bad++;
  }
  return { values, bad, count: lines.length };
}

export function ColumnInput({ label, placeholder, onChange, rows = 10 }: {
  label: string; placeholder?: string; onChange: (values: number[]) => void; rows?: number;
}) {
  const [text, setText] = useState('');
  // 注意：onChange 必须用 e.target.value 即时解析，避免使用上一轮渲染的 memo（stale closure）
  const parsed = useMemo(() => parseColumn(text), [text]);

  return (
    <Field
      label={label}
      hint={`已识别 **${parsed.values.length}** 个数值${parsed.bad > 0 ? `，**${parsed.bad}** 个无法解析（已忽略）` : ''}；支持科学记数法`}
    >
      <textarea
        className="textarea"
        rows={rows}
        placeholder={placeholder ?? '每行一个数值，也可直接粘贴 Excel 列（支持空格/逗号/分号分隔）'}
        value={text}
        onChange={(e) => {
          const next = e.target.value;
          setText(next);
          onChange(parseColumn(next).values);
        }}
      />
    </Field>
  );
}

/** 解析双列文本 */
function parsePairs(text: string): { xs: number[]; ys: number[]; rawXs: string[]; rawYs: string[]; n: number } {
  const matrix = parseTSV(text);
  const xs: number[] = [];
  const ys: number[] = [];
  const rawXs: string[] = [];
  const rawYs: string[] = [];
  for (const row of matrix) {
    if (row.length < 2) continue;
    const px = parseNumericText(row[0]);
    const py = parseNumericText(row[1]);
    rawXs.push(row[0]);
    rawYs.push(row[1]);
    xs.push(px.ok ? px.value : NaN);
    ys.push(py.ok ? py.value : NaN);
  }
  return { xs, ys, rawXs, rawYs, n: matrix.filter((r) => r.length >= 2).length };
}

/** 双列输入（x/y 成对） */
export function PairInput({ label, onChange }: {
  label: string; onChange: (xs: number[], ys: number[], rawXs: string[], rawYs: string[]) => void;
}) {
  const [text, setText] = useState('');
  const result = useMemo(() => parsePairs(text), [text]);

  return (
    <Field
      label={label}
      hint={`已识别 **${result.n}** 行；无法解析的单元格记为缺失`}
    >
      <textarea
        className="textarea"
        rows={12}
        placeholder={'两列（Tab/逗号分隔）：\n1.00\t2.05\n2.00\t3.10\n…\n可直接从 Excel 粘贴'}
        value={text}
        onChange={(e) => {
          const next = e.target.value;
          setText(next);
          const r = parsePairs(next);
          onChange(r.xs, r.ys, r.rawXs, r.rawYs);
        }}
      />
    </Field>
  );
}
