import { compileExpression, evaluateExpression } from '../expression';
import { parseNumericText } from '../numeric';

/** Display boundaries never silently reinterpret invalid input as automatic. */
export function axisRange(minText: string, maxText: string, log: boolean) {
  const parse = (text: string): number | undefined => {
    if (!text.trim()) return undefined;
    const value = parseNumericText(text);
    if (!value.ok) throw new Error('坐标范围必须为有限数值');
    if (log && value.value <= 0) throw new Error('对数轴范围必须大于 0');
    return value.value;
  };
  const min = parse(minText), max = parse(maxText);
  if (min !== undefined && max !== undefined && min >= max) throw new Error('坐标起点必须小于终点');
  return { min, max };
}

/** General mathematical function samples; never substitutes for measured data. */
export function sampleFunction(expr: string, xminText: string, xmaxText: string, countText: string, xLog = false, yLog = false) {
  const compiled = compileExpression(expr);
  const unknown = compiled.variables.filter(v => v !== 'x');
  if (unknown.length) throw new Error(`只允许变量 x；未知变量：${unknown.join('、')}`);
  const { min, max } = axisRange(xminText, xmaxText, xLog);
  if (min === undefined || max === undefined) throw new Error('请填写取样起点与终点');
  const count = parseNumericText(countText);
  if (!count.ok || !Number.isInteger(count.value) || count.value < 2 || count.value > 1000) throw new Error('取样点数须为 2 至 1000 的整数');
  const points: { x: number; y: number }[] = [];
  const breakBefore: number[] = [];
  let skipped = 0, gap = false;
  for (let i = 0; i < count.value; i++) {
    const t = i / (count.value - 1);
    const x = xLog ? Math.exp((1 - t) * Math.log(min) + t * Math.log(max)) : (1 - t) * min + t * max;
    try {
      const y = evaluateExpression(compiled, { x });
      if (!Number.isFinite(y) || (yLog && y <= 0)) throw new Error('outside domain');
      if (gap && points.length) breakBefore.push(points.length);
      points.push({ x, y });
      gap = false;
    } catch { skipped++; gap = true; }
  }
  return { points, breakBefore, skipped };
}
