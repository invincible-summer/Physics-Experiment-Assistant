/**
 * core/sigfig — 有效数字与修约策略（唯一实现点，AGENTS.md §4.5）。
 *
 * 规则来源：
 * - tsinghua-a1-2026 课程：不确定度一般 2 位有效数字，首位 ≥3 可简化 1 位；
 *   相对不确定度 2 位；测量值末位与不确定度末位对齐；常规十进制四舍五入。
 * - gbt-27418-2017：u/U 通常最多 2 位有效数字；估计值与不确定度末位对齐。
 * - 修约只作用于显示与最终导出；中间计算保留完整精度（AGENTS.md §4.2）。
 */
import Decimal from 'decimal.js';
import { parseNumericText } from '../numeric';

Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

export interface SigFigOptions {
  /** 不确定度有效数字位数 */
  uncertaintyDigits: 1 | 2;
  /** 首位 ≥3 时允许压缩为 1 位（课程默认允许） */
  allowLeadingDigitCompress: boolean;
  /** 相对不确定度有效数字位数 */
  relativeDigits: 1 | 2;
  /** 科学记数法阈值：|x| ≥ sciUpper 或 0<|x| < sciLower 时启用 */
  sciUpper: number;
  sciLower: number;
}

export const COURSE_SIGFIG: SigFigOptions = {
  uncertaintyDigits: 2,
  allowLeadingDigitCompress: true,
  relativeDigits: 2,
  sciUpper: 1e7,
  sciLower: 1e-5,
};

export const GBT_SIGFIG: SigFigOptions = {
  uncertaintyDigits: 2,
  allowLeadingDigitCompress: false,
  relativeDigits: 2,
  sciUpper: 1e7,
  sciLower: 1e-5,
};

/** 从原始文本统计有效数字位数（AGENTS.md §4.1：不得丢失 15.0 与 15 的区别） */
export function countSignificantDigits(rawText: string): number | undefined {
  const p = parseNumericText(rawText);
  return p.ok ? p.sigDigits : undefined;
}

/** 数值本身的有效数字首位（0.0264 → 2；0.087 → 8） */
export function leadingSignificantDigit(value: number): number {
  if (value === 0 || !Number.isFinite(value)) return 0;
  const a = Math.abs(value);
  return Number(a.toExponential(1).slice(0, 1));
}

/** 四舍五入到 n 位有效数字（Decimal 精确十进制，课程默认 HALF_UP） */
export function roundToSigDigits(value: number, n: number): number {
  if (!Number.isFinite(value) || value === 0 || n <= 0) return value;
  const d = new Decimal(value);
  const exp = Math.floor(Math.log10(Math.abs(value)));
  // 用 Decimal 幂避免 Math.pow 的浮点误差
  const quantum = new Decimal(10).pow(exp - n + 1);
  const scaled = d.dividedBy(quantum).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
  return Number(scaled.times(quantum));
}

/** 四舍五入到指定小数位（place: 2 → 0.01；place: -1 → 十位） */
export function roundToDecimalPlace(value: number, place: number): number {
  if (!Number.isFinite(value)) return value;
  if (place >= 0) {
    return Number(new Decimal(value).toDecimalPlaces(place, Decimal.ROUND_HALF_UP));
  }
  const quantum = new Decimal(10).pow(-place); // place=-1 → 10
  const scaled = new Decimal(value).dividedBy(quantum).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
  return Number(scaled.times(quantum));
}

/** 取 n 位有效数字后，末位所在的小数位（10^-place）。例：0.026 取 2 位 → 末位在小数点后 3 位 → 3 */
export function sigDecimalPlace(value: number, n: number): number {
  if (!Number.isFinite(value) || value === 0) return 0;
  const exp = Math.floor(Math.log10(Math.abs(value)));
  return -(exp - n + 1);
}

/** 不确定度修约：按选项决定位数（课程规则核心实现） */
export function roundUncertainty(value: number, opts: SigFigOptions): { value: number; digits: 1 | 2; place: number } {
  const abs = Math.abs(value);
  if (abs === 0 || !Number.isFinite(abs)) return { value, digits: opts.uncertaintyDigits, place: 0 };
  const lead = leadingSignificantDigit(abs);
  let digits = opts.uncertaintyDigits;
  if (opts.allowLeadingDigitCompress && lead >= 3) digits = 1;
  const place = sigDecimalPlace(abs, digits);
  return { value: roundToDecimalPlace(abs, place), digits, place };
}

export interface FormattedMeasurement {
  /** 修约后的测量值 */
  value: number;
  /** 修约后的不确定度 */
  uncertainty: number;
  /** 末位对齐的小数位 */
  decimalPlace: number;
  /** 相对不确定度（小数形式，未乘 100） */
  relative: number;
  /** 相对不确定度百分数字符串，如 "0.85%" */
  relativePercent: string;
  /** 修约依据说明 */
  roundingNote: string;
  /** 最终表达，如 "9.44 ± 0.08"（不含单位） */
  text: string;
  /** 不确定度采用的有效数字位数 */
  uncertaintyDigits: 1 | 2;
}

