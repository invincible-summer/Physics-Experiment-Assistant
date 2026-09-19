/**
 * instruments — 仪器误差模型（plan.md §7）。
 *
 * 重要原则（AGENTS.md §7.4）：仪器"分辨率"不自动等于"仪器误差限"，
 * 除非课程资料或仪器说明明确规定。
 */

export interface AnalogMeterInput {
  /** 量程（满刻度值，含单位一致） */
  rangeAm: number;
  /** 准确度等级 K（0.1/0.5/1.0/1.5/2.5/5.0） */
  classK: number;
  /** 读数 */
  reading: number;
}

export interface AnalogMeterResult {
  /** 绝对误差限 ΔA = Am·K% */
  absoluteError: number;
  /** 读数处的相对误差限 */
  relativeError: number;
}

/** 模拟电表：ΔA = Am · K% */
export function analogMeterError(input: AnalogMeterInput): AnalogMeterResult {
  const absoluteError = input.rangeAm * (input.classK / 100);
  if (input.reading === 0) throw new Error('读数为 0，相对误差限无定义');
  const relativeError = absoluteError / Math.abs(input.reading);
  return {
    absoluteError,
    relativeError,
    // 接近满量程可降低相对误差（UI 提示）
  };
}

export interface DigitalMeterInput {
  /** 读数 */
  reading: number;
  /** 量程 */
  range: number;
  /** 分辨率（末位一个字对应的值） */
  resolution: number;
  /** α%×读数 系数 */
  alphaPercent: number;
  /** β%×量程 系数（形式 2/3 需要） */
  betaPercent?: number;
  /** 末位字数 n（形式 1/3 需要） */
  nDigits?: number;
}

export type DigitalMeterForm = 'reading-digits' | 'reading-range' | 'combined';

/** 数字仪表三种讲义形式（plan §7.2） */
export function digitalMeterError(input: DigitalMeterInput, form: DigitalMeterForm): AnalogMeterResult {
  let absolute: number;
  switch (form) {
    case 'reading-digits':
      absolute = (input.alphaPercent / 100) * input.reading + (input.nDigits ?? 1) * input.resolution;
      break;
    case 'reading-range':
      if (input.betaPercent === undefined) throw new Error('该形式需要 β% 量程系数');
      absolute = (input.alphaPercent / 100) * input.reading + (input.betaPercent / 100) * input.range;
      break;
    case 'combined':
      if (input.betaPercent === undefined) throw new Error('该形式需要 β% 量程系数');
      absolute =
        (input.alphaPercent / 100) * input.reading +
        (input.betaPercent / 100) * input.range +
        (input.nDigits ?? 1) * input.resolution;
      break;
  }
  return { absoluteError: absolute, relativeError: absolute / Math.abs(input.reading) };
}

export interface ResistanceBoxInput {
  /** 电阻箱示值 R（Ω） */
  R: number;
  /** 接入的旋钮数 N（ZX21 简化模型） */
  N: number;
}

/** ZX21 电阻箱 0.1 级简化：ΔR = 0.1%·R + 0.005(N+1) Ω */
export function resistanceBoxError(input: ResistanceBoxInput): number {
  return 0.001 * input.R + 0.005 * (input.N + 1);
}

/** 阻尼振动实验计时器：Δ仪 = 读数×10⁻⁵ + 0.001 s */
export function dampingTimerError(readingSeconds: number): number {
  return readingSeconds * 1e-5 + 0.001;
}

/** 声速实验：Δf = 10 Hz（课程指定） */
export const SOUND_FREQUENCY_ERROR = 10; // Hz

/** 焦距仪测微目镜：单位置仪器误差 0.004 mm */
export const FOCIMETER_POSITION_ERROR_MM = 0.004;

/** 光具座每位置读数仪器误差 0.05 cm */
export const OPTICAL_BENCH_POSITION_ERROR_CM = 0.05;

/** 共轭法课程给定 Δa=0.25 cm、Δb=0.20 cm */
export const CONJUGATE_ERRORS = { a: 0.25, b: 0.2 }; // cm

/** 准稳态热导热电偶灵敏度 40 μV/℃ */
export const THERMOCOUPLE_SENSITIVITY = 40e-6; // V/℃

/** 平行光管焦距相对不确定度 0.3% */
export const COLLIMATOR_FOCAL_REL_ERROR = 0.003;

/** 玻罗板线距相对不确定度 0.02%（讲义默认可忽略，可打开） */
export const GLASSPLATE_LINE_REL_ERROR = 0.0002;

export interface InstrumentTemplate {
  id: string;
  name: string;
  /** 默认 Δ仪（SI 数值）与说明；undefined 表示需要按公式计算 */
  error?: { valueSI: number; unit: string; note: string };
  errorFormula?: string;
}

/** 实验专用仪器模板（plan §7.4）。注意：电子天平分辨率 0.01g 仅作为元数据，不自动当作 Δ仪 */
export const INSTRUMENT_TEMPLATES: InstrumentTemplate[] = [
  {
    id: 'damping-timer',
    name: '阻尼振动计时器',
    errorFormula: 'Δ仪 = 读数×10⁻⁵ + 0.001 s',
  },
  {
    id: 'sound-freq',
    name: '声速信号发生器频率',
    error: { valueSI: SOUND_FREQUENCY_ERROR, unit: 'Hz', note: '课程指定 Δf = 10 Hz' },
  },
  {
    id: 'focimeter-position',
    name: '焦距仪测微目镜（单位置）',
    error: { valueSI: FOCIMETER_POSITION_ERROR_MM, unit: 'mm', note: '两位置作差时 B 分量为 √2×0.004 mm' },
  },
  {
    id: 'optical-bench',
    name: '光具座位置读数',
    error: { valueSI: OPTICAL_BENCH_POSITION_ERROR_CM, unit: 'cm', note: '每位置读数仪器误差 0.05 cm' },
  },
  {
    id: 'thermocouple',
    name: '热电偶（温差-热电势）',
    errorFormula: '线性灵敏度 40 μV/℃',
  },
  {
    id: 'balance-0.01g',
    name: '电子天平（分辨率 0.01 g）',
    error: { valueSI: 0.01, unit: 'g', note: '分辨率元数据——除非讲义明确规定，不自动当作课程 Δ仪' },
  },
];
