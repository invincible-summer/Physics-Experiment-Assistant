/** 关于与规则页：项目使命、资料优先级、标准配置隔离、公式来源统计、学术诚信与验证。 */
import { Badge, Notice, Panel } from '../../components/ui';
import { MarkdownBlock, MarkdownInline, MarkdownList } from '../../components/Markdown';
import { listProfiles } from '../../standards/registry';
import { PROVENANCE_LABELS, Provenance, ProfileKind } from '../../standards/types';
import { VISIBLE_FORMULAS } from '../../formulas/registry';
import { listExperiments } from '../../experiments';

const KIND_META: Record<ProfileKind, { label: string; variant: 'accent' | 'info' | 'warning' }> = {
  course: { label: '课程模式', variant: 'accent' },
  gbt: { label: 'GB/T 标准', variant: 'info' },
  custom: { label: '自定义', variant: 'warning' },
};

const STATUS_ORDER: Provenance['status'][] = ['source-explicit', 'source-derived', 'general', 'experimental'];

const STATUS_META: Record<Provenance['status'], { variant: 'success' | 'info' | 'default' | 'warning'; meaning: string }> = {
  'source-explicit': { variant: 'success', meaning: '资料直接给出的原式' },
  'source-derived': { variant: 'info', meaning: '由资料给出的关系直接推导，不冒充讲义原式' },
  general: { variant: 'default', meaning: '通用大学物理扩展，界面中标注「通用扩展」' },
  experimental: { variant: 'warning', meaning: '尚未经过充分测试，不进入默认展示' },
};

const MISSION_MD = `部署于 **GitHub Pages** 的纯前端「大学物理实验小助手」，由两条主线组成：

1. **实验工作台**：针对指定实验提供从原始数据记录、数据清洗/修正、派生量计算、拟合、作图、不确定度、有效数字、结果表达到可复制报告片段的完整流程。
2. **公式与通用计算工作台**：选择公式、填写物理量与单位、指定目标量、附加不确定度并完成计算；同时提供统计、拟合、加权平均、插值、单位换算、科学计算等常用工具。

第一优先级不是「公式数量」，而是**数值正确、规则可追溯、课程模式与标准模式严格隔离、流程流畅、导出可复核**。`;

const PRIORITY_MD = `规则冲突时按以下顺序取舍（高优先级覆盖低优先级）：

| 优先级 | 资料 | 用途 |
| --- | --- | --- |
| 1（最高） | 2026 秋物理实验 A(1) 教学资料（当前讲义） | 默认课程配置、7 个必做实验流程、现行有效数字与数据处理规则 |
| 2 | 课程基础知识绪论课 PPT（202009） | 无冲突时的细化规则：中间运算位数、最终修约、拟合参数有效位数 |
| 3 | 2020 版讲义第 II 部分课程基础知识 | 兼容细节：不确定度与线性拟合公式的交叉核对 |
| 4 | 通用物理 / 统计知识 | 仅作扩展功能，在 UI 与数据定义中标注「通用扩展」 |
| 5（独立） | GB/T 27418-2017 测量不确定度评定和表示 | 仅在 GB/T 标准配置中生效，不反向覆盖课程模式 |

**冲突处理：**资料未明确给出某一步算法时，不得把推断伪装成课程规定——对应公式的 \`provenance.status\` 会标记为 \`source-derived\` 或 \`general\`。2020 秋 B(1) 课程须知（两份文件字节级相同）仅作一份历史参考，不重复建模。`;

const INTEGRITY_ITEMS = [
  '不生成虚假的「原始实验数据」，不补齐缺失测量',
  '不自动代写实验现象描述或误差原因分析，不伪造「实验小结」',
  '异常值由用户明确排除并留痕，程序绝不自动「优化」数据',
  '残差异常、趋势异常、单位异常等仅描述为「数据诊断」，不冒充实验事实',
  '报告导出保留可追溯的计算链与规则说明，旧报告可复现',
  '课程规则与 GB/T 标准存在差异时在界面中显式解释，不暗中统一',
];

const TESTING_ITEMS = [
  '单元测试覆盖核心数学模块（有效数字、单位、A/B 类与合成不确定度、偏导传播、OLS、加权平均、线性插值），语句/分支覆盖目标 $\\ge 90\\%$',
  'Golden tests 复现资料示例：环体积 $V=(9.44\\pm0.08)\\,\\mathrm{cm^3}$、绪论课螺旋测微计例、直线拟合 $a$、$b$、$r$、GB/T 矩形分布 $u=a/\\sqrt{3}$',
  'Student-t 分位数与教科书表值（$\\nu=1\\dots120$）逐点校验；OLS 与课程公式视图 $S_b=|b|\\sqrt{(1/r^2-1)/(n-2)}$ 交叉验证',
  '`fast-check` 属性测试：单位换算往返、RSS 合成不确定度单调性、加权平均凸性、格式化末位对齐',
  'Playwright e2e 冒烟测试验证构建产物在 GitHub Pages 子路径下可运行',
];

