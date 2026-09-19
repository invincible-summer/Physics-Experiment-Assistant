/** 各公式主结果的单位（供公式计算器显示与单位换算） */
export const RESULT_UNITS: Record<string, string> = {
  // 测量
  mean: '', residual: '', 'sample-std': '', sem: '',
  'course-type-a': '', 'course-type-b': '', 'course-total-uncertainty': '',
  'relative-uncertainty': '', 'indirect-rss': '', 'linear-regression': '',
  'fit-correlation': '', 'fit-parameter-uncertainty': '', 'half-range': '',
  // 仪器
  'analog-meter-error': '', 'digital-meter-reading-digits': '', 'digital-meter-reading-range': '',
  'digital-meter-combined': '', 'resistance-box-error': 'Ω',
  // 摩擦
  'weight-from-mass': 'N', capstan: 'N',
  // 霍尔
  'hall-voltage': 'V', 'hall-four-direction-combination': 'V', 'hall-coefficient': 'm3/C',
  'hall-sensitivity': 'm3/C', 'carrier-density': 'm-3', magnetoresistance: '',
  // 热学
  'fourier-law': 'W/m2', 'quasi-steady-lambda': 'W/(m·K)', 'quasi-steady-specific-heat': 'J/(kg·K)',
  'heat-flux-electrical': 'W/m2', 'thermocouple-linear': 'K',
  // 振动
  'damped-omega': 'rad/s', 'damped-period': 's', 'damping-ratio': '', 'time-constant': 's',
  'quality-factor': '', 'log-decrement': '', 'forced-amplitude': '', 'forced-phase': 'rad',
  'resonance-frequency': 'rad/s', 'zeta-from-fit-slope': '',
  // 波动
  'scope-voltage-div': 'V', 'scope-period-div': 's', 'frequency-period': 'Hz', 'phase-time': 'rad',
  'lissajous-frequency': 'Hz', 'sound-speed': 'm/s', 'ideal-gas-sound-speed': 'm/s',
  'dry-air-sound-speed': 'm/s', 'humid-air-sound-speed': 'm/s', 'rc-charge': 'V',
  'rc-differentiator': 'V', 'lc-resonance': 'Hz',
  // 光学
  'thin-lens': 'm', magnification: '', 'bessel-focal-length': 'm', 'focimeter': 'm',
  'concave-autocollimation': 'm', 'michelson-equal-inclination': 'm', 'michelson-wavelength': 'm',
  'michelson-white-light-plate': 'm',
  // GB/T
  'standard-uncertainty-type-a': '', 'rectangular-standard-uncertainty': '',
  'triangular-standard-uncertainty': '', 'normal-coverage-to-standard': '',
  'combined-standard-uncertainty-independent': '', 'combined-standard-uncertainty-correlated': '',
  'effective-dof': '', 'expanded-uncertainty': '',
};

/** 从 latex 提取等式左侧符号 */
export function resultSymbolFromLatex(latex: string): string {
  const eq = latex.indexOf('=');
  if (eq < 0) return '';
  return latex.slice(0, eq).trim().replace(/\\mathrm\{[^}]*\}/g, '').trim();
}
