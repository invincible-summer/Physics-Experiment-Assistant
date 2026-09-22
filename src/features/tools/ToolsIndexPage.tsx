/** 数据处理工具枢纽页（/tools）：七个工具的入口卡 + 数据流转说明 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon, IconName } from '../../components/Icon';
import { Button, EmptyState, Panel } from '../../components/ui';
import { MarkdownBlock, MarkdownInline } from '../../components/Markdown';
import { useSettings } from '../../stores/settings';

const TOOLS: ReadonlyArray<{ to: string; title: string; desc: string; icon: IconName; tags: string }> = [
  {
    to: '/tools/statistics',
    title: '快速统计',
    desc: '一列测量值 → 平均值、贝塞尔标准偏差、均值标准偏差、极值与极差；填仪器误差限后给出当前标准下的直接测量不确定度。',
    icon: 'chart',
    tags: '均值 · S · 不确定度',
  },
  {
    to: '/tools/regression',
    title: '线性拟合',
    desc: '成对数据最小二乘拟合，支持过原点与加权模式、变量变换、拟合图与残差图，输出 a / b / r / Δa / Δb。',
    icon: 'function',
    tags: 'OLS · 残差 · t 因子',
  },
  {
    to: '/tools/weighted-mean',
    title: '加权平均',
    desc: '多组带不确定度的测量取加权平均，支持 wi = 1/ui²（独立测量假设）与手动权重，附权重占比图。',
    icon: 'target',
    tags: '通用扩展',
  },
  {
    to: '/tools/uncertainty',
    title: '不确定度传播',
    desc: '输入 Y = f(X₁, X₂, …) 表达式，自动符号偏导与灵敏度系数，按课程模式或 GB/T 模式合成并给出有效自由度。',
    icon: 'ruler',
    tags: '偏导 · 合成 · 扩展不确定度',
  },
  {
    to: '/tools/plotter',
    title: '绘图工作台',
    desc: 'MATLAB 式画图：叠加表格数据与函数曲线，缩放查看、配置网格与对数坐标，导出 SVG / PNG / CSV。',
    icon: 'chart',
    tags: '多系列 · 表达式 · 轴范围',
  },
  {
    to: '/tools/calculator',
    title: '科学计算器',
    desc: '支持幂、开方、三角函数（角度/弧度）、科学记数法与历史记录。',
    icon: 'calculator',
    tags: '即时计算',
  },
  {
    to: '/tools/units',
    title: '单位换算',
    desc: '量纲检查后换算，区分温度值与温差两种语义；覆盖力学、电磁学、热学、半导体等常用单位族。',
    icon: 'swap',
    tags: 'SI · 量纲检查',
  },
];

export function ToolsIndexPage() {
  const [query, setQuery] = useState('');
  const filtered = TOOLS.filter(t => `${t.title} ${t.desc} ${t.tags}`.toLowerCase().includes(query.trim().toLowerCase()));
  const profile = useSettings((s) => s.activeProfile());
  return (
    <div className="stack-lg">
      <header className="page-head">
        <h1 className="page-title"><MarkdownInline>数据处理工具</MarkdownInline></h1>
        <div className="page-lead">
          <MarkdownBlock>{`表格化录入（支持 Excel 粘贴与 CSV 导入），计算规则跟随当前标准：**${profile.shortName}**。输入草稿自动保存在本浏览器。`}</MarkdownBlock>
        </div>
      </header>

      <div className="tool-search row">
        <label className="field" style={{ flex: 1 }}>
          <span className="field-label"><MarkdownInline>现在想处理什么？</MarkdownInline></span>
          <input className="input" type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="搜索工具或任务，例如：拟合、单位、画图" />
        </label>
        <span className="small muted" role="status"><MarkdownInline>{`${filtered.length} 个工具`}</MarkdownInline></span>
        {query && <Button size="sm" onClick={() => setQuery('')}>清除搜索</Button>}
      </div>
      {filtered.length === 0 && <EmptyState title="没有找到匹配工具" hint="试试“统计”“绘图”或“单位”，也可以清除搜索查看全部工具。" />}
      <nav className="quick-grid" aria-label="工具列表">
        {filtered.map((t) => (
          <Link key={t.to} className="quick-card" to={t.to}>
            <span className="quick-card-head">
              <span className="quick-card-icon"><Icon name={t.icon} /></span>
              <span className="quick-card-title"><MarkdownInline>{t.title}</MarkdownInline></span>
            </span>
            <span className="quick-card-desc"><MarkdownInline>{t.desc}</MarkdownInline></span>
            <span className="quick-card-tags"><MarkdownInline>{t.tags}</MarkdownInline></span>
          </Link>
        ))}
      </nav>

      <Panel title="工具间的数据流转" icon="send" sub="一个工具的输出可以直接送入另一个工具，不必手工转抄">
        <MarkdownBlock>{[
          '- **快速统计 → 线性拟合 / 加权平均**：测量列一键送出；拟合页收到单列数据时自动以序号为 $x$。',
          '- **线性拟合 → 不确定度传播**：斜率 $b \\pm \\Delta_b$、截距 $a \\pm \\Delta_a$ 可作为变量直接填入传播计算。',
          '- **加权平均 → 不确定度传播**：加权均值及其不确定度可作为输入量继续参与合成。',
          '- **任意表格 → 绘图工作台**：数据列一键成图；绘图页也可把当前数据送回线性拟合。',
          '',
          '发送后目标页顶部会出现接收横幅，确认「填入」才会覆盖现有输入；数据保留原始文本，不丢有效数字信息。',
        ].join('\n')}</MarkdownBlock>
      </Panel>
    </div>
  );
}
