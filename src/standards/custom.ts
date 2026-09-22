/** custom — 用户自定义配置。显式参数组成，禁止隐式继承相互矛盾的规则。 */
import { COURSE_SIGFIG, SigFigOptions } from '../core/sigfig';
import { StandardProfile } from './types';

export interface CustomProfileOptions {
  confidence: number;
  /** A 类是否乘 t 因子（course: 是；gbt 风格: 否，即直接用标准差） */
  typeAWithTFactor: boolean;
  /** B 类模式 */
  bMode: 'instrument-limit' | 'distribution';
  uncertaintyDigits: 1 | 2;
  allowLeadingDigitCompress: boolean;
  relativeDigits: 1 | 2;
  /** ΔA<ΔB/3 简化 */
  simplificationEnabled: boolean;
}

export const DEFAULT_CUSTOM_OPTIONS: CustomProfileOptions = {
  confidence: 0.95,
  typeAWithTFactor: true,
  bMode: 'instrument-limit',
  uncertaintyDigits: 2,
  allowLeadingDigitCompress: true,
  relativeDigits: 2,
  simplificationEnabled: true,
};

export function buildCustomProfile(opts: CustomProfileOptions): StandardProfile {
  const sigfig: SigFigOptions = {
    uncertaintyDigits: opts.uncertaintyDigits,
    allowLeadingDigitCompress: opts.allowLeadingDigitCompress,
    relativeDigits: opts.relativeDigits,
    sciUpper: COURSE_SIGFIG.sciUpper,
    sciLower: COURSE_SIGFIG.sciLower,
  };
  return {
    id: 'custom',
    version: 1,
    kind: 'custom',
    name: '自定义规则',
    shortName: '自定义',
    confidence: opts.confidence,
    notation: opts.bMode === 'distribution' ? { direct: 'u', combined: 'u_c', expanded: 'U' } : { direct: 'Δ', combined: 'Δ' },
    bType: { mode: opts.bMode },
    simplification: {
      enabled: opts.simplificationEnabled,
      threshold: 1 / 3,
      label: '当 $\\Delta_A<\\Delta_B/3$ 时取 $\\Delta=\\Delta_B$（可关闭）',
    },
    sigfig,
    rulesSummary: [
      `自定义规则，不代表课程或 GB/T 标准`,
      `包含概率 $P=${opts.confidence}$`,
      `A 类${opts.typeAWithTFactor ? '乘 $t$ 因子' : '直接用平均值标准不确定度'}`,
      opts.bMode === 'instrument-limit' ? 'B 类直接取误差限' : 'B 类按分布换算为标准不确定度',
      opts.typeAWithTFactor && opts.bMode === 'distribution'
        ? '⚠ 此组合把 t 因子化的 A 类与标准不确定度形式的 B 类混算，与 GB/T 相悖'
        : '参数组合',
    ],
    source: '用户自定义',
    description:
      '显式参数组成的自定义配置。切换到本配置时，界面永久显示"自定义规则，不代表课程或 GB/T 标准"。',
  };
}
