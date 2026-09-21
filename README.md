# 物理实验小助手 Physics Experiment Assistant

部署在 GitHub Pages 的纯前端"大学物理实验小助手"。数据仅保存在本浏览器，不上传任何服务器。

## 产品定位

第一优先级不是"公式数量"，而是**数值正确、规则可追溯、课程模式与标准模式严格隔离、流程流畅、导出可复核**。

两条主线：

1. **实验工作台**：针对 2026 秋物理实验 A(1) 的 7 个必做实验，提供从原始数据记录、派生量计算、修正已定系统误差、拟合作图、不确定度、有效数字、结果表达到可复制报告片段的完整流程。
2. **公式与通用计算工作台**：选择公式 → 填物理量与单位 → 指定目标量 → 附加不确定度 → 计算；配套统计、拟合、加权平均、不确定度传播、单位换算、科学计算器等工具。

## 快速开始

```bash
npm install
npm run dev        # 开发
npm test           # 单元 + golden + 属性测试（177 个）
npm run test:coverage
npm run typecheck
npm run build      # 产线构建（GitHub Pages 子路径 base）
npm run e2e        # Playwright 冒烟（10 用例，需 npx playwright install chromium）
```

## 标准配置（严格隔离）

| 配置 | 说明 |
|---|---|
| `tsinghua-a1-2026`（默认） | P=0.95；ΔA=t·S_x̄；ΔB=Δ仪；方和根合成；ΔA<Δ仪/3 简化；不确定度 2 位（首位≥3 可 1 位）；末位对齐 |
| `tsinghua-foundation-2020` | 2020 讲义/绪论课 PPT 兼容 |
| `gbt-27418-2017` | A/B 类转标准不确定度；分布换算（矩形 a/√3、三角 a/√6）；协方差；Welch–Satterthwaite；U=k·u_c 或 t_p(νeff)·u_c |
| `custom` | 显式参数组成，永久显示"不代表课程或 GB/T 标准" |

**绝对禁止**在同一次计算中混合课程模式 `ΔB=Δ仪` 与 GB/T 分布换算（UI 与类型层双重隔离）。

## 数值核心保证

- 原始文本与数值分离：`15.0` 与 `15` 的有效数字元数据不丢失
- 中间计算永不提前修约；修约只作用于显示与最终导出（`core/sigfig` 唯一实现点）
- Student-t 分位数自实现并与教科书表值（ν=1…120）逐点校验
- OLS 与课程公式视图 `Sb=|b|√((1/r²−1)/(n−2))` 交叉验证
- 公式求值使用 mathjs 安全 AST，无 `eval`/`new Function`
- 单位系统带维度检查；℃ 温度值与温差语义分离
- golden test：环体积 `V=(9.44±0.08) cm³` 端到端复现
- fast-check 属性：单位往返、RSS 单调性、线性缩放传播、加权平均凸性、末位对齐
- 核心模块测试覆盖率：语句 96.7% / 分支 80.9%

## 7 个实验模板

摩擦系数（A/B/C 三部分）· 霍尔效应及磁阻 · 准稳态热导 · 阻尼/受迫振动（完整报告）· 示波器/声速 · 透镜焦距（共轭法/焦距仪/自准法）· 迈克尔逊干涉（checklist 流程 + 安全常驻）

每个实验：声明式定义（steps/datasets/fits/plots）+ 类型化 compute 管线 + 结果检查器（公式 → 代入 → 未修约 → 分量 → 修约依据 → 来源）。

## 导出

完整实验报告（Markdown / 可编译 LaTeX：封面、实验信息、参数、数据表、拟合、全计算链、规则、诊断、审计日志）/ 数据处理片段 Markdown / 表格 CSV / 项目 JSON（schema 校验 + 版本迁移）/ 图 SVG/PNG/CSV（打印白底）；公式计算可导出含数值代入的完整过程 Markdown。

## 工作流特性

- 数据表格：Excel/TSV 粘贴与 CSV/TSV 文件导入、Enter/Tab/方向键导航、末行自动增行、结构级撤销/重做、派生列自动计算（支持派生列引用派生列）、行排除审计、非法单元格标红给原因
- 数据处理工具（统计/拟合/加权平均/不确定度传播/绘图/计算器/单位换算）表格化录入，输入草稿本地保留；一个工具的输出可经「发送到…」数据总线送入另一个工具（统计列→拟合/加权平均，拟合参数→不确定度传播，任意表格→绘图），接收方确认后才填入
- 绘图工作台（MATLAB/pyplot 风格）：多系列数据 + y=f(x) 表达式混合成图，坐标起点/终点、对数轴、轴名单位可配，SVG/PNG/CSV 导出
- 公式聚合输入：平均值、标准偏差、相关系数等公式可直接粘贴原始数据列自动求和/派生，不必手工先算 Σx
- 实验工作台：步骤导航带完成度状态（done/todo/attention）、顶栏进度、步骤翻页、结果检查器（结果/警告计数、审计日志）、计算失败保留上次成功结果

## 目录结构

见 `AGENTS.md` §16 与 `plan.md`。核心：`src/core`（numeric/quantity/sigfig/statistics/regression/uncertainty/expression/graph）、`src/standards`（四 profile）、`src/formulas`（70+ 版本化公式注册表）、`src/experiments/tsinghua-a1-2026`（7 实验）、`src/persistence`（Dexie + schemaVersion 迁移）。

## 学术诚信

不生成虚假原始数据；不自动删除"异常值"（用户明确排除并写入审计日志）；只生成客观计算过程与数据诊断；课程规则与 GB/T 差异在 UI 中显式解释。

## 部署

GitHub Actions（`.github/workflows/deploy.yml`）：typecheck → unit tests → build → Pages 部署。路由使用 HashRouter，`vite.config.ts` 的 `base` 按仓库名配置（可用 `VITE_BASE` 覆盖）。
