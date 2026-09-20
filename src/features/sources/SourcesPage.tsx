/** 关于 / 规则来源页（plan §2.1 第 7 项） */
import { Panel, Badge } from '../../components/ui';
import { listProfiles } from '../../standards/registry';
import { VISIBLE_FORMULAS } from '../../formulas/registry';
import { listExperiments } from '../../experiments';
import { PROVENANCE_LABELS } from '../../standards/types';
import { MarkdownInline, MarkdownList } from '../../components/Markdown';

export function SourcesPage() {
  const byStatus = VISIBLE_FORMULAS.reduce<Record<string, number>>((acc, f) => {
    acc[f.provenance.status] = (acc[f.provenance.status] ?? 0) + 1;
    return acc;
  }, {});
  return (
    <main className="page">
      <h1><MarkdownInline>关于 / 规则来源</MarkdownInline></h1>
      <Panel title="项目定位">
        <p><MarkdownInline>部署于 GitHub Pages 的纯前端“大学物理实验小助手”。第一优先级不是公式数量，而是**数值正确、规则可追溯、课程模式与标准模式严格隔离、流程流畅、导出可复核**。</MarkdownInline></p>
        <p className="small muted"><MarkdownInline>{`全部数据仅保存在本浏览器。当前内容规模：${VISIBLE_FORMULAS.length} 个公式 · ${listExperiments().length} 个实验模板。`}</MarkdownInline></p>
      </Panel>

      <Panel title="资料与优先级（AGENTS §2）">
        <table className="contrib-table">
          <thead><tr><th><MarkdownInline>资料</MarkdownInline></th><th><MarkdownInline>用途</MarkdownInline></th><th><MarkdownInline>优先级</MarkdownInline></th></tr></thead>
          <tbody>
            <tr><td><MarkdownInline>2026秋物理实验A(1)教学资料</MarkdownInline></td><td><MarkdownInline>默认课程 `profile`、7 实验流程、当前有效数字与数据处理规则</MarkdownInline></td><td><MarkdownInline>最高</MarkdownInline></td></tr>
            <tr><td><MarkdownInline>课程基础知识202009.pptx</MarkdownInline></td><td><MarkdownInline>绪论课细化：中间运算位数、最终修约、拟合参数表达</MarkdownInline></td><td><MarkdownInline>高（无冲突时采用）</MarkdownInline></td></tr>
            <tr><td><MarkdownInline>讲义第II部分课程基础知识</MarkdownInline></td><td><MarkdownInline>不确定度/拟合公式交叉核对</MarkdownInline></td><td><MarkdownInline>高（兼容）</MarkdownInline></td></tr>
            <tr><td><MarkdownInline>2020 B(1) 课程须知（两份字节级相同）</MarkdownInline></td><td><MarkdownInline>历史工作流参考，不重复建模</MarkdownInline></td><td><MarkdownInline>历史</MarkdownInline></td></tr>
            <tr><td><MarkdownInline>GB/T 27418-2017 测量不确定度评定和表示</MarkdownInline></td><td><MarkdownInline>专业标准模式（独立 `profile`）</MarkdownInline></td><td><MarkdownInline>独立</MarkdownInline></td></tr>
          </tbody>
        </table>
        <div className="small muted" style={{ marginTop: 8 }}>
          <MarkdownInline>**冲突处理：**当前讲义明确规则 &gt; 绪论课 PPT 细化 &gt; 2020 讲义兼容细节 &gt; 通用知识（标注“通用扩展”）&gt; GB/T（仅在 GB/T 配置中生效）。</MarkdownInline>
        </div>
      </Panel>

      <Panel title="标准配置">
        <div className="stack">
          {listProfiles().map((p) => (
            <div key={p.id} className="row">
              <Badge variant={p.kind === 'course' ? 'accent' : p.kind === 'gbt' ? 'info' : 'warning'}>{p.name}</Badge>
              <span className="small muted"><MarkdownInline>{p.source}</MarkdownInline></span>
            </div>
          ))}
        </div>
        <div className="notice notice-warning" style={{ marginTop: 10 }}>
          <div className="n-body"><MarkdownInline>课程模式的 `ΔB=Δ仪` 与 GB/T 的矩形分布 `u=a/√3` 绝不在同一次计算中混合；自定义配置开启此类组合时会显式警告。</MarkdownInline></div>
        </div>
      </Panel>

      <Panel title="公式来源统计">
        <div className="row">
          {Object.entries(byStatus).map(([status, count]) => (
            <Badge key={status} variant={status === 'source-explicit' ? 'success' : status === 'source-derived' ? 'info' : 'default'}>
              {PROVENANCE_LABELS[status as keyof typeof PROVENANCE_LABELS]}：{count}
            </Badge>
          ))}
        </div>
        <div className="small muted" style={{ marginTop: 8 }}>
          <MarkdownInline>每个公式卡片都显示来源徽章；`provenance.status` 含义：资料原式（`source-explicit`）、由资料推导（`source-derived`）、通用扩展（`general`）、实验性（`experimental`，不默认展示）。</MarkdownInline>
        </div>
      </Panel>

      <Panel title="学术诚信边界">
        <MarkdownList items={[
          '不生成虚假的“原始实验数据”，不补齐缺失测量',
          '只生成计算过程、图表、格式化结果与基于已输入数据的客观诊断',
          '异常值由用户明确排除并写入审计日志，程序绝不自动“优化”数据',
          '导出保留可追溯计算链与规则说明，旧报告可复现',
        ]} />
      </Panel>

      <Panel title="验证与测试">
        <MarkdownList className="small" items={[
          'Student-t 分位数与教科书表值（ν=1…120）逐点校验',
          'OLS 与课程公式视图 `Sb=|b|√((1/r²−1)/(n−2))` 交叉验证',
          '环体积示例 `V=(9.44±0.08) cm³` 端到端复现',
          '`fast-check` 属性测试：单位往返、RSS 单调性、加权平均凸性、末位对齐',
        ]} />
      </Panel>
    </main>
  );
}
