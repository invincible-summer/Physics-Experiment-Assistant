/** gbt-27418-2017 — GB/T 27418-2017 测量不确定度评定和表示 */
import { GBT_SIGFIG } from '../core/sigfig';
import { StandardProfile } from './types';

export const GBT_27418_2017: StandardProfile = {
  id: 'gbt-27418-2017',
  version: 1,
  kind: 'gbt',
  name: 'GB/T 27418-2017',
  shortName: 'GB/T',
  confidence: 0.95,
  notation: { direct: 'u', combined: 'u_c', expanded: 'U' },
  bType: { mode: 'distribution' },
  // GB/T 无课程简化规则——标准不确定度就是一倍标准差
  sigfig: GBT_SIGFIG,
  rulesSummary: [
    'A/B 是评定方法类别，最终都转换为标准差形式的标准不确定度 u',
    'B 类按输入信息的概率分布换算：矩形半宽 a → a/√3；三角半宽 a → a/√6',
    '正态信息按包含因子/包含概率换算为标准不确定度',
    '独立输入：u_c²(y) = Σ cᵢ²u²(xᵢ)，cᵢ = ∂f/∂xᵢ',
    '相关输入：加入协方差项 2Σᵢⱼ cᵢcⱼu(xᵢ,xⱼ)',
    '有效自由度按 Welch–Satterthwaite 公式',
    '扩展不确定度 U = k·u_c 或 U_p = t_p(ν_eff)·u_c',
    'u(x)、u_c(y)、U 通常最多 2 位有效数字',
    '报告必须说明是标准不确定度还是扩展不确定度（k 或 p）',
    '禁止把课程模式的 ΔB=Δ仪 与本模式的分布换算混合',
  ],
  source: '《GB/T 27418-2017 测量不确定度评定和表示》',
  description:
    '国家标准模式。A 类取平均值的标准不确定度（不加 t 因子），B 类按分布换算为标准差，需要高包含概率时显式计算扩展不确定度。',
};
