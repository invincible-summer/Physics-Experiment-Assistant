/** tsinghua-a1-2026 — 默认课程标准（最高优先级资料） */
import { COURSE_SIGFIG } from '../core/sigfig';
import { StandardProfile } from './types';

export const TSINGHUA_A1_2026: StandardProfile = {
  id: 'tsinghua-a1-2026',
  version: 1,
  kind: 'course',
  name: '2026 秋物理实验 A(1)',
  shortName: '2026 A(1)',
  confidence: 0.95,
  notation: { direct: 'Δ', combined: 'Δ' },
  bType: { mode: 'instrument-limit' },
  simplification: {
    enabled: true,
    threshold: 1 / 3,
    label: '当 ΔA < Δ仪/3 时，总不确定度简化取 Δ = Δ仪',
  },
  sigfig: COURSE_SIGFIG,
  rulesSummary: [
    '置信概率 P = 0.95',
    'A 类分量 ΔA = t₀.₉₅(ν)·S_x̄，自由度 ν = n−1',
    'B 类分量 ΔB = Δ仪（仪器误差限，教学简化）',
    '总不确定度 Δ = √(ΔA² + ΔB²)（方和根合成）',
    '单次测量取 Δ = Δ仪',
    'ΔA < Δ仪/3 时允许简化为 Δ = Δ仪（界面会提示"采用课程简化规则"）',
    '不确定度一般取 2 位有效数字；首位 ≥3 时可取 1 位',
    '相对不确定度取 2 位有效数字',
    '最终测量值末位与不确定度末位对齐',
    '间接量按独立输入的偏导方和根传播：ΔY = √(Σ(∂f/∂xᵢ·Δxᵢ)²)',
    '已定系统误差先行修正，再报告估计值',
  ],
  source: '《2026秋物理实验A(1)教学资料》数据处理章节；绪论课 PPT 细化规则',
  description:
    '当前默认课程标准。完整支持 7 个必做实验的课程规则。测量不确定度采用教学简化模式：ΔB 直接取仪器误差限。',
  supportsExperiments: ['friction', 'hall', 'thermal', 'damping', 'scope-sound', 'lens', 'michelson'],
};
