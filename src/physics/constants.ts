/**
 * 物理常数（plan §7.1）。
 * 来源与精确性：
 * - SI 定义常数（c/h/e/k_B/N_A）按 BIPM 固定值，标记 exact；
 * - 由 exact 常数派生的量（ħ = h/2π、R = N_A·k_B）同样 exact；
 * - 其余采用 NIST/CODATA 2022 推荐值，非 exact；
 * - 标准重力 g_n 与课程默认 g=9.8 明确区分，避免与万有引力常量 G 混淆。
 * 公式表达式中字母 e 已被表达式引擎保留为 Euler 常数；基本电荷一律用 q_e。
 */
export interface PhysicsConstantDef {
  symbol: string;
  name: string;
  value: number;
  unit: string;
  isExact: boolean;
  source: string;
  note?: string;
}

const C = (symbol: string, name: string, value: number, unit: string, isExact: boolean, source: string, note?: string): PhysicsConstantDef =>
  ({ symbol, name, value, unit, isExact, source, note });

/** h/(2π)，由 exact h 派生 */
const HBAR = 6.62607015e-34 / (2 * Math.PI);

export const PHYSICS_CONSTANTS: PhysicsConstantDef[] = [
  // ---- SI 定义常数（BIPM 固定值，exact） ----
  C('c', '真空光速', 299792458, 'm/s', true, 'BIPM SI 定义常数'),
  C('h', '普朗克常量', 6.62607015e-34, 'J·s', true, 'BIPM SI 定义常数'),
  C('q_e', '元电荷', 1.602176634e-19, 'C', true, 'BIPM SI 定义常数', '表达式引擎中 e 为 Euler 常数，基本电荷统一记 q_e'),
  C('k_B', '玻尔兹曼常数', 1.380649e-23, 'J/K', true, 'BIPM SI 定义常数'),
  C('N_A', '阿伏伽德罗常数', 6.02214076e23, '1/mol', true, 'BIPM SI 定义常数'),
  C('ħ', '约化普朗克常量', HBAR, 'J·s', true, '由 exact h/(2π) 派生'),
  C('R', '摩尔气体常数', 6.02214076e23 * 1.380649e-23, 'J/(mol·K)', true, 'R = N_A·k_B（两者均 exact）'),

  // ---- CODATA 2022 推荐值（非 exact） ----
  C('G', '万有引力常量', 6.6743e-11, 'm3/(kg·s2)', false, 'NIST/CODATA 2022'),
  C('ε0', '真空介电常数', 8.8541878128e-12, 'F/m', false, 'NIST/CODATA 2022'),
  C('μ0', '真空磁导率', 1.25663706127e-6, 'N/A2', false, 'NIST/CODATA 2022'),
  C('m_e', '电子质量', 9.1093837139e-31, 'kg', false, 'NIST/CODATA 2022'),
  C('m_p', '质子质量', 1.67262192595e-27, 'kg', false, 'NIST/CODATA 2022'),
  C('m_n', '中子质量', 1.67492750056e-27, 'kg', false, 'NIST/CODATA 2022'),
  C('u', '原子质量单位', 1.66053906892e-27, 'kg', false, 'NIST/CODATA 2022'),
  C('R_∞', '里德伯常数', 10973731.568160, 'm-1', false, 'NIST/CODATA 2022'),
  C('a_0', '玻尔半径', 5.29177210544e-11, 'm', false, 'NIST/CODATA 2022'),

  // ---- 重力加速度（语义区分，plan §7.1） ----
  C('g_n', '标准重力加速度', 9.80665, 'm/s2', true, 'BIPM 标准重力定义值'),
  C('g', '课程默认重力加速度', 9.8, 'm/s2', false, '2026 秋 A(1) 课程常用默认值，实验中可编辑', '课程默认，非标准重力 g_n，也非万有引力常量 G'),
];

/** 按符号取常数定义 */
export function getConstant(symbol: string): PhysicsConstantDef | undefined {
  return PHYSICS_CONSTANTS.find((c) => c.symbol === symbol);
}

// ---- 常用数值快捷导出（公式定义使用） ----
export const SPEED_OF_LIGHT = 299792458; // m/s（exact）
export const PLANCK_CONSTANT = 6.62607015e-34; // J·s（exact）
export const ELEMENTARY_CHARGE = 1.602176634e-19; // C（exact）
export const BOLTZMANN_CONSTANT = 1.380649e-23; // J/K（exact）
export const AVOGADRO_CONSTANT = 6.02214076e23; // 1/mol（exact）
export const HBAR_CONSTANT = HBAR; // J·s
export const MOLAR_GAS_CONSTANT = 6.02214076e23 * 1.380649e-23; // J/(mol·K)（exact，N_A·k_B）
export const GRAVITATIONAL_CONSTANT = 6.6743e-11; // m³/(kg·s²)（CODATA 2022）
export const VACUUM_PERMITTIVITY = 8.8541878128e-12; // F/m（CODATA 2022）
export const VACUUM_PERMEABILITY = 1.25663706127e-6; // N/A²（CODATA 2022）
export const ELECTRON_MASS = 9.1093837139e-31; // kg（CODATA 2022）
export const PROTON_MASS = 1.67262192595e-27; // kg（CODATA 2022）
export const ATOMIC_MASS_UNIT = 1.66053906892e-27; // kg（CODATA 2022）
export const RYDBERG_CONSTANT = 10973731.568160; // 1/m（CODATA 2022）
export const BOHR_RADIUS = 5.29177210544e-11; // m（CODATA 2022）
export const STANDARD_GRAVITY = 9.80665; // m/s²（标准重力，定义值）
/** 课程默认重力加速度（区别于标准重力 g_n 与万有引力常量 G，plan §7.1） */
export const COURSE_DEFAULT_G = 9.8; // m/s²
