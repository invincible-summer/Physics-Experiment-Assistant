/** 工具页数值显示统一格式化：走 core/sigfig 的十进制修约，仅作用于显示，不回写计算 */
import { roundToSigDigits } from '../../core/sigfig';

/** 以 n 位有效数字显示（默认 6 位）；极端量级用指数形式。返回纯文本，不含 Markdown/LaTeX。 */
export function fmtDisplay(v: number, sig = 6): string {
  if (!Number.isFinite(v)) return '—';
  if (v === 0) return '0';
  const r = roundToSigDigits(v, sig);
  const a = Math.abs(r);
  if (a >= 1e12 || a < 1e-6) return r.toExponential(Math.max(1, sig - 1));
  return String(r);
}
