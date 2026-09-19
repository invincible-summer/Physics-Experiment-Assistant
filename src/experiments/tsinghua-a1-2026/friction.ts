/** 实验：摩擦系数测量（plan §10.1） */
import { ExperimentDefinition, ExperimentState, ExperimentComputation, ComputedFit } from '../types';
import { parseTable, runFit, parseParams } from '../engine';
import { makeResult } from '../../core/results';
import { formatMeasurement } from '../../core/sigfig';
import { StandardProfile } from '../../standards/types';
import { G_STANDARD } from '../../formulas/types';

const DOC = '2026秋物理实验A(1)教学资料';

export const FrictionExperiment: ExperimentDefinition = {
  id: 'friction',
  version: 1,
  title: '摩擦系数测量',
  subtitle: 'A：θ=π 的 P–W 拟合 · B：固定 W 的 P–θ 线性化 · C：未知质量与 μ 解算',
  category: '力学',
  tags: ['区间测量', '线性拟合', '线性化'],
  reportType: 'minimal',
  safety: ['砝码轻拿轻放', '绳与圆柱缠绕稳固后再加载'],
  provenance: { status: 'source-explicit', document: DOC, section: '实验一 摩擦系数测量' },
  metadataFields: [
    { id: 'name', label: '姓名', kind: 'text' },
    { id: 'studentId', label: '学号', kind: 'text' },
    { id: 'date', label: '实验日期', kind: 'text' },
  ],
  params: [
    { id: 'g', label: '重力加速度 g', unit: 'm/s²', defaultText: '9.8' },
    { id: 'MW_B', label: 'B 部分：固定砝码 MW', unit: 'g', defaultText: '800' },
    { id: 'P1', label: 'C 部分：临界状态 1 外加力 P1（下滑临界）', unit: 'g（砝码质量）', defaultText: '' },
    { id: 'P2', label: 'C 部分：临界状态 2 外加力 P2（上滑临界）', unit: 'g（砝码质量）', defaultText: '' },
    { id: 'thetaC', label: 'C 部分：包角 θu', unit: 'rad', defaultText: '' },
  ],
  datasets: [
    {
      id: 'partA',
      title: 'A：θ=π，不同 MW 下的临界质量',
      hint: 'MW、MP−、MP+ 用 g。MP=(MP−+MP+)/2 与 ΔMP=|MP+−MP−|/2 自动派生；W=MW·g、P=MP·g 单位 mN。',
      defaultRows: 8,
      columns: [
        { id: 'MW', header: 'MW', unit: 'g' },
        { id: 'MPm', header: 'MP−', unit: 'g' },
        { id: 'MPp', header: 'MP+', unit: 'g' },
        { id: 'MP', header: 'MP 中心值', unit: 'g', kind: 'derived', expression: '(MPm + MPp) / 2', formulaLatex: 'M_P = \\frac{M_{P-}+M_{P+}}{2}' },
        { id: 'dMP', header: 'ΔMP', unit: 'g', kind: 'derived', expression: 'abs(MPp - MPm) / 2', formulaLatex: '\\Delta M_P = \\frac{|M_{P+}-M_{P-}|}{2}' },
        { id: 'W', header: 'W=MW·g', unit: 'mN', kind: 'derived', expression: 'MW * g' },
        { id: 'P', header: 'P=MP·g', unit: 'mN', kind: 'derived', expression: 'MP * g' },
      ],
    },
    {
      id: 'partB',
      title: 'B：固定 MW，不同 θ 的临界质量',
      hint: 'θ 用 rad；MP±/P/ln(P/W) 派生（P/W 无量纲）。',
      defaultRows: 8,
      columns: [
        { id: 'theta', header: 'θ', unit: 'rad' },
        { id: 'MPm', header: 'MP−', unit: 'g' },
        { id: 'MPp', header: 'MP+', unit: 'g' },
        { id: 'MP', header: 'MP 中心值', unit: 'g', kind: 'derived', expression: '(MPm + MPp) / 2' },
        { id: 'P', header: 'P=MP·g', unit: 'mN', kind: 'derived', expression: '(MPm + MPp) / 2 * g' },
        { id: 'lnPW', header: 'ln(P/W)', unit: '', kind: 'derived', expression: 'ln((MPm + MPp) / 2 / MW_B)', formulaLatex: '\\ln\\frac{P}{W} = -\\mu\\theta' },
      ],
    },
  ],
  fits: [
    { id: 'a-fit', title: 'A：P–W 拟合（斜率 m=e^(−μθ)，θ=π）', tableId: 'partA', xCol: 'W', yCol: 'P', mode: 'ols', modelLatex: 'P = m\\,W,\\; m = e^{-\\mu\\theta}' },
    { id: 'b-fit-free', title: 'B：ln(P/W)–θ 自由截距拟合', tableId: 'partB', xCol: 'theta', yCol: 'lnPW', mode: 'ols', modelLatex: '\\ln(P/W) = a + b\\theta' },
    { id: 'b-fit-origin', title: 'B：ln(P/W)–θ 过原点拟合（理论式）', tableId: 'partB', xCol: 'theta', yCol: 'lnPW', mode: 'origin', modelLatex: '\\ln(P/W) = -\\mu\\theta' },
  ],
  plots: [
    { id: 'a-plot', title: 'A：P–W 图', tableId: 'partA', xCol: 'W', yCol: 'P', xLabel: 'W (mN)', yLabel: 'P (mN)', fitId: 'a-fit', fitLabel: 'P = mW' },
    { id: 'b-plot', title: 'B：ln(P/W)–θ 图', tableId: 'partB', xCol: 'theta', yCol: 'lnPW', xLabel: 'θ (rad)', yLabel: 'ln(P/W)', fitId: 'b-fit-free', fitLabel: 'y = a + bθ' },
  ],
  steps: [
    {
      id: 'masses', title: '秤盘与砝码参数',
      blocks: [
        { type: 'params', fields: ['g', 'MW_B'], title: '重力加速度与 B 部分固定砝码' },
        { type: 'note', text: 'W=MW·g、P=MP·g；内部以 mN（g×m/s²=中 1 g×9.8 m/s²=9.8 mN）显示，比例关系不受影响。' },
      ],
    },
    {
      id: 'part-a', title: 'A：θ=π，P–W',
      blocks: [
        { type: 'table', tableId: 'partA' },
        { type: 'fits', fitIds: ['a-fit'] },
        { type: 'plot', plotId: 'a-plot' },
        { type: 'results', resultIds: ['mu-a'] },
      ],
    },
    {
      id: 'part-b', title: 'B：固定 W，P–θ',
      blocks: [
        { type: 'table', tableId: 'partB' },
        { type: 'fits', fitIds: ['b-fit-free', 'b-fit-origin'] },
        { type: 'plot', plotId: 'b-plot' },
        { type: 'results', resultIds: ['mu-b'] },
      ],
    },
    {
      id: 'part-c', title: 'C：白绳 μu 与未知质量 Mu',
      blocks: [
        { type: 'params', fields: ['P1', 'P2', 'thetaC'], title: '两个临界状态（方向约定见下）' },
        { type: 'note', text: '方向约定：设绳绕圆柱包角 θu，未知质量 Mu 挂于高位端。状态1（即将下滑）：Mu g = P2·e^(−μuθu)…本工具按讲义任务意图采用对偶临界平衡模型：Mu g = √(P1·P2)、μu = ln(P2/P1)/(2θu)，推导见结果卡。P1<P2（P1 为使系统即将下滑的小端外加力，P2 为即将上滑的大端外加力）。' },
        { type: 'results', resultIds: ['part-c'] },
      ],
    },
  ],
  compute: (state: ExperimentState, profile: StandardProfile): ExperimentComputation => {
    const results = [];
    const fits: Record<string, ComputedFit> = {};
    const diagnostics: string[] = [];
    const { scope } = parseParams(FrictionExperiment.params.map((p) => ({ id: p.id })), state.params);
    const g = scope.g ?? G_STANDARD;

    // --- A ---
    const tblA = parseTable(FrictionExperiment.datasets[0], state, { g });
    const fitA = runFit(FrictionExperiment.fits[0], tblA);
    if ('ols' in fitA && fitA.ols) {
      fits['a-fit'] = fitA;
      const f = fitA.ols;
      const thetaPi = Math.PI;
      if (f.b > 0 && f.b < 1) {
        const mu = -Math.log(f.b) / thetaPi;
        const dmu = (f.deltaB / f.b) / thetaPi;
        results.push(makeResult({
          id: 'mu-a',
          title: 'A：静摩擦系数 μ（θ=π，Capstan 模型）',
          symbol: '\\mu',
          finalText: formatMeasurement(mu, dmu, profile.sigfig).text,
          steps: [
            {
              formulaLatex: 'P = W e^{-\\mu\\theta} \\;\\Rightarrow\\; \\mu = -\\frac{\\ln m}{\\theta},\\quad m=\\text{P–W 拟合斜率}',
              substitution: `m=${f.b.toPrecision(8)}（r=${f.r.toPrecision(6)}），θ=π`,
              unrounded: `μ = ${mu.toPrecision(12)}；Δμ = Δm/(mθ) = ${dmu.toPrecision(10)}`,
            },
          ],
          ruleNotes: ['Capstan 关系由实验任务意图与通用柔索模型推导，标记 source-derived，非讲义原式'],
          provenance: { status: 'source-derived', document: DOC, section: '摩擦系数测量' },
        }));
      } else {
        diagnostics.push(`A：拟合斜率 m=${f.b.toPrecision(4)} 不在 (0,1) 区间，Capstan 模型可能不适用或数据有误`);
      }
    }

    // --- B ---
    const tblB = parseTable(FrictionExperiment.datasets[1], state, { g, MW_B: scope.MW_B ?? NaN });
    const fitBFree = runFit(FrictionExperiment.fits[1], tblB);
    const fitBOrigin = runFit(FrictionExperiment.fits[2], tblB);
    if ('ols' in fitBFree && fitBFree.ols) {
      fits['b-fit-free'] = fitBFree;
      const f = fitBFree.ols;
      const mu = -f.b;
      const dmu = f.deltaB;
      const originNote = 'origin' in fitBOrigin && fitBOrigin.origin
        ? `过原点拟合：μ=${(-fitBOrigin.origin.b).toPrecision(6)}（截距强制 0，与自由截距比较可检查系统偏差）`
        : '过原点拟合数据不足';
      results.push(makeResult({
        id: 'mu-b',
        title: 'B：静摩擦系数 μ（ln(P/W)–θ 线性化）',
        symbol: '\\mu',
        finalText: formatMeasurement(mu, dmu, profile.sigfig).text,
        steps: [
          {
            formulaLatex: '\\ln\\frac{P}{W} = -\\mu\\theta',
            substitution: `斜率 b=${f.b.toPrecision(8)}（r=${f.r.toPrecision(6)}，n=${f.n}）→ μ=−b`,
            unrounded: originNote,
          },
        ],
        provenance: { status: 'source-explicit', document: DOC },
      }));
      if ('origin' in fitBOrigin && fitBOrigin.origin) fits['b-fit-origin'] = fitBOrigin;
      if (Math.abs(f.a) > 2 * f.sa) diagnostics.push(`B：自由截距 a=${f.a.toPrecision(4)} 相对 Sa 偏大，提示存在系统偏差（如绳质量/预张力）`);
    }

    // --- C ---
    if ([scope.P1, scope.P2, scope.thetaC].every((v) => Number.isFinite(v) && v > 0) && scope.P2 > scope.P1) {
      const g2 = g / 1000; // g·kg→N；输入为 g → Mu 输出 kg? 用 g 保持一致：Mu=√(P1·P2) 为质量 g
      void g2;
      const MuG = Math.sqrt(scope.P1 * scope.P2); // g（√(g·g)）
      const muu = Math.log(scope.P2 / scope.P1) / (2 * scope.thetaC);
      results.push(makeResult({
        id: 'part-c',
        title: 'C：未知质量 Mu 与白绳摩擦系数 μu',
        finalText: `Mu = ${MuG.toPrecision(8)} g，μu = ${muu.toPrecision(8)}`,
        steps: [
          {
            formulaLatex: 'M_u g = P_1 e^{\\mu_u\\theta_u},\\quad M_u g = P_2 e^{-\\mu_u\\theta_u}',
            substitution: `状态1（即将下滑，小端力）P1=${scope.P1} g 力；状态2（即将上滑，大端力）P2=${scope.P2} g 力；θu=${scope.thetaC} rad`,
            note: '方向约定：以未知质量端将下滑为状态 1。若你的方向约定不同，请交换 P1/P2 输入',
          },
          {
            formulaLatex: '\\frac{P_2}{P_1} = e^{2\\mu_u\\theta_u} \\;\\Rightarrow\\; \\mu_u = \\frac{\\ln(P_2/P_1)}{2\\theta_u},\\quad M_u = \\frac{\\sqrt{P_1 P_2}}{g}',
            substitution: `两式相除消去 Mu，相乘得 Mu`,
            unrounded: `Mu=√(P1·P2)=${MuG.toPrecision(10)} g（对应 ${((MuG / 1000) * g).toPrecision(8)} N），μu=${muu.toPrecision(10)}`,
          },
        ],
        provenance: { status: 'source-derived', document: DOC, note: '由对偶临界平衡方程组推导；方向约定在界面明示' },
      }));
    } else if ([scope.P1, scope.P2, scope.thetaC].some((v) => Number.isFinite(v))) {
      diagnostics.push('C：需要 P1<P2 与包角 θu');
    }

    return { results, fits, custom: {}, diagnostics };
  },
};
