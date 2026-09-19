/**
 * core/quantity — 物理量与单位（维度检查、SI 换算、温度语义）。
 *
 * 设计（plan.md §6.2、AGENTS.md §7、§21.3、§21.4）：
 * - 内部计算统一 SI；输入/显示可用常用实验单位；
 * - 角度视为无量纲（rad=1，deg=π/180），避免 ωr 等维度冲突；
 * - ℃ 是带偏置单位：温度值转换与温差转换语义不同，必须分开调用；
 * - 单位转换必须维度检查，维度不相容时抛 DimensionMismatchError。
 */

/** 基础维度向量（指数表）。角（angle）并入无量纲。 */
export interface Dimension {
  L?: number; // 长度
  M?: number; // 质量
  T?: number; // 时间
  I?: number; // 电流
  Θ?: number; // 热力学温度
  N?: number; // 物质的量
  J?: number; // 发光强度
  [key: string]: number | undefined;
}

export const DIMENSIONLESS: Dimension = {};

export class DimensionMismatchError extends Error {
  constructor(from: string, to: string) {
    super(`单位量纲不相容：无法在 "${from}" 与 "${to}" 之间换算`);
    this.name = 'DimensionMismatchError';
  }
}

export class UnknownUnitError extends Error {
  constructor(unit: string) {
    super(`未知单位："${unit}"`);
    this.name = 'UnknownUnitError';
  }
}

export interface UnitDef {
  id: string;
  /** 量纲 */
  dim: Dimension;
  /** 换算到该量纲 SI 基准的因子 */
  factor: number;
  /** 偏置（仅 ℃/℉ 等绝对温度刻度） */
  offset?: number;
  /** 中文名 */
  zh: string;
  /** 量纲族名（UI 分组用） */
  family: string;
  /** 是否温度偏置单位 */
  isTemperatureScale?: boolean;
}

const U = (id: string, dim: Dimension, factor: number, zh: string, family: string, extra?: Partial<UnitDef>): UnitDef => ({
  id, dim, factor, zh, family, ...extra,
});