export function SourcesPage() {
  const profiles = listProfiles();
  const counts = VISIBLE_FORMULAS.reduce<Record<string, number>>((acc, f) => {
    acc[f.provenance.status] = (acc[f.provenance.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="stack-lg">
      <header className="page-head">
        <h1 className="page-title"><MarkdownInline>关于与规则</MarkdownInline></h1>
        <div className="page-lead">
          <MarkdownBlock>项目使命、资料与规则优先级、标准配置隔离原则、公式来源统计，以及学术诚信与验证边界。</MarkdownBlock>
        </div>
      </header>

      <Panel title="项目使命">
        <MarkdownBlock>{MISSION_MD}</MarkdownBlock>
        <div className="small muted" style={{ marginTop: 10 }}>
          <MarkdownBlock>{`当前内容规模：${VISIBLE_FORMULAS.length} 个公式 · ${listExperiments().length} 个实验模板。`}</MarkdownBlock>
        </div>
      </Panel>

      <Panel title="资料与规则优先级" sub="发生规则差异时，按以下顺序核对资料">
        <MarkdownBlock>{PRIORITY_MD}</MarkdownBlock>
      </Panel>

      <Panel title="标准配置" sub="四个配置严格隔离，禁止跨模式混算">
        <div>
          {profiles.map((p) => {
            const kind = KIND_META[p.kind];
            return (
              <details key={p.id} className="fold" open={p.kind === 'course' && p.id.startsWith('tsinghua-a1')}>
                <summary>
                  <MarkdownInline>{`**${p.name}**`}</MarkdownInline>
                  <Badge variant={kind.variant}>{kind.label}</Badge>
                  <span className="small muted mono"><MarkdownInline>{p.shortName}</MarkdownInline></span>
                </summary>
                <div className="fold-body stack" style={{ gap: 8 }}>
                  <MarkdownBlock className="small muted">{p.description}</MarkdownBlock>
                  <MarkdownList className="small" items={p.rulesSummary} />
                  <div className="xs faint"><MarkdownInline>{`规则来源：${p.source}`}</MarkdownInline></div>
                </div>
              </details>
            );
          })}
        </div>
        <Notice variant="warning" title="隔离原则">
          <MarkdownBlock className="small">{`课程模式的 $\\Delta_B=\\Delta_{仪}$ 与 GB/T 模式的矩形分布 $u=a/\\sqrt{3}$ 绝不在同一次计算中混合；仅在用户显式创建自定义配置并看到警告时才允许此类组合。`}</MarkdownBlock>
        </Notice>
      </Panel>

      <Panel title="公式来源统计" sub={`当前默认展示 ${VISIBLE_FORMULAS.length} 个公式`}>
        <table className="stat-table">
          <thead>
            <tr>
              <th><MarkdownInline>来源状态</MarkdownInline></th>
              <th><MarkdownInline>标识</MarkdownInline></th>
              <th className="num"><MarkdownInline>数量</MarkdownInline></th>
              <th><MarkdownInline>含义</MarkdownInline></th>
            </tr>
          </thead>
          <tbody>
            {STATUS_ORDER.map((status) => (
              <tr key={status}>
                <td><Badge variant={STATUS_META[status].variant}>{PROVENANCE_LABELS[status]}</Badge></td>
                <td className="mono xs"><MarkdownInline>{`\`${status}\``}</MarkdownInline></td>
                <td className="num">{counts[status] ?? 0}</td>
                <td className="small muted"><MarkdownInline>{STATUS_META[status].meaning}</MarkdownInline></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="small muted" style={{ marginTop: 8 }}>
          <MarkdownBlock>每个公式卡片均以徽章显示其来源状态；`experimental` 公式不进入默认展示，因此上表数量为零属预期。</MarkdownBlock>
        </div>
      </Panel>

      <Panel title="学术诚信边界">
        <MarkdownList items={INTEGRITY_ITEMS} />
      </Panel>

      <Panel title="测试与验证">
        <MarkdownList className="small" items={TESTING_ITEMS} />
      </Panel>

      <div className="small muted">
        <MarkdownBlock>**隐私：**实验数据仅保存在当前浏览器，不会上传。请定期导出项目备份；清空本地数据前需要再次确认。</MarkdownBlock>
      </div>
    </div>
  );
}
