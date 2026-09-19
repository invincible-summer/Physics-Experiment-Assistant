/**
 * core/numeric — 安全数值解析与数值守卫。
 *
 * 职责边界（见 plan.md §6.1）：
 * - 解析用户原始输入文本为数值，保留有效数字元数据（15.0 ≠ 15）；
 * - 防止 NaN/Infinity 泄漏到 UI；
 * - Decimal 十进制修约委托给 core/sigfig，本模块不负责修约策略。
 */

export interface NumericDatum {
  /** 用户原始输入，例如 "15.0"；派生量可为生成文本 */
  rawText: string;
  /** 计算用 SI 数值 */
  valueSI: number;
  /** 输入单位符号（SI 时为 ''） */
  inputUnit?: string;
  /** 原始输入的有效数字位数（按文本判定） */
  significantDigits?: number;
  /** 原始输入的末位小数位（10^-place） */
  decimalPlace?: number;
  /** π、定义常数、整数计数等精确量 */
  isExact?: boolean;
}

export interface ParsedNumber {
  ok: boolean;
  value: number;
  rawText: string;
  /** 有效数字位数；exact 整数为 undefined */
  sigDigits?: number;
  /** 末位小数位；整数/科学记数法按规约处理 */
  decimalPlace?: number;
  /** 是否科学记数法 */
  scientific: boolean;
  error?: string;
}

/**
 * 解析数值文本。接受：
 * - 常规十进制：15.0 / -3 / 0.00980 / 980. / .5
 * - 科学记数法：1.2e3 / -2.5E-4 / 3e0
 * - 前后空白、中文全角负号、千分逗号（仅整数部分）容错。
 *
 * 有效数字判定（课程口径）：
 * - "980" → 2 位（无小数点的末尾 0 不计入）；
 * - "980." → 3 位；"15.0" → 3 位；"0.00980" → 3 位（前导 0 不计，中间/末尾 0 计）；
 * - "1.20e3" → 3 位（按尾数计）。
 */
export function parseNumericText(raw: string): ParsedNumber {
  const rawText = raw.trim();
  const fail = (error: string): ParsedNumber => ({
    ok: false,
    value: NaN,
    rawText,
    scientific: false,
    error,
  });
  if (rawText === '' || rawText === '—' || rawText === '-') return fail('空输入');

  // 全角负号归一
  let s = rawText.replace(/（/g, '(').replace(/）/g, ')').replace(/−/g, '-').replace(/–/g, '-');
  // 千分位逗号：仅当模式形如 1,234,567 时去除
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');

  const sciMatch = /^([+-]?)(\d+\.?\d*|\.\d+)[eE]([+-]?\d+)$/.exec(s);
  let mantissa: string;
  let exponent = 0;
  let scientific = false;
  if (sciMatch) {
    scientific = true;
    mantissa = sciMatch[2];
    exponent = Number(sciMatch[3]);
  } else {
    if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(s)) return fail(`无法识别的数值格式："${rawText}"`);
    mantissa = s.replace(/^[+-]/, '');
  }

  const value = Number(s);
  if (!Number.isFinite(value)) return fail(`数值超出可表示范围："${rawText}"`);

  // 有效数字与末位小数位
  let sigDigits: number | undefined;
  let decimalPlace: number | undefined;
  if (/[.]/.test(mantissa)) {
    const digits = mantissa.replace('.', '').replace(/^0+/, '');
    sigDigits = digits.length; // 前导 0 不计；小数形式末尾 0 计入
    const frac = mantissa.split('.')[1] ?? '';
    decimalPlace = frac.length - exponent;
  } else {
    // 纯整数：末尾 0 不计（980 → 2）；但 "980." 已被上面小数分支覆盖
    const stripped = mantissa.replace(/0+$/, '');
    sigDigits = stripped.length === 0 ? 1 : stripped.length;
    decimalPlace = exponent === 0 ? 0 : -exponent;
  }
  if (sigDigits === 0) sigDigits = 1;

  return { ok: true, value, rawText, sigDigits, decimalPlace, scientific };
}

/** 守卫：确保有限数值；否则抛出带上下文的错误 */
export function assertFinite(value: number, context = '数值'): number {
  if (!Number.isFinite(value)) {
    throw new Error(`${context}计算结果不是有限数值（NaN/Infinity），请检查输入与公式定义`);
  }
  return value;
}

/** 守卫版除法：除数为 0 时抛错 */
export function safeDivide(a: number, b: number, context = '除法'): number {
  if (b === 0) throw new Error(`${context}：除数为 0`);
  return assertFinite(a / b, context);
}

/** 数值容差比较 */
export function nearlyEqual(a: number, b: number, eps = 1e-12): boolean {
  return Math.abs(a - b) <= eps * Math.max(1, Math.abs(a), Math.abs(b));
}

/** 相对容差比较 */
export function relativelyClose(a: number, b: number, relTol = 1e-9): boolean {
  return Math.abs(a - b) <= relTol * Math.max(Math.abs(a), Math.abs(b), 1e-300);
}

/** 构造 NumericDatum（输入侧） */
export function makeDatum(rawText: string, valueSI: number, opts: Partial<NumericDatum> = {}): NumericDatum {
  return {
    rawText,
    valueSI,
    inputUnit: opts.inputUnit,
    significantDigits: opts.significantDigits,
    decimalPlace: opts.decimalPlace,
    isExact: opts.isExact ?? false,
  };
}

/** 高精度常数：π、e（不得以低精度字符串硬编码参与计算） */
export const HIGH_PRECISION = {
  pi: Math.PI,
  e: Math.E,
  sqrt2: Math.SQRT2,
  ln10: Math.LN10,
};