/** 单位注册表。factor = 1 SI 基准单位。 */
const UNITS: Record<string, UnitDef> = Object.fromEntries(
  [
    // 无量纲
    U('', DIMENSIONLESS, 1, '无量纲', 'dimensionless'),
    U('rad', DIMENSIONLESS, 1, '弧度', 'angle'),
    U('deg', DIMENSIONLESS, Math.PI / 180, '度', 'angle'),
    U('rev', DIMENSIONLESS, 2 * Math.PI, '转', 'angle'),
    U('%', DIMENSIONLESS, 0.01, '百分数', 'dimensionless'),
    // 长度 m
    U('m', { L: 1 }, 1, '米', 'length'),
    U('cm', { L: 1 }, 0.01, '厘米', 'length'),
    U('mm', { L: 1 }, 0.001, '毫米', 'length'),
    U('μm', { L: 1 }, 1e-6, '微米', 'length'),
    U('nm', { L: 1 }, 1e-9, '纳米', 'length'),
    U('km', { L: 1 }, 1000, '千米', 'length'),
    // 面积 m²
    U('m2', { L: 2 }, 1, '平方米', 'area'),
    U('cm2', { L: 2 }, 1e-4, '平方厘米', 'area'),
    U('mm2', { L: 2 }, 1e-6, '平方毫米', 'area'),
    // 体积 m³
    U('m3', { L: 3 }, 1, '立方米', 'volume'),
    U('cm3', { L: 3 }, 1e-6, '立方厘米', 'volume'),
    U('L', { L: 3 }, 1e-3, '升', 'volume'),
    U('mL', { L: 3 }, 1e-6, '毫升', 'volume'),
    // 质量 kg
    U('kg', { M: 1 }, 1, '千克', 'mass'),
    U('g', { M: 1 }, 1e-3, '克', 'mass'),
    U('mg', { M: 1 }, 1e-6, '毫克', 'mass'),
    // 时间 s
    U('s', { T: 1 }, 1, '秒', 'time'),
    U('ms', { T: 1 }, 1e-3, '毫秒', 'time'),
    U('μs', { T: 1 }, 1e-6, '微秒', 'time'),
    U('min', { T: 1 }, 60, '分', 'time'),
    U('h', { T: 1 }, 3600, '小时', 'time'),
    // 频率 Hz（T⁻¹）
    U('Hz', { T: -1 }, 1, '赫兹', 'frequency'),
    U('kHz', { T: -1 }, 1e3, '千赫兹', 'frequency'),
    U('MHz', { T: -1 }, 1e6, '兆赫兹', 'frequency'),
    // 温度（Θ）——℃ 为偏置刻度
    U('K', { Θ: 1 }, 1, '开尔文', 'temperature'),
    U('degC', { Θ: 1 }, 1, '摄氏度', 'temperature', { offset: 273.15, isTemperatureScale: true }),
    // 力 N
    U('N', { L: 1, M: 1, T: -2 }, 1, '牛顿', 'force'),
    U('kN', { L: 1, M: 1, T: -2 }, 1e3, '千牛', 'force'),
    U('mN', { L: 1, M: 1, T: -2 }, 1e-3, '毫牛', 'force'),
    // 能量 J
    U('J', { L: 2, M: 1, T: -2 }, 1, '焦耳', 'energy'),
    U('kJ', { L: 2, M: 1, T: -2 }, 1e3, '千焦', 'energy'),
    U('mJ', { L: 2, M: 1, T: -2 }, 1e-3, '毫焦', 'energy'),
    // 功率 W
    U('W', { L: 2, M: 1, T: -3 }, 1, '瓦特', 'power'),
    U('mW', { L: 2, M: 1, T: -3 }, 1e-3, '毫瓦', 'power'),
    U('kW', { L: 2, M: 1, T: -3 }, 1e3, '千瓦', 'power'),
    // 电流 A
    U('A', { I: 1 }, 1, '安培', 'current'),
    U('mA', { I: 1 }, 1e-3, '毫安', 'current'),
    U('μA', { I: 1 }, 1e-6, '微安', 'current'),
    // 电压 V
    U('V', { L: 2, M: 1, T: -3, I: -1 }, 1, '伏特', 'voltage'),
    U('mV', { L: 2, M: 1, T: -3, I: -1 }, 1e-3, '毫伏', 'voltage'),
    U('μV', { L: 2, M: 1, T: -3, I: -1 }, 1e-6, '微伏', 'voltage'),
    U('kV', { L: 2, M: 1, T: -3, I: -1 }, 1e3, '千伏', 'voltage'),
    // 电阻 Ω
    U('Ω', { L: 2, M: 1, T: -3, I: -2 }, 1, '欧姆', 'resistance'),
    U('mΩ', { L: 2, M: 1, T: -3, I: -2 }, 1e-3, '毫欧', 'resistance'),
    U('kΩ', { L: 2, M: 1, T: -3, I: -2 }, 1e3, '千欧', 'resistance'),
    U('MΩ', { L: 2, M: 1, T: -3, I: -2 }, 1e6, '兆欧', 'resistance'),
    // 电荷 C
    U('C', { T: 1, I: 1 }, 1, '库仑', 'charge'),
    // 电容 F
    U('F', { L: -2, M: -1, T: 4, I: 2 }, 1, '法拉', 'capacitance'),
    U('mF', { L: -2, M: -1, T: 4, I: 2 }, 1e-3, '毫法', 'capacitance'),
    U('μF', { L: -2, M: -1, T: 4, I: 2 }, 1e-6, '微法', 'capacitance'),
    U('nF', { L: -2, M: -1, T: 4, I: 2 }, 1e-9, '纳法', 'capacitance'),
    U('pF', { L: -2, M: -1, T: 4, I: 2 }, 1e-12, '皮法', 'capacitance'),
    // 电感 H
    U('H', { L: 2, M: 1, T: -2, I: -2 }, 1, '亨利', 'inductance'),
    U('mH', { L: 2, M: 1, T: -2, I: -2 }, 1e-3, '毫亨', 'inductance'),
    U('μH', { L: 2, M: 1, T: -2, I: -2 }, 1e-6, '微亨', 'inductance'),
    // 磁感应强度 T
    U('T', { M: 1, T: -2, I: -1 }, 1, '特斯拉', 'magnetic'),
    U('mT', { M: 1, T: -2, I: -1 }, 1e-3, '毫特', 'magnetic'),
    U('μT', { M: 1, T: -2, I: -1 }, 1e-6, '微特', 'magnetic'),
    U('Gs', { M: 1, T: -2, I: -1 }, 1e-4, '高斯', 'magnetic'),
    // 压强 Pa
    U('Pa', { L: -1, M: 1, T: -2 }, 1, '帕斯卡', 'pressure'),
    U('kPa', { L: -1, M: 1, T: -2 }, 1e3, '千帕', 'pressure'),
    // 密度 kg/m³
    U('kg/m3', { L: -3, M: 1 }, 1, '千克每立方米', 'density'),
    U('g/cm3', { L: -3, M: 1 }, 1000, '克每立方厘米', 'density'),
    // 热导率 W/(m·K)
    U('W/(m·K)', { L: 1, M: 1, T: -3, Θ: -1 }, 1, '瓦每米开', 'thermal'),
    // 比热 J/(kg·K)
    U('J/(kg·K)', { L: 2, T: -2, Θ: -1 }, 1, '焦每千克开', 'thermal'),
    // 霍尔系数 m³/C
    U('m3/C', { L: 3, T: -1, I: -1 }, 1, '立方米每库仑', 'electronic'),
    U('cm3/C', { L: 3, T: -1, I: -1 }, 1e-6, '立方厘米每库仑', 'electronic'),
    // 迁移率 m²/(V·s)
    U('m2/(V·s)', { L: -1, T: 2, I: 1 }, 1, '平方米每伏秒', 'electronic'),
    U('cm2/(V·s)', { L: -1, T: 2, I: 1 }, 1e-4, '平方厘米每伏秒', 'electronic'),
    // 载流子浓度（m⁻³）
    U('m-3', { L: -3 }, 1, '每立方米', 'electronic'),
    U('cm-3', { L: -3 }, 1e6, '每立方厘米', 'electronic'),
    // 角频率 / 角速度 rad/s（无量纲/时间）
    U('rad/s', { T: -1 }, 1, '弧度每秒', 'frequency'),
  ].map((u) => [u.id, u]),
);