/** 主结果格式化：值与不确定度末位对齐（课程 & GB/T 共用逻辑，差异由 opts 控制） */
export function formatMeasurement(
  value: number,
  uncertainty: number,
  opts: SigFigOptions,
): FormattedMeasurement {
  // 无不确定度分量（如理想数据的零误差拟合）：按 6 位有效数字显示值，不强制对齐
  if (!(uncertainty > 0) || !Number.isFinite(uncertainty)) {
    const v = Number.isFinite(value) ? value : NaN;
    const rel = v !== 0 && Number.isFinite(v) ? 0 / Math.abs(v) : NaN;
    return {
      value: v,
      uncertainty: 0,
      decimalPlace: NaN,
      relative: rel,
      relativePercent: Number.isFinite(v) && v !== 0 ? '0%' : '—',
      roundingNote: '不确定度分量为 0（如完全线性数据的拟合误差）——仅显示 6 位有效数字，不做末位对齐。实际实验中通常存在非零不确定度。',
      text: `${toFixedSig(v, 6)} ± 0`,
      uncertaintyDigits: opts.uncertaintyDigits,
    };
  }
  const u = roundUncertainty(uncertainty, opts);
  const place = u.place;

  // 科学记数法：量级过大/过小时以 (m ± um)×10^e 表示，尾数按不确定度对齐
  if (shouldUseScientific(value, opts)) {
    const exp = Math.floor(Math.log10(Math.abs(value)));
    const scale = Math.pow(10, exp);
    const m = value / scale;
    const um = u.value / scale;
    const mRounded = roundToDecimalPlace(m, u.place + exp);
    const text = `(${toFixedPlace(mRounded, u.place + exp)} ± ${toFixedPlace(um, u.place + exp)}) × 10^${exp}`;
    const rel = value !== 0 ? u.value / Math.abs(value) : NaN;
    return {
      value,
      uncertainty: u.value,
      decimalPlace: place,
      relative: rel,
      relativePercent: Number.isFinite(rel) ? formatSigDigitsPercent(rel, opts.relativeDigits) : '—',
      roundingNote: `量级超出常规范围，采用科学记数法；不确定度取 ${u.digits} 位有效数字，尾数末位对齐。`,
      text,
      uncertaintyDigits: u.digits,
    };
  }

  const v = roundToDecimalPlace(value, place);
  const rel = Math.abs(v) !== 0 ? u.value / Math.abs(v) : NaN;
  const relText = Number.isFinite(rel)
    ? formatSigDigitsPercent(rel, opts.relativeDigits)
    : '—';
  const lead = leadingSignificantDigit(u.value);
  const note =
    u.digits === 1 && opts.allowLeadingDigitCompress
      ? `不确定度首位为 ${lead}（≥3），按课程规则取 1 位有效数字；测量值末位与之对齐（10^${-place} 位）。`
      : `不确定度取 ${u.digits} 位有效数字；测量值末位与之对齐（10^${-place} 位）。`;
  return {
    value: v,
    uncertainty: u.value,
    decimalPlace: place,
    relative: rel,
    relativePercent: relText,
    roundingNote: note,
    text: `${toFixedPlace(v, place)} ± ${toFixedPlace(u.value, place)}`,
    uncertaintyDigits: u.digits,
  };
}

/** 相对不确定度百分数字符串，保留 n 位有效数字 */
export function formatSigDigitsPercent(rel: number, n: number): string {
  if (!Number.isFinite(rel)) return '—';
  const pct = rel * 100;
  const place = sigDecimalPlace(pct, n);
  return `${toFixedPlace(pct, place)}%`;
}

/** 固定小数位显示，去除 -0；place<0 时量化到十的幂（如 -2 → 百位） */
export function toFixedPlace(value: number, place: number): string {
  if (place < 0) {
    const r = roundToDecimalPlace(value, place);
    return String(r) === '-0' ? '0' : String(r);
  }
  const s = value.toFixed(Math.max(0, Math.min(100, place)));
  if (/^-0(\.0+)?$/.test(s)) return s.slice(1);
  return s;
}

/** 科学记数法字符串：value = d.dd × 10^e，保留 n 位有效数字 */
export function formatScientificNotation(value: number, n = 3): string {
  if (!Number.isFinite(value)) return String(value);
  if (value === 0) return '0';
  const d = new Decimal(value).toSignificantDigits(n);
  const [m, e] = d.toExponential().split('e');
  return `${m} \\times 10^{${Number(e)}}`;
}

/** 是否应使用科学记数法显示 */
export function shouldUseScientific(value: number, opts: SigFigOptions): boolean {
  if (value === 0 || !Number.isFinite(value)) return false;
  const a = Math.abs(value);
  return a >= opts.sciUpper || a < opts.sciLower;
}

/**
 * 拟合参数有效位（绪论课规则，AGENTS.md §6）：
 * 未估算拟合参数不确定度时——截距 a 末位至少与 yi 末位取齐；
 * 斜率 b 有效位数至少与 xi 有效位数一致。
 */
export function fitParameterDisplay(
  a: number,
  b: number,
  xRawTexts: string[],
  yRawTexts: string[],
): { aText: string; bText: string } {
  const yMinPlace = Math.max(
    ...yRawTexts.map((t) => parseNumericText(t).decimalPlace ?? 0),
  );
  const xSig = Math.min(
    ...xRawTexts.map((t) => parseNumericText(t).sigDigits ?? 6),
  );
  return {
    aText: toFixedPlace(a, Math.max(0, yMinPlace)),
    bText: toFixedSig(b, Math.max(1, xSig)),
  };
}

/** 保留 n 位有效数字的十进制字符串（非科学记数法） */
export function toFixedSig(value: number, n: number): string {
  if (!Number.isFinite(value) || value === 0) return '0';
  const place = sigDecimalPlace(value, n);
  if (place > 20 || place < -6) {
    const d = new Decimal(value).toSignificantDigits(n);
    return d.toExponential();
  }
  return toFixedPlace(value, place);
}
