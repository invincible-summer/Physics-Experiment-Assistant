/**
 * 变量名（mathjs 作用域符号）→ LaTeX 符号映射。
 * 仅做显示层排版转换，不改变量名与计算语义；未知名回退为 \mathrm{} 原样。
 */

/** 拼写出的希腊字母 → TeX 命令（含仓库惯用的 lam = λ） */
const GREEK_TEX: Record<string, string> = {
  alpha: '\\alpha', beta: '\\beta', gamma: '\\gamma', delta: '\\delta',
  epsilon: '\\epsilon', zeta: '\\zeta', eta: '\\eta', theta: '\\theta',
  iota: '\\iota', kappa: '\\kappa', lambda: '\\lambda', lam: '\\lambda',
  mu: '\\mu', nu: '\\nu', xi: '\\xi', pi: '\\pi', rho: '\\rho',
  sigma: '\\sigma', tau: '\\tau', phi: '\\phi', chi: '\\chi',
  psi: '\\psi', omega: '\\omega',
  Gamma: '\\Gamma', Delta: '\\Delta', Theta: '\\Theta', Lambda: '\\Lambda',
  Xi: '\\Xi', Pi: '\\Pi', Sigma: '\\Sigma', Phi: '\\Phi', Psi: '\\Psi', Omega: '\\Omega',
};

/** 已核对注册表语境的语义化符号（覆盖通用规则） */
const OVERRIDES: Record<string, string> = {
  // 振动族一律以 w 表角频率 ω（见 src/formulas/oscillation.ts 变量标签）
  w: '\\omega', w0: '\\omega_0', wd: '\\omega_d',
  xbar: '\\bar{x}',
  // 课程模式不确定度分量（见 src/formulas/measurement.ts）
  dA: '\\Delta_A', dB: '\\Delta_B', dInst: '\\Delta_{仪}',
};

/**
 * 变量名 → LaTeX：
 * 1. 显式覆盖表 / 希腊字母拼写整体命中 → TeX 命令；
 * 2. `base_sub` 或尾随数字 → 下标（base 递归映射）；
 * 3. 单字母 → 原样（数学斜体）；
 * 4. 其余多字母名 → \mathrm{}（避免被排版成字母乘积）。
 */
export function varSymbolTex(name: string): string {
  const override = OVERRIDES[name];
  if (override) return override;
  const greek = GREEK_TEX[name];
  if (greek) return greek;
  const sub = name.match(/^([A-Za-z]+)_([A-Za-z0-9]+)$/);
  if (sub) return `${varSymbolTex(sub[1])}_{${sub[2]}}`;
  const digits = name.match(/^([A-Za-z]+?)(\d+)$/);
  if (digits) return `${varSymbolTex(digits[1])}_{${digits[2]}}`;
  if (name.length === 1) return name;
  return `\\mathrm{${name}}`;
}