/** 符号别名（用户输入友好） */
const ALIASES: Record<string, string> = {
  '°C': 'degC', '℃': 'degC', 'C°': 'degC', celsius: 'degC', 摄氏度: 'degC',
  '°': 'deg', '°deg': 'deg', degree: 'deg', 度: 'deg',
  radian: 'rad', 弧度: 'rad',
  ohm: 'Ω', 'Ω': 'Ω', 'ohms': 'Ω',
  u: 'μ', // 前缀化处理见 normalizeUnit
  'μV': 'μV', uv: 'μV', 'μA': 'μA', ua: 'μA', 'μF': 'μF', uf: 'μF',
  'μm': 'μm', um: 'μm', 'μs': 'μs', us: 'μs', 'μT': 'μT', ut: 'μT',
  'm²': 'm2', 'cm²': 'cm2', 'mm²': 'mm2', 'm³': 'm3', 'cm³': 'cm3',
  'kg/m³': 'kg/m3', 'g/cm³': 'g/cm3', 'm³/C': 'm3/C', 'cm³/C': 'cm3/C',
  'm²/(V·s)': 'm2/(V·s)', 'cm²/(V·s)': 'cm2/(V·s)',
  'W/(mK)': 'W/(m·K)', 'W/mK': 'W/(m·K)', 'W/(m.K)': 'W/(m·K)',
  'J/(kgK)': 'J/(kg·K)', 'J/kgK': 'J/(kg·K)',
  'V·s': 'V*s_unused',
  '': '',
  '1': '', 个: '', count: '',
};

/** 归一化单位符号 */
export function normalizeUnit(unit: string): string {
  const s = unit.trim();
  if (s === '') return '';
  if (UNITS[s]) return s;
  if (ALIASES[s] !== undefined && ALIASES[s] !== '') {
    const target = ALIASES[s];
    if (UNITS[target]) return target;
  }
  // 组合前缀尝试：如 "uV" → μV
  const uSub = s.replace(/^u(?=[AFVTsmHΩΩ])/, 'μ');
  if (UNITS[uSub]) return uSub;
  throw new UnknownUnitError(unit);
}

export function getUnitDef(unit: string): UnitDef {
  const id = normalizeUnit(unit);
  const def = UNITS[id];
  if (!def) throw new UnknownUnitError(unit);
  return def;
}

export function tryGetUnitDef(unit: string): UnitDef | undefined {
  try {
    return getUnitDef(unit);
  } catch {
    return undefined;
  }
}

export function dimensionOf(unit: string): Dimension {
  return getUnitDef(unit).dim;
}

export function dimEqual(a: Dimension, b: Dimension): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    if ((a[k] ?? 0) !== (b[k] ?? 0)) return false;
  }
  return true;
}

export function dimIsDimensionless(d: Dimension): boolean {
  return dimEqual(d, DIMENSIONLESS);
}

export function dimMul(a: Dimension, b: Dimension): Dimension {
  const out: Dimension = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const e = (a[k] ?? 0) + (b[k] ?? 0);
    if (e !== 0) out[k] = e;
  }
  return out;
}

export function dimPow(a: Dimension, p: number): Dimension {
  const out: Dimension = {};
  for (const k of Object.keys(a)) {
    const e = (a[k] ?? 0) * p;
    if (e !== 0) out[k] = e;
  }
  return out;
}

export function dimDivide(a: Dimension, b: Dimension): Dimension {
  return dimMul(a, dimPow(b, -1));
}

const DIM_SYMBOLS: Record<string, string> = { L: 'm', M: 'kg', T: 's', I: 'A', Θ: 'K', N: 'mol', J: 'cd' };

