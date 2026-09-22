/** tsinghua-foundation-2020 — 历史课程/绪论课兼容配置 */
import { COURSE_SIGFIG } from '../core/sigfig';
import { StandardProfile } from './types';

export const TSINGHUA_FOUNDATION_2020: StandardProfile = {
  id: 'tsinghua-foundation-2020',
  version: 1,
  kind: 'course',
  name: '2020 课程基础知识 / 绪论兼容',
  shortName: '2020 基础',
  confidence: 0.95,
  notation: { direct: 'Δ', combined: 'Δ' },
  bType: { mode: 'instrument-limit' },
  simplification: {
    enabled: true,
    threshold: 1 / 3,
    label: '当 $\\Delta_A<\\Delta_{\\text{仪}}/3$ 时，总不确定度简化取 $\\Delta=\\Delta_{\\text{仪}}$',
  },
  sigfig: COURSE_SIGFIG,
  rulesSummary: [
    '置信概率 $P=0.95$',
    '$\\Delta_A=t_{0.95}(\\nu)\\,S_{\\bar{x}}$，$\\nu=n-1$',
    '$\\Delta_B=\\Delta_{\\text{仪}}$',
    '$\\Delta=\\sqrt{\\Delta_A^2+\\Delta_B^2}$',
    '不确定度 2 位有效数字，首位 $\\ge 3$ 可 1 位',
    '中间计算可多留几位，最终统一修约（绪论课 PPT）',
    '未估算不确定度时：加减按小数位对齐；乘除按最少有效数字（或多取 1 位）',
  ],
  source: '《课程基础知识202009.pptx》《讲义第II部分课程基础知识.pdf》',
  description:
    '历史课程兼容配置，用于复现 2020 讲义与绪论课 PPT 的计算与显示规则。数学规则与 2026 A(1) 相同，文档来源标注不同。',
};