/** 维度的人类可读表达，如 "kg·m·s⁻²" */
export function dimensionToString(d: Dimension): string {
  if (dimIsDimensionless(d)) return '无量纲';
  const parts: string[] = [];
  for (const k of ['L', 'M', 'T', 'I', 'Θ', 'N', 'J']) {
    const e = d[k] ?? 0;
    if (e === 0) continue;
    parts.push(e === 1 ? DIM_SYMBOLS[k] : `${DIM_SYMBOLS[k]}${sup(e)}`);
  }
  return parts.join('·');
}

function sup(n: number): string {
  const map: Record<string, string> = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
  return String(n).split('').map((c) => map[c] ?? c).join('');
}

/** 温度绝对值换算（带偏置语义）：℃ → K 等 */
export function convertTemperature(value: number, from: string, to: string): number {
  const f = getUnitDef(from);
  const t = getUnitDef(to);
  if (!dimEqual(f.dim, { Θ: 1 }) || !dimEqual(t.dim, { Θ: 1 })) throw new DimensionMismatchError(from, to);
  const kelvin = (f.offset ?? 0) + value * f.factor;
  return (kelvin - (t.offset ?? 0)) / t.factor;
}

/** 温差换算（只缩放，无偏置）：Δt 数值 ℃ 与 K 相同 */
export function convertDeltaTemperature(value: number, from: string, to: string): number {
  const f = getUnitDef(from);
  const t = getUnitDef(to);
  if (!dimEqual(f.dim, { Θ: 1 }) || !dimEqual(t.dim, { Θ: 1 })) throw new DimensionMismatchError(from, to);
  return (value * f.factor) / t.factor;
}

/** 一般单位换算（非偏置单位）；温度请用 convertTemperature/convertDeltaTemperature */
export function convert(value: number, from: string, to: string): number {
  const f = getUnitDef(from);
  const t = getUnitDef(to);
  if (f.isTemperatureScale || t.isTemperatureScale) {
    // 只有同族温度刻度才允许走绝对换算
    if (dimEqual(f.dim, { Θ: 1 }) && dimEqual(t.dim, { Θ: 1 })) return convertTemperature(value, from, to);
    throw new DimensionMismatchError(from, to);
  }
  if (!dimEqual(f.dim, t.dim)) throw new DimensionMismatchError(from, to);
  return (value * f.factor) / t.factor;
}

/** 转到 SI 基准数值（该量纲下 factor=1 的单位） */
export function toSIValue(value: number, unit: string): number {
  const f = getUnitDef(unit);
  if (f.isTemperatureScale) return convertTemperature(value, unit, 'K');
  return value * f.factor;
}

/** 从 SI 基准数值转到指定单位 */
export function fromSIValue(valueSI: number, unit: string): number {
  const f = getUnitDef(unit);
  if (f.isTemperatureScale) return convertTemperature(valueSI, 'K', unit);
  return valueSI / f.factor;
}

/** SI 基准单位符号（用于量纲显示） */
export function siBaseUnitOf(dim: Dimension): string {
  return dimensionToString(dim);
}

/** 物理量：数值 + 单位 */
export interface QuantityValue {
  value: number;
  unit: string;
}

export function quantity(value: number, unit: string): QuantityValue {
  return { value, unit };
}

export function qToSI(q: QuantityValue): QuantityValue {
  return { value: toSIValue(q.value, q.unit), unit: siBaseUnitOf(dimensionOf(q.unit)) };
}

export function qConvert(q: QuantityValue, to: string): QuantityValue {
  return { value: convert(q.value, q.unit, to), unit: to };
}

/** 同量纲检查（用于输入校验与维度预检查） */
export function sameDimension(a: string, b: string): boolean {
  return dimEqual(dimensionOf(a), dimensionOf(b));
}

/** 列出某量纲族的所有单位（UI 下拉） */
export function unitsOfFamily(family: string): string[] {
  return Object.values(UNITS).filter((u) => u.family === family).map((u) => u.id);
}

export function families(): string[] {
  const seen = new Set<string>();
  for (const u of Object.values(UNITS)) seen.add(u.family);
  return [...seen];
}

export function unitZh(unit: string): string {
  return tryGetUnitDef(unit)?.zh ?? unit;
}

/** 显示友好：上标 2/3 转为 ²/³ */
export function displayUnit(unit: string): string {
  return unit.replace(/m2(?![/(a-z])/g, 'm²').replace(/m3(?![/(])/g, 'm³').replace(/cm2(?![/(])/g, 'cm²').replace(/cm3(?![/(])/g, 'cm³').replace(/-3$/, '⁻³');
}

export const UNIT_CATALOG = UNITS;
