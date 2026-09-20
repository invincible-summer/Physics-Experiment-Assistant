# plan.md — Physics Experiment Assistant 完整产品与实现计划

## 0. 文档定位

本文档是项目的详细产品规格 + 数学规格 + 技术实施计划。第一版目标是：**在纯前端 GitHub Pages 环境中，完整支持上传的 2026 秋物理实验 A(1) 课程规则和 7 个实验，并同时提供可扩展的公式计算与通用数据处理工具。**

所有实现必须同时遵守 `AGENTS.md`。

## 0.5 实现状态（v1，2026-09-19）

MVP 判定（§22）各条目状态：

- ✅ 设置页 3 个正式标准 profile + custom（含矛盾组合警告）
- ✅ 完整数值/单位/有效数字/课程不确定度核心（`src/core/*`，语句覆盖 96.7%/分支 80.9%，122 测试）
- ✅ 基础 GB/T 模式（A/B/合成/相关/有效自由度/扩展，与课程模式类型级隔离）
- ✅ 数据表（TSV 粘贴/键盘导航/撤销/派生列/行排除审计）、OLS/过原点/加权拟合、ECharts SVG 图（误差棒/图表规范检查/SVG/PNG 导出）
- ✅ 公式工作台及 §20 全部 70 个公式（含 provenance、显式解、单位下拉）
- ✅ 7 个 2026 实验模板（步骤/数据表/拟合/图/结果检查器/导出）
- ✅ Markdown/LaTeX/CSV/JSON/SVG/PNG 导出；本地 IndexedDB 保存（schemaVersion + 迁移钩子）
- ✅ GitHub Pages 部署流水线（typecheck → test → build → deploy）；HashRouter + 子路径 base
- ✅ golden tests（环体积 9.44±0.08 cm³、t 表 ν=1…120、OLS 课程公式交叉验证）+ fast-check 属性测试
- ✅ 移动端可用（底部导航、步骤横滚、检查器底部抽屉、表格冻结表头）
- ⏳ 未含于 v1（后续版本）：PWA 离线（§Phase 7）、多项式/非线性/ODR 拟合（§6.5 后续）、通用大学物理公式库扩展（§8.5，Phase 8）、Playwright 在 CI 的浏览器安装（配置与用例已就绪 `e2e/smoke.spec.ts`）

实现备注：golden test 中环体积等资料示例的输入数据集为"与资料最终答案对齐的重构数据"（源 PDF 未随仓库提供），已在测试注释中标注；公式 provenance 按 §8.4 的资料分类标注，湿空气声速等推导式标 `source-derived`。

---

# 1. 资料阅读结论与产品边界

## 1.1 当前课程真正需要的不是“公式百科”，而是两条互补工作流

上传的 2026 秋课程资料明确把报告的核心放在数据整理、计算、作图、不确定度分析和规范结果表达；绪论课课件又进一步规定了有效数字、作图、拟合及参数表达方式。因此产品划分为：

### A. 专门实验工作台

围绕 2026 秋 A(1) 的 7 个实验构建完整流程：

- 预设实验元数据与仪器参数；
- 现场/课后原始数据记录；
- 派生列自动计算；
- 修正已定系统误差；
- 作图与拟合；
- 不确定度；
- 有效数字；
- 最终结果表达；
- Markdown/LaTeX/CSV/JSON/图片导出；
- 生成“数据处理”报告片段，但不编造实验数据和主观结论。

### B. 公式与通用计算工作台

面向没有固定实验模板的任务：

- 搜索/选择大学物理常用公式；
- 选择待求变量；
- 填写数值、单位、不确定度；
- 自动换算单位、求值、传播不确定度；
- 输出完整代入过程；
- 复制 LaTeX / Markdown；
- 通用统计、加权平均、拟合、插值、科学计算、有效数字处理。

两部分共享同一数值核心、单位核心、拟合核心、不确定度核心和输出格式核心。

## 1.2 上传资料的角色

| 资料 | 项目用途 | 优先级 |
|---|---|---:|
| 2026秋物理实验A(1)教学资料 | 默认课程 profile、7 实验流程、当前有效数字与数据处理规则 | 最高 |
| 课程基础知识202009.pptx | 绪论课细节：中间运算有效位数、最终修约、拟合参数表达 | 高（无冲突时采用） |
| 讲义第II部分课程基础知识 | 不确定度/拟合公式交叉核对、拟合参数不确定度 | 高（兼容） |
| 2020 B(1) 课程须知两份 | 历史课程工作流参考；两份完全相同 | 历史 |
| GB/T 27418-2017 | 专业标准模式 | 独立 profile |

## 1.3 课程模式与 GB/T 模式的关键区别

### 2026 A(1) 课程模式

- 95% 置信概率；
- `ΔA=t0.95(ν) S_x̄`；
- `ΔB=Δ仪`（教学简化）；
- `Δ=sqrt(ΔA²+ΔB²)`；
- 单次测量 `Δ=Δ仪`；
- `ΔA<Δ仪/3` 时允许直接采用 `Δ仪`；
- 不确定度一般 2 位有效数字，首位≥3 时可以 1 位；
- 相对不确定度一般 2 位有效数字；
- 测量值末位与不确定度末位对齐。

### GB/T 27418-2017

- A/B 是“评定方法类别”，最后都转成标准差形式的**标准不确定度**；
- B 类要根据概率分布换算，例如矩形半宽 `a → a/√3`；
- 相关输入要使用协方差；
- 合成得到 `uc`；
- 需要高包含概率时再用 `U=k uc` 或 t 因子产生扩展不确定度；
- 支持有效自由度；
- `uc` 与 `U` 通常最多 2 位有效数字；
- 最终结果必须说明是标准不确定度还是扩展不确定度。

这两套逻辑必须从配置和类型层面隔离，而不是在 UI 上只换一个标签。

---

# 2. 信息架构与导航

## 2.1 顶级导航

桌面侧栏 / 移动端底栏：

1. **首页**
2. **实验**
3. **公式**
4. **数据处理**
5. **项目**
6. **设置**
7. **关于 / 规则来源**

## 2.2 首页

首页不做公式瀑布流，采用“任务导向”：

- 继续最近实验项目；
- 新建 2026 A(1) 实验；
- 快速数据处理；
- 公式计算；
- 最近使用的公式；
- 当前标准 badge，例如“2026 秋物理实验 A(1)”；
- 标准差异提醒：用户切换标准后，在首页展示当前规则摘要。

## 2.3 实验列表

卡片显示：

- 实验名称；
- 学科标签；
- 数据处理类型标签（线性拟合 / 时序区间 / 光学位置 / 干涉计数等）；
- 报告类型（2026：阻尼完整报告，其他极简报告）；
- 是否含安全提示；
- 新建项目按钮。

---

# 3. 设置页面完整设计

## 3.1 “标准与课程”区

主选择器以大卡片呈现：

### 选项 1：2026 秋物理实验 A(1)（默认、推荐）

摘要直接显示：

- P=0.95；
- `ΔA=tSx̄`；
- `ΔB=Δ仪`；
- 方和根合成；
- 有效数字按当前课程要求；
- 完整支持 7 个实验。

点击“查看规则”打开侧栏，显示来源章节与公式。

### 选项 2：2020 课程基础知识 / 绪论兼容

用途：复现旧讲义和绪论课 PPT 的计算与显示规则。

### 选项 3：GB/T 27418-2017

摘要：标准不确定度、概率分布、协方差、有效自由度、扩展不确定度。

### 选项 4：自定义

显式配置：

- 默认包含概率；
- A 类算法；
- B 类算法；
- 独立/相关处理；
- 不确定度有效位数；
- 相对不确定度有效位数；
- `ΔA<ΔB/3` 简化是否启用；
- 报告模板规则。

自定义配置上方永久显示“自定义规则，不代表课程或 GB/T 标准”。

## 3.2 “数值与有效数字”区

可设置：

- 最终不确定度有效数字：由标准决定 / 1 / 2；
- 首位≥3 时是否允许压缩为 1 位；
- 相对不确定度位数；
- 科学记数法阈值；
- 中间步骤显示位数（仅显示，计算仍保留全精度）；
- 修约模式；
- 百分数显示位数；
- 角度显示：deg/rad；
- 拟合 `r` 默认位数。

当用户选择“由标准决定”时，不允许局部组件覆盖。

## 3.3 “单位与物理量”区

- 自动转换到 SI：始终开启（内部）；
- 输出偏好：自动 / SI / 跟随输入；
- 常用单位偏好，例如长度 mm、cm、m；电压 μV/mV/V；磁场 mT/T；
- 摄氏温度显示偏好；
- 是否显示维度检查信息。

## 3.4 “图表与导出”区

- 默认导出 SVG / PNG；
- 打印图白底；
- 拟合式位置；
- 是否显示 `r` / `R²`；
- 默认误差棒；
- Markdown 数学风格 `$...$` / `\(...\)`；
- LaTeX 单位风格 `\mathrm{}`。

## 3.5 “数据与隐私”区

- 自动保存；
- 项目保留策略；
- 导出全部项目 JSON；
- 导入；
- 清空本地数据；
- 明示“数据默认仅保存在本浏览器”。

## 3.6 “实验功能”区

- 显示实验安全提示；
- 显示公式来源；
- 显示计算诊断；
- 实验性高级拟合开关；
- 专家模式（显示 AST、灵敏度系数、协方差矩阵等）。

---

# 4. UI 视觉与交互设计

## 4.1 视觉语言

目标：现代、克制、像“实验室工作台”，不是花哨公式站。2026-09-20 的前端重构进一步确定为**文本优先、低装饰、轻依赖**：

- 全局导航、主操作和危险操作使用清晰文字，不把 emoji、箭头、“＋/×”图案当作主要按钮；计算器数学键等领域内天然符号保留；
- 背景采用低对比层级，面板以细边框和留白为主，默认不堆叠重阴影；
- 首页入口卡采用“类别提示 + 标题 + 简述 + 文字入口”，取消大号 emoji 图标；
- 数学内容高对比，关键结果用更大的等宽数字与单位；数据录入区优先保证密度和可扫读性；
- 警告/安全信息与计算错误采用语义边框与文字标题，不依赖图案；
- 公式来源、假设、计算步骤采用可折叠次级信息；
- 大量表格时减少卡片嵌套，优先使用连续工作区；
- 不新增图标库或组件框架，继续使用现有 React + CSS，避免额外下载、解析和运行时开销。

可访问性基线使用 WCAG 2.2：Target Size (Minimum) 2.5.8 要求交互目标至少 24×24 CSS px，Focus Visible 2.4.7 要求键盘焦点可见。实现中按钮/输入实际目标尺寸高于最低值，并提供统一 `:focus-visible` 样式与 `prefers-reduced-motion`。
官方参考：
- https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
- https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html

## 4.2 实验工作台布局

桌面宽屏：

```text
┌───────────────────────────────────────────────────────────────────┐
│ 顶栏：返回项目 | 项目名 | 实验/标准 | 保存状态 | 显示结果 | 导出 │
├──────────────┬─────────────────────────────────┬───────────────────┤
│ 步骤导航     │ 主工作区                        │ 唯一结果检查器    │
│ 1 参数       │ 数据表 / 图 / 表单              │ 即时计算结果      │
│ 2 原始数据   │                                 │ 不确定度          │
│ 3 数据处理   │                                 │ 有效数字          │
│ 4 作图拟合   │                                 │ 公式与来源        │
│ 5 不确定度   │                                 │ 诊断              │
│ 6 最终结果   │                                 │                   │
└──────────────┴─────────────────────────────────┴───────────────────┘
```

约束：右侧只允许这一个结果检查器，不再增加任何第二右栏。检查器默认可隐藏；当视口不足以舒适容纳三列（当前断点约 1280px）时，结果区移到主工作区下方，左侧步骤栏继续保留，从结构上杜绝“双右边栏”和被压窄的数据表。

移动端：

- 顶部仅保留项目级必要操作，过长元信息隐藏或折叠；
- 主区域按步骤单页，步骤横向滚动；
- “结果”在展开时作为主内容后的单列区块，不再复制成右侧栏/第二抽屉；
- 底部主导航为文字标签，不使用 emoji 图标；
- 表格横向滚动并冻结表头，按钮保留足够触控面积；
- 支持大数字键盘友好输入。

### 4.2.1 2026-09-20 前端视觉重构实施与验收

本轮只调整展示层和少量交互文案，`src/core`、标准 profile、实验 compute 管线、公式定义和持久化 schema 不改动。主要落点：`src/app/styles.css`、`AppShell.tsx`、通用 `ui.tsx`、首页、实验工作台、数据表和公式详情。

验收标准：
1. 桌面导航无 emoji 图标；首页入口无装饰性图标；普通业务按钮无纯图案按钮。
2. 实验工作台宽屏最多一个右侧结果区；≤1280px 时结果区进入主区下方；≤900px 时单列布局。
3. 数据表“添加/插入/删除/撤销/重做”全部为文字按钮，TSV 粘贴、键盘导航、审计排除等原功能不回归。
4. 亮/暗主题均使用同一套设计 token；按钮最小高度 32px（移动端 34–38px），输入最小高度 40px，焦点清晰可见。
5. `prefers-reduced-motion` 生效；不引入新 npm 依赖。
6. 现有 E2E 关键文案继续保留；`npm run typecheck`、`npm test`、`npm run build` 全通过后才允许合并。
7. GitHub Pages 部署继续使用现有 HashRouter、仓库子路径 base 和现有 CI，不增加服务端依赖。

### 4.2.2 全站 Markdown UI 文案层

2026-09-20 在视觉重构基础上继续统一 UI 文案渲染：**所有能够以 React 节点呈现的可见文字均通过 Markdown 渲染器输出**，而不是仅在报告预览或导出内容中支持 Markdown。

实现采用仓库内 `src/components/Markdown.tsx`，不新增 npm 依赖。这样既能让按钮、标题、帮助文本、badge、notice、toast、表格文字、结果说明和列表统一支持 Markdown，又避免把 `react-markdown + remark/rehype` 整套依赖加入 GitHub Pages 首屏包。

接口约定：
- `MarkdownInline`：按钮、链接标签、导航、标题、badge、字段标签、短说明、表格单元格等单行 UI；支持 **bold**、*emphasis*、~~strike~~、`inline code`、安全链接以及 `$...# plan.md — Physics Experiment Assistant 完整产品与实现计划

## 0. 文档定位

本文档是项目的详细产品规格 + 数学规格 + 技术实施计划。第一版目标是：**在纯前端 GitHub Pages 环境中，完整支持上传的 2026 秋物理实验 A(1) 课程规则和 7 个实验，并同时提供可扩展的公式计算与通用数据处理工具。**

所有实现必须同时遵守 `AGENTS.md`。

## 0.5 实现状态（v1，2026-09-19）

MVP 判定（§22）各条目状态：

- ✅ 设置页 3 个正式标准 profile + custom（含矛盾组合警告）
- ✅ 完整数值/单位/有效数字/课程不确定度核心（`src/core/*`，语句覆盖 96.7%/分支 80.9%，122 测试）
- ✅ 基础 GB/T 模式（A/B/合成/相关/有效自由度/扩展，与课程模式类型级隔离）
- ✅ 数据表（TSV 粘贴/键盘导航/撤销/派生列/行排除审计）、OLS/过原点/加权拟合、ECharts SVG 图（误差棒/图表规范检查/SVG/PNG 导出）
- ✅ 公式工作台及 §20 全部 70 个公式（含 provenance、显式解、单位下拉）
- ✅ 7 个 2026 实验模板（步骤/数据表/拟合/图/结果检查器/导出）
- ✅ Markdown/LaTeX/CSV/JSON/SVG/PNG 导出；本地 IndexedDB 保存（schemaVersion + 迁移钩子）
- ✅ GitHub Pages 部署流水线（typecheck → test → build → deploy）；HashRouter + 子路径 base
- ✅ golden tests（环体积 9.44±0.08 cm³、t 表 ν=1…120、OLS 课程公式交叉验证）+ fast-check 属性测试
- ✅ 移动端可用（底部导航、步骤横滚、检查器底部抽屉、表格冻结表头）
- ⏳ 未含于 v1（后续版本）：PWA 离线（§Phase 7）、多项式/非线性/ODR 拟合（§6.5 后续）、通用大学物理公式库扩展（§8.5，Phase 8）、Playwright 在 CI 的浏览器安装（配置与用例已就绪 `e2e/smoke.spec.ts`）

实现备注：golden test 中环体积等资料示例的输入数据集为"与资料最终答案对齐的重构数据"（源 PDF 未随仓库提供），已在测试注释中标注；公式 provenance 按 §8.4 的资料分类标注，湿空气声速等推导式标 `source-derived`。

---

# 1. 资料阅读结论与产品边界

## 1.1 当前课程真正需要的不是“公式百科”，而是两条互补工作流

上传的 2026 秋课程资料明确把报告的核心放在数据整理、计算、作图、不确定度分析和规范结果表达；绪论课课件又进一步规定了有效数字、作图、拟合及参数表达方式。因此产品划分为：

### A. 专门实验工作台

围绕 2026 秋 A(1) 的 7 个实验构建完整流程：

- 预设实验元数据与仪器参数；
- 现场/课后原始数据记录；
- 派生列自动计算；
- 修正已定系统误差；
- 作图与拟合；
- 不确定度；
- 有效数字；
- 最终结果表达；
- Markdown/LaTeX/CSV/JSON/图片导出；
- 生成“数据处理”报告片段，但不编造实验数据和主观结论。

### B. 公式与通用计算工作台

面向没有固定实验模板的任务：

- 搜索/选择大学物理常用公式；
- 选择待求变量；
- 填写数值、单位、不确定度；
- 自动换算单位、求值、传播不确定度；
- 输出完整代入过程；
- 复制 LaTeX / Markdown；
- 通用统计、加权平均、拟合、插值、科学计算、有效数字处理。

两部分共享同一数值核心、单位核心、拟合核心、不确定度核心和输出格式核心。

## 1.2 上传资料的角色

| 资料 | 项目用途 | 优先级 |
|---|---|---:|
| 2026秋物理实验A(1)教学资料 | 默认课程 profile、7 实验流程、当前有效数字与数据处理规则 | 最高 |
| 课程基础知识202009.pptx | 绪论课细节：中间运算有效位数、最终修约、拟合参数表达 | 高（无冲突时采用） |
| 讲义第II部分课程基础知识 | 不确定度/拟合公式交叉核对、拟合参数不确定度 | 高（兼容） |
| 2020 B(1) 课程须知两份 | 历史课程工作流参考；两份完全相同 | 历史 |
| GB/T 27418-2017 | 专业标准模式 | 独立 profile |

## 1.3 课程模式与 GB/T 模式的关键区别

### 2026 A(1) 课程模式

- 95% 置信概率；
- `ΔA=t0.95(ν) S_x̄`；
- `ΔB=Δ仪`（教学简化）；
- `Δ=sqrt(ΔA²+ΔB²)`；
- 单次测量 `Δ=Δ仪`；
- `ΔA<Δ仪/3` 时允许直接采用 `Δ仪`；
- 不确定度一般 2 位有效数字，首位≥3 时可以 1 位；
- 相对不确定度一般 2 位有效数字；
- 测量值末位与不确定度末位对齐。

### GB/T 27418-2017

- A/B 是“评定方法类别”，最后都转成标准差形式的**标准不确定度**；
- B 类要根据概率分布换算，例如矩形半宽 `a → a/√3`；
- 相关输入要使用协方差；
- 合成得到 `uc`；
- 需要高包含概率时再用 `U=k uc` 或 t 因子产生扩展不确定度；
- 支持有效自由度；
- `uc` 与 `U` 通常最多 2 位有效数字；
- 最终结果必须说明是标准不确定度还是扩展不确定度。

这两套逻辑必须从配置和类型层面隔离，而不是在 UI 上只换一个标签。

---

# 2. 信息架构与导航

## 2.1 顶级导航

桌面侧栏 / 移动端底栏：

1. **首页**
2. **实验**
3. **公式**
4. **数据处理**
5. **项目**
6. **设置**
7. **关于 / 规则来源**

## 2.2 首页

首页不做公式瀑布流，采用“任务导向”：

- 继续最近实验项目；
- 新建 2026 A(1) 实验；
- 快速数据处理；
- 公式计算；
- 最近使用的公式；
- 当前标准 badge，例如“2026 秋物理实验 A(1)”；
- 标准差异提醒：用户切换标准后，在首页展示当前规则摘要。

## 2.3 实验列表

卡片显示：

- 实验名称；
- 学科标签；
- 数据处理类型标签（线性拟合 / 时序区间 / 光学位置 / 干涉计数等）；
- 报告类型（2026：阻尼完整报告，其他极简报告）；
- 是否含安全提示；
- 新建项目按钮。

---

# 3. 设置页面完整设计

## 3.1 “标准与课程”区

主选择器以大卡片呈现：

### 选项 1：2026 秋物理实验 A(1)（默认、推荐）

摘要直接显示：

- P=0.95；
- `ΔA=tSx̄`；
- `ΔB=Δ仪`；
- 方和根合成；
- 有效数字按当前课程要求；
- 完整支持 7 个实验。

点击“查看规则”打开侧栏，显示来源章节与公式。

### 选项 2：2020 课程基础知识 / 绪论兼容

用途：复现旧讲义和绪论课 PPT 的计算与显示规则。

### 选项 3：GB/T 27418-2017

摘要：标准不确定度、概率分布、协方差、有效自由度、扩展不确定度。

### 选项 4：自定义

显式配置：

- 默认包含概率；
- A 类算法；
- B 类算法；
- 独立/相关处理；
- 不确定度有效位数；
- 相对不确定度有效位数；
- `ΔA<ΔB/3` 简化是否启用；
- 报告模板规则。

自定义配置上方永久显示“自定义规则，不代表课程或 GB/T 标准”。

## 3.2 “数值与有效数字”区

可设置：

- 最终不确定度有效数字：由标准决定 / 1 / 2；
- 首位≥3 时是否允许压缩为 1 位；
- 相对不确定度位数；
- 科学记数法阈值；
- 中间步骤显示位数（仅显示，计算仍保留全精度）；
- 修约模式；
- 百分数显示位数；
- 角度显示：deg/rad；
- 拟合 `r` 默认位数。

当用户选择“由标准决定”时，不允许局部组件覆盖。

## 3.3 “单位与物理量”区

- 自动转换到 SI：始终开启（内部）；
- 输出偏好：自动 / SI / 跟随输入；
- 常用单位偏好，例如长度 mm、cm、m；电压 μV/mV/V；磁场 mT/T；
- 摄氏温度显示偏好；
- 是否显示维度检查信息。

## 3.4 “图表与导出”区

- 默认导出 SVG / PNG；
- 打印图白底；
- 拟合式位置；
- 是否显示 `r` / `R²`；
- 默认误差棒；
- Markdown 数学风格 `$...$` / `\(...\)`；
- LaTeX 单位风格 `\mathrm{}`。

## 3.5 “数据与隐私”区

- 自动保存；
- 项目保留策略；
- 导出全部项目 JSON；
- 导入；
- 清空本地数据；
- 明示“数据默认仅保存在本浏览器”。

## 3.6 “实验功能”区

- 显示实验安全提示；
- 显示公式来源；
- 显示计算诊断；
- 实验性高级拟合开关；
- 专家模式（显示 AST、灵敏度系数、协方差矩阵等）。

---

# 4. UI 视觉与交互设计

## 4.1 视觉语言

目标：现代、克制、像“实验室工作台”，不是花哨公式站。2026-09-20 的前端重构进一步确定为**文本优先、低装饰、轻依赖**：

- 全局导航、主操作和危险操作使用清晰文字，不把 emoji、箭头、“＋/×”图案当作主要按钮；计算器数学键等领域内天然符号保留；
- 背景采用低对比层级，面板以细边框和留白为主，默认不堆叠重阴影；
- 首页入口卡采用“类别提示 + 标题 + 简述 + 文字入口”，取消大号 emoji 图标；
- 数学内容高对比，关键结果用更大的等宽数字与单位；数据录入区优先保证密度和可扫读性；
- 警告/安全信息与计算错误采用语义边框与文字标题，不依赖图案；
- 公式来源、假设、计算步骤采用可折叠次级信息；
- 大量表格时减少卡片嵌套，优先使用连续工作区；
- 不新增图标库或组件框架，继续使用现有 React + CSS，避免额外下载、解析和运行时开销。

可访问性基线使用 WCAG 2.2：Target Size (Minimum) 2.5.8 要求交互目标至少 24×24 CSS px，Focus Visible 2.4.7 要求键盘焦点可见。实现中按钮/输入实际目标尺寸高于最低值，并提供统一 `:focus-visible` 样式与 `prefers-reduced-motion`。
官方参考：
- https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
- https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html

## 4.2 实验工作台布局

桌面宽屏：

```text
┌───────────────────────────────────────────────────────────────────┐
│ 顶栏：返回项目 | 项目名 | 实验/标准 | 保存状态 | 显示结果 | 导出 │
├──────────────┬─────────────────────────────────┬───────────────────┤
│ 步骤导航     │ 主工作区                        │ 唯一结果检查器    │
│ 1 参数       │ 数据表 / 图 / 表单              │ 即时计算结果      │
│ 2 原始数据   │                                 │ 不确定度          │
│ 3 数据处理   │                                 │ 有效数字          │
│ 4 作图拟合   │                                 │ 公式与来源        │
│ 5 不确定度   │                                 │ 诊断              │
│ 6 最终结果   │                                 │                   │
└──────────────┴─────────────────────────────────┴───────────────────┘
```

约束：右侧只允许这一个结果检查器，不再增加任何第二右栏。检查器默认可隐藏；当视口不足以舒适容纳三列（当前断点约 1280px）时，结果区移到主工作区下方，左侧步骤栏继续保留，从结构上杜绝“双右边栏”和被压窄的数据表。

移动端：

- 顶部仅保留项目级必要操作，过长元信息隐藏或折叠；
- 主区域按步骤单页，步骤横向滚动；
- “结果”在展开时作为主内容后的单列区块，不再复制成右侧栏/第二抽屉；
- 底部主导航为文字标签，不使用 emoji 图标；
- 表格横向滚动并冻结表头，按钮保留足够触控面积；
- 支持大数字键盘友好输入。

### 4.2.1 2026-09-20 前端视觉重构实施与验收

本轮只调整展示层和少量交互文案，`src/core`、标准 profile、实验 compute 管线、公式定义和持久化 schema 不改动。主要落点：`src/app/styles.css`、`AppShell.tsx`、通用 `ui.tsx`、首页、实验工作台、数据表和公式详情。

验收标准：
1. 桌面导航无 emoji 图标；首页入口无装饰性图标；普通业务按钮无纯图案按钮。
2. 实验工作台宽屏最多一个右侧结果区；≤1280px 时结果区进入主区下方；≤900px 时单列布局。
3. 数据表“添加/插入/删除/撤销/重做”全部为文字按钮，TSV 粘贴、键盘导航、审计排除等原功能不回归。
4. 亮/暗主题均使用同一套设计 token；按钮最小高度 32px（移动端 34–38px），输入最小高度 40px，焦点清晰可见。
5. `prefers-reduced-motion` 生效；不引入新 npm 依赖。
6. 现有 E2E 关键文案继续保留；`npm run typecheck`、`npm test`、`npm run build` 全通过后才允许合并。
7. GitHub Pages 部署继续使用现有 HashRouter、仓库子路径 base 和现有 CI，不增加服务端依赖。

 / `\\(...\\)` 数学。
- `MarkdownBlock`：较长正文；除 inline 能力外支持标题、引用、 fenced code、分隔线、普通/有序/任务列表、Markdown 表格、`$...$` / `\\[...\\]` 数学。
- `MarkdownList`：已有字符串数组的统一列表出口，列表项内部继续使用 inline Markdown。
- `markdownInlineNode`：供 `Panel`、`Badge`、`ConfirmButton` 等共享组件在保留已有 ReactNode 扩展能力的同时自动处理字符串/数字文案。

安全与交互约束：
- 不渲染 raw HTML，不使用 `dangerouslySetInnerHTML`；源字符串中的 HTML 标签仅作为普通文本。
- Markdown 链接只接受相对地址、hash、HTTP(S) 和 mailto；危险协议不生成 `<a>`。
- 按钮、checkbox label 等交互控件内部禁用 Markdown 链接，以避免嵌套 `<a>` / `<button>`。
- 数学复用现有 KaTeX 组件，不新增公式渲染路径。
- `<option>`、input `placeholder`、`title`、`aria-label` 等原生字符串槽位无法承载富 React 节点，因此保留纯文本，并明确禁止在这些位置写 Markdown 标记。

验收标准：
1. 仓库所有业务 `<button>` 的可见标签经 `MarkdownInline` 或共享 `markdownInlineNode` 渲染；不存在直接业务字符串按钮。
2. 业务列表统一使用 `MarkdownList`，或每个 `<li>` 内显式使用 `MarkdownInline`；动态规则、诊断、警告、审计日志均可使用 Markdown。
3. 页面标题、说明、表单标签、help、notice、toast、空状态、panel 标题/副标题、badge 和结果说明支持 inline Markdown。
4. Markdown block 覆盖标题/引用/代码块/列表/任务列表/表格/数学；相关单元测试覆盖。
5. raw HTML 与 `javascript:` 链接不会被执行或输出为可点击危险链接。
6. 按钮中的 `[label](url)` 只显示 label，不产生嵌套链接。
7. 不新增 npm 依赖；核心计算、profile、实验定义、持久化 schema 不改。
8. `npm run typecheck`、`npm test`、`npm run build` 全通过后合并；GitHub Pages 部署成功。

### 4.2.3 主边栏视觉优化与持久化收起

桌面主边栏继续保持纯 CSS + React，不引入图标库或布局框架。边栏从单层文本列表调整为“工作区 / 系统”两组，使用极轻量字符标记增强扫视效率；展开态显示标记 + Markdown 标签，收起态仅保留标记并用原生 `title` 提供名称提示。

状态由 `useSettings` 中新增的 `sidebarCollapsed: boolean` 保存到现有 `pea.settings` localStorage；因此刷新页面和重新打开浏览器后保留用户选择。收起仅影响桌面 `>900px` 布局，移动端继续使用底部导航，不复制第二套抽屉状态。

布局约束：
- 展开宽度约 240px；收起宽度约 76px，通过 CSS 变量 `--sidebar-width` 与 flex basis 同步切换，主内容自动获得释放出的横向空间。
- 切换按钮常驻品牌区；可见符号仍经 `MarkdownInline` 渲染，`aria-label/title` 作为原生纯字符串可访问性例外。
- 主导航 active 状态使用浅色背景 + 边框 + 实心标记，不依赖颜色之外的唯一信号；hover/focus 状态统一沿用设计 token。
- footer 中标准徽章、隐私说明在收起态隐藏；主题切换保留紧凑标记，避免窄栏出现文本溢出。
- `prefers-reduced-motion` 继续由全局规则抑制过渡；边栏动画只改变宽度、basis、padding，不做复杂 transform/阴影动画。
- 小于 900px 时桌面边栏与收起按钮均隐藏，保持现有 mobile nav，避免同一页面出现两个主导航。

验收标准：
1. 点击收起按钮后桌面边栏宽度缩至约 76px，主内容宽度立即扩展；再次点击恢复。
2. 刷新后保持上次折叠状态。
3. 收起态所有主路由仍可点击，并能从 tooltip / `aria-label` 识别。
4. 当前路由在展开态和收起态都具有明确 active 视觉。
5. 900px 以下仍只显示移动端底栏，折叠偏好不破坏移动布局。
6. 不增加 npm 依赖、不改实验计算逻辑、不改 IndexedDB 项目 schema。
7. `npm run typecheck`、`npm test`、`npm run build` 通过后再合并。

## 4.3 数据表格

核心交互：

- 粘贴 TSV/CSV；
- Enter 下移、Tab 右移；
- 多单元格选中；
- 撤销/重做；
- 批量单位；
- 列类型：测量量、常量、派生量、序号、文本；
- 派生量只读，可展开公式；
- 缺失值使用 `—`，绝不自动填 0；
- 异常格式标红边框但不篡改数据；
- 支持一键“复制为 Markdown 表格”。

## 4.4 结果检查器

每个结果采用统一层级：

1. 最终结果；
2. 当前标准规则；
3. 公式；
4. 数值代入；
5. 未修约结果；
6. 不确定度分量；
7. 修约过程；
8. 来源。

这样既满足学习需要，也满足报告“有公式、有代入式”的要求。

---

# 5. 核心数据模型

## 5.1 Project

```ts
interface Project {
  id: string;
  schemaVersion: number;
  title: string;
  createdAt: string;
  updatedAt: string;
  standardProfileId: string;
  experimentId?: string;
  metadata: Record<string, unknown>;
  tables: DataTableModel[];
  userInputs: Record<string, MeasurementInput>;
  notes: string;
  uiState?: Record<string, unknown>;
}
```

## 5.2 MeasurementInput

```ts
interface MeasurementInput {
  rawText: string;
  value: number;
  unit: string;
  sigDigits?: number;
  decimalPlace?: number;
  exact?: boolean;
  correction?: QuantityValue;
  uncertainty?: UncertaintyInput;
}
```

## 5.3 CalculationResult

```ts
interface CalculationResult {
  id: string;
  valueSI: number;
  displayValue: string;
  unit: string;
  uncertainty?: UncertaintyResult;
  steps: CalculationStep[];
  dependencies: string[];
  warnings: Diagnostic[];
  provenance: Provenance;
}
```

## 5.4 Provenance

```ts
interface Provenance {
  status: 'source-explicit' | 'source-derived' | 'general' | 'experimental';
  document?: string;
  section?: string;
  page?: number;
  equation?: string;
  note?: string;
}
```

所有课程公式必须填写 provenance。

---

# 6. 数学核心模块设计

## 6.1 `core/numeric`

职责：

- 安全数值解析；
- 科学记数法；
- Decimal 修约；
- 防止 `NaN/Infinity` 泄漏到 UI；
- 数值容差比较；
- 格式化前保留原始值。

不负责单位、不确定度和有效数字策略。

## 6.2 `core/quantity`

职责：

- 物理量 + 单位；
- SI 转换；
- 维度运算；
- 摄氏温度与温差；
- 复合单位化简；
- 推荐显示单位。

典型单位：

`mm cm m μm nm`, `g kg`, `ms s min`, `μV mV V`, `μA mA A`, `Ω kΩ`, `pF nF μF F`, `mH H`, `mT T`, `Hz kHz MHz`, `° rad`, `W`, `Pa`, `J/(kg·K)`, `W/(m·K)`, `m³/C`, `cm²/(V·s)`。

## 6.3 `core/sigfig`

必须提供：

- `countSignificantDigits(rawText)`；
- `roundToSigDigits(value,n)`；
- `roundToDecimalPlace(value,place)`；
- `formatUncertaintyCourse(value, profile)`；
- `formatMeasurement(value, uncertainty, profile)`；
- `formatRelativeUncertainty()`；
- `formatFitParameter()`；
- `formatScientificNotation()`。

特别测试：`15.0`、`0.00980`、`980`、`1.0000`、跨十位进位、负数、0。

## 6.4 `core/statistics`

### 必须实现

- `sum`
- `mean`
- `weightedMean`
- `sampleVariance`
- `sampleStd`
- `stdErrorOfMean`
- `median`（通用）
- `min/max/range/halfRange`
- `covariance`
- `correlation`
- `linearInterpolation`
- `percentDeviation`
- `percentDifference`

### 加权平均

通用模式：

`x̄w = Σ(wi xi)/Σwi`。

若输入的是独立标准不确定度：

`wi=1/ui²`，`u(x̄w)=1/sqrt(Σwi)`。

UI 必须显示使用的权重定义。

## 6.5 `core/regression`

### OLS

输出：

- a、b；
- r、R²；
- residuals；
- SSE；
- `Sa`、`Sb`；
- 自由度 n-2；
- t 置信区间。

课程模式提供课程公式视图：

`Sb/b = sqrt((r^-2 - 1)/(n-2))`

`Sa = Sb sqrt(Σxi²/n)`

`Δa=t Sa`，`Δb=t Sb`。

### 其他

- through-origin OLS；
- weighted least squares；
- 多项式拟合（v1.1）；
- 非线性拟合（后续）；
- ODR（后续）。

## 6.6 `core/uncertainty`

采用策略模式：

```ts
interface UncertaintyStrategy {
  evaluateDirect(input: DirectMeasurementModel): UncertaintyResult;
  propagate(model: MeasurementModel): UncertaintyResult;
  format(result: UncertaintyResult): FormattedUncertainty;
}
```

实现：

- `TsinghuaCourseUncertaintyStrategy`
- `GBT27418UncertaintyStrategy`
- `CustomUncertaintyStrategy`

### 课程直接量

输入：重复数据、仪器误差、修正值、P。

输出：

- n；
- mean；
- corrected mean；
- sample std；
- std error；
- ν；
- t；
- ΔA；
- ΔB；
- Δ；
- relative Δ；
- 是否触发 `ΔA<Δ仪/3` 简化；
- 最终格式化结果。

### 课程间接量

表达式 AST + 独立输入 → 自动偏导 → 灵敏度贡献：

`ci = ∂f/∂xi`

`term_i = |ci| Δxi`

`ΔY=sqrt(Σterm_i²)`。

显示“贡献率”：`term_i² / ΔY²`。

### GB/T

每个输入量定义：

```ts
interface StandardUncertaintyComponent {
  estimate: number;
  standardUncertainty: number;
  distribution?: 'normal' | 'rectangular' | 'triangular' | 'custom';
  degreesOfFreedom?: number;
  source: 'A' | 'B';
}
```

允许输入：

- 标准差倍数；
- 包含概率；
- 上下限；
- 厂商准确度；
- 校准证书；
- 自定义标准不确定度。

## 6.7 `core/expression`

能力：

- 安全表达式解析；
- 符号别名；
- 求值；
- 对变量求导；
- 对单变量代数求解（能显式解时）；
- 否则使用受限数值 root solver；
- 生成 LaTeX；
- 维度预检查。

严格禁止执行任意 JS。

## 6.8 `core/graph`

功能：

- scatter；
- line；
- error bars；
- fitted line；
- residual plot；
- multi-series；
- dual y-axis（绪论课允许）；
- log axis（特殊情况）；
- SVG/PNG 导出。

图表检查器：

- 是否有轴名；
- 是否有单位；
- 是否有图名；
- 是否存在无意义的笼统 x/y；
- 拟合是否显示 r；
- 坐标范围是否合理覆盖数据。

---

# 7. 仪器误差模块

## 7.1 模拟电表

`ΔA = Am · K%`。

输入：量程、准确度等级 K、读数。

输出：绝对误差限、相对误差限；提示接近满量程可降低相对误差。

## 7.2 数字仪表

支持三种讲义形式：

1. `α%×读数 + n×末尾字`
2. `α%×读数 + β%×量程`
3. `α%×读数 + β%×量程 + n×末尾字`

输入控件必须清楚区分：分辨率/末尾字、量程、读数。

## 7.3 电阻箱

课程 0.1 级 ZX21 简化：

`ΔR = 0.1%R + 0.005(N+1) Ω`。

## 7.4 实验专用仪器模板

- 阻尼计时器：`读数×10^-5+0.001s`；
- 声速频率：`Δf=10Hz`；
- 焦距仪位置：0.004 mm；
- 光具座位置：0.05 cm；
- 共轭法给定 Δa/Δb；
- 热电偶 40 μV/℃；
- 电子天平分辨率 0.01 g 仅作为仪器元数据，除非讲义明确规定其误差模型，不自动把分辨率当作课程 Δ仪。

最后一条非常重要：**分辨率 ≠ 自动等于仪器误差**，除非课程资料或仪器说明明确规定。

---

# 8. 公式工作台设计

## 8.1 用户流程

1. 搜索公式（中文名、英文名、符号、别名）；
2. 查看公式、适用条件、变量定义、来源；
3. 选择“求哪个量”；
4. 填输入值和单位；
5. 可选填写各输入量不确定度；
6. 点击计算；
7. 查看结果、传播贡献、有效数字；
8. 复制 LaTeX / Markdown / 数值代入式。

## 8.2 公式卡片

卡片内容：

- 标题；
- 渲染公式；
- 变量 chips；
- 来源 badge；
- 适用条件；
- “计算”“复制”“收藏”。

## 8.3 源码复制

提供：

- 纯 LaTeX；
- Markdown 行内；
- Markdown 块；
- 带代入式 LaTeX；
- 最终结果 LaTeX。

## 8.4 v1 公式功能详细列表

### A. 测量与统计（资料直接支持）

- 算术平均；
- 残差；
- 样本标准偏差；
- 平均值标准偏差；
- Student-t A 类分量；
- 课程 B 类分量；
- RSS 总不确定度；
- 相对不确定度；
- 一般函数不确定度传播；
- 相对不确定度传播；
- OLS a/b/r；
- OLS 参数不确定度；
- 区间半宽不确定度；
- 线性插值。

### B. 电学仪器（资料直接支持）

- 模拟电表误差；
- 数字表三种误差式；
- 电阻箱误差；
- `P=UI`、`R=U/I` 作为通用基础公式；
- 串联谐振 `f0=1/(2π√LC)`。

### C. 振动与波（资料直接支持）

- 阻尼振动运动方程参数关系；
- `ωd=sqrt(ω0²-β²)`；
- `Td=2π/ωd`；
- `ζ=β/ω0`；
- `τ=1/β`；
- `Q=1/(2ζ)`；
- 受迫振动幅频/相频；
- 共振频率；
- `v=fλ`；
- 理想气体声速；
- 干燥空气温度修正声速；
- 湿空气声速；
- 利萨如频率比。

### D. 热学（资料直接支持）

- Fourier 导热 `q=-λ dt/dx`；
- 准稳态 `λ=qcR/(2Δt)`；
- `c=qc/[ρR(dt/dτ)]`；
- `qc=U²/(2Fr)`；
- 热电偶线性温差换算。

### E. 半导体/磁学（资料直接支持）

- 霍尔电压；
- RH；
- KH；
- 载流子浓度；
- 磁阻相对变化。

### F. 光学（资料直接支持）

- 薄透镜公式；
- 放大率；
- 共轭法焦距；
- 焦距仪；
- 自准法凹透镜；
- 迈克尔逊等倾光程差；
- 波长；
- 白光玻片厚度/折射率。

## 8.5 通用大学物理公式库扩展（非上传资料完整覆盖）

此部分明确标记 `general`，建议 v1.1 起逐类扩展：

### 力学

匀变速、抛体、圆周运动、牛顿定律、功/功率、动能定理、势能、动量/冲量、质心、碰撞、转动惯量、角动量、转动动力学、滚动。

### 振动与波

简谐振动、单摆、弹簧振子、机械波、驻波、拍、Doppler。

### 热学

理想气体、热力学第一定律、等温/等压/等容/绝热过程、Carnot、热膨胀、热传导。

### 电磁学

Coulomb、电场/电势、Gauss、电容、直流电路、Kirchhoff、Lorentz、Biot–Savart、Ampere、Faraday、电感、交流阻抗/RLC。

### 光学

反射折射、薄透镜、球面镜、干涉、衍射、光栅、偏振。

这些扩展必须逐个加入变量/单位/约束/测试，不允许只建立一大串无类型字符串。

---

# 9. 通用“数据处理”页面

## 9.1 快速统计

输入一列或多列数据，可计算：

- n；
- mean；
- median；
- sample std；
- SEM；
- min/max/range；
- half-range；
- 课程 ΔA/ΔB/Δ；
- GB/T uA/uB/uc/U。

## 9.2 加权平均

表格：`xi`, `ui` 或 `wi`。

模式：

- 手动权重；
- `1/u²` 权重。

输出：加权平均、权重占比、标准不确定度、贡献图。

## 9.3 线性拟合

输入 x/y，选项：

- 普通 OLS；
- 过原点；
- 加权；
- x/y 对调；
- 变换列 `ln x`, `ln y`, `x²`, `1/x`, `sqrt(x)`。

输出：a/b/r/R²、置信区间、残差、图、Markdown。

## 9.4 不确定度传播

用户输入：

`Y = expression`

然后自动识别变量，用户填写 `xi ± Δxi` 或 GB/T 标准不确定度。

显示：

- 符号偏导；
- 灵敏度系数；
- 每项贡献；
- 合成结果；
- 修约结果。

## 9.5 科学计算器

支持：

- 基础四则；
- 幂/开方；
- exp/ln/log；
- trig；
- π/e；
- 科学计数；
- 角度/弧度；
- 单位值直接参与运算。

---

# 10. 七个实验工作台详细设计

## 10.1 摩擦系数测量

### 页面步骤

1. 项目与仪器参数；
2. 秤盘质量；
3. A：θ=π，P–W；
4. B：MW=800g，P–θ；
5. 模型识别与拟合；
6. C：白绳 μu 和未知质量 Mu；
7. 不确定度与结果；
8. 导出。

### A 数据表

- `MW` 或砝码组成；
- `MP-`；
- `MP+`；
- 自动 `MP=(MP-+MP+)/2`；
- `ΔMP=(MP+-MP-)/2`；
- `W=MW g`；
- `P=MP g`。

### 分析

- P–W 散点；
- 线性拟合；
- 如果采用 Capstan 模型：斜率 `m=e^{-μθ}`，`μ=-ln(m)/θ`；
- 不确定度由拟合斜率传播到 μ。

### B 数据表

- θ；
- MP-/MP+；
- P；
- `ln(P/W)`。

拟合 `ln(P/W)=-μθ`，可选择自由截距或理论过原点并比较。

### C

提供清晰的方向示意和两种临界状态输入；程序根据已确认的方向约定写方程并解 Mu、μu。公式必须在界面展示，避免“黑箱解”。

## 10.2 霍尔效应及磁阻

### 页面步骤

1. 霍尔片几何与仪器；
2. UH–I 数据；
3. 霍尔参数；
4. 载流子类型；
5. 电磁铁标定；
6. 可选磁场分布；
7. 可选迁移率；
8. 磁阻；
9. 导出。

### 霍尔表

列：I、U1、U2、U3、U4、UH。

`UH=(U1-U2+U3-U4)/4`。

图：UH–I。

拟合斜率 `b`：

`KH=b/B`

`RH=KH d`

`n=1/(|e RH|)`；载流子类型保留 RH/UH 符号和讲义规定方向判断。

### 磁场标定

固定 I：输入 IM 与四换向电压，算 UH，再 `B=UH/(KH I)`；画 B–IM。

### 磁阻

`R(B)=UAC/IAC`；

`MR=ΔR/R0`；

同一页面提供：

- MR–B 原图；
- 低场 MR–B²；
- 高场 MR–B；
- 工作条件标记 AC 恒流、BD 是否短路。

### 迁移率

讲义要求自行设计，但没有给固定计算式；v1 标为“开放设计”：用户可以用自定义公式子模块，不预设唯一答案。

## 10.3 准稳态热导

### 参数

- 样品厚度 2R / 半厚 R；
- 横截面积 F；
- 密度 ρ（讲义有机玻璃 1196 kg/m³，可预填且可编辑）；
- 加热器电阻 r；
- 加热前/后电压；
- 冷端温度 tc；
- 热电偶灵敏度 40 μV/℃。

### 时序表

τ、U1(t2-t1)、U2(t1-tc)。

首行初始 U1 用作已定系统误差修正。

### 准稳态区间选择

图上刷选 `[τstart, τend]`。

实时显示：

- U1 均值与标准差；
- U1 对时间斜率（应接近 0 的诊断）；
- U2 线性拟合 r；
- U2 斜率；
- 温升速率。

不自动替用户决定区间；可以给候选区间，但必须让用户确认。

### 计算

`Uheat=(Ubefore+Uafter)/2`

`qc=Uheat²/(2Fr)`

`Δt=(U1_corrected)/(40 μV/℃)`

`dT/dτ=(slope_U2)/(40 μV/℃)`

`λ=qcR/(2Δt)`

`c=qc/[ρR(dT/dτ)]`

修正模式：`qc' = 0.85 qc`，并列显示 λ'、c'。

## 10.4 阻尼与受迫振动

### 自由阻尼

输入 `j, θj`，另表输入多次周期计时。

自动派生 `ln θj`。

拟合 `ln θj = a+bj`。

从课程关系：

`b=-βTd=-2πζ/sqrt(1-ζ²)`。

解：

`ζ = (-b)/sqrt(4π²+b²)`（取物理上正阻尼；实现中从原关系稳定推导并测试）。

再：

`ω0=2π/[Td sqrt(1-ζ²)]`

`τ=1/(ζω0)`

`Q=1/(2ζ)`。

### 不确定度

`Sb` 与 `Δb=t Sb`，ν=n-2；再通过偏导把 b → ζ，Td/ζ → ω0。

周期计时仪器误差按课程公式。

### 受迫振动

每个阻尼档位：T、θ、φ。

自动：`ω=2π/T`、`ω/ω0`。

同图多系列：

- θ–ω/ω0；
- φ–ω/ω0。

标记 φ≈π/2 的点作为共振诊断之一，但不替代用户实验判断。

稳定时间工具：输入 τ，计算满足 `e^{-t/τ}<0.01` 的 `t>4.60517τ`。

## 10.5 示波器、声速与电路

### 示波器快速测量

表单：

- 纵向格数 × V/div → 电压幅度；
- 横向格数 × s/div → 周期；
- `f=1/T`；
- 两信号 Δt/T → 相位差；
- 峰峰值、峰值、正弦 RMS 转换（明确波形假设）。

### 利萨如

输入 nx、ny、已知频率 → 未知频率；提示端点 1/2 计数的课程规则。

### 声速

20 个同相点：n、x。

拟合 `x=a+bn`，`λ=b`。

`Δλ=t Sb`，ν=n-2。

频率允许输入 `fmin/fmax` 并自动平均，也可直接输入 f；课程指定 `Δf=10Hz`。

`v=fλ` 并传播不确定度。

理论值：温度前后平均、湿度前后平均；饱和蒸气压按表格线性插值；计算湿空气声速；比较相对偏差。

### RC / 共振电路

独立子卡：充电、微分、RLC 共振计算器，便于选做任务。

## 10.6 透镜焦距

### 共轭法

输入固定 P/Q，或直接输入 b；6 次 O1/O2。

每行 `a=|O2-O1|`，取平均 a 或按实验定义统一处理；`f=(b²-a²)/(4b)`。

默认 `Δa=0.25cm`、`Δb=0.20cm` 可编辑但标明来源。

自动符号偏导传播。

### 焦距仪

参数：平行光管 `f≈400mm`（具体使用仪器标称值，不能硬编码不可编辑）、玻罗板线距 y；6 次 y1'/y2'；派生 `y'=|y1'-y2'|`。

`fx=(y'/y)f`。

y' 做重复测量 A 分量，并使用线距 B 分量 `√2×0.004mm`；f 相对不确定度 0.3%；y 的 0.02% 可按讲义默认忽略并允许打开。

### 凹透镜自准

每次 O2' / O2'' → `O2=(O2'+O2'')/2`；F2；`f=-|F2-O2|`。

O2 与 F2 各重复 6 次。光具座单位置误差 0.05cm；通过正确的差值和平均关系传播。

## 10.7 迈克尔逊干涉

本实验主要是调节/观察型，因此 UI 与其他实验不同。

### 光路流程 checklist

- 激光水平；
- 空间滤波；
- 准直；
- 分光；
- 两反射镜回光；
- 光斑重合；
- 干涉条纹；
- 点光源非定域；
- 可选钠光等倾；
- 白光干涉。

每步展示讲义安全/操作要点，但不替代教师现场要求。

### 计算工具

- `λ=2Δd/Δk`；
- 已知 λ 反算 Δd；
- `δ=2d cosθ`；
- `Δd=l(n-1)`，反算 l 或 n；
- 不确定度传播。

### 安全常驻条

激光高压、激光直射眼睛、钠灯冷却、光学面、磁座双手操作。

---

# 11. 作图与课程规范

根据讲义/绪论课，作图导出前做自动检查：

- 横轴必须是实际物理量/符号而不是裸 `x`（用户自定义公式除外）；
- 纵轴同理；
- 单位完整；
- 数据点显式显示；
- 拟合曲线与数据点区分；
- 多曲线使用不同点符/线型；
- 坐标范围不强制含原点；
- 支持 1:1 / 1:2 / 1:5 / 1:10 类合理人工刻度的思想，但计算机图表可以自动 nice scale；
- 必须有图名；
- 必要参数可标注。

导出：SVG 优先、PNG 次之。

---

# 12. 报告与导出设计

## 12.1 导出范围

- 当前结果 Markdown；
- 当前结果 LaTeX；
- 完整数据处理 Markdown；
- 表格 CSV；
- 项目 JSON；
- 图 SVG/PNG。

## 12.2 “数据处理”Markdown 结构

```markdown
### 数据处理

原始/整理数据表……

采用公式：
$$ ... $$

代入：
$$ ... $$

拟合得到：...

不确定度：...

最终结果：
$$ X=(...\pm...)\,\mathrm{unit} $$
```

2026 课程中，报告助手只重点生成第 5 项“数据处理”所需客观内容。阻尼实验可额外提供完整报告结构占位，但不自动生成虚构实验小结。

## 12.3 来源说明

导出可选附带：

- 标准 profile；
- 公式来源；
- 修约规则；
- 软件版本。

这样未来更新公式后仍可复现旧报告。

---

# 13. 公式与实验版本化

每个公式/实验定义都必须有 `version`。

项目保存：

- `formulaId + formulaVersion`
- `experimentId + experimentVersion`
- `standardProfileId + standardProfileVersion`

打开旧项目时：

- 若版本一致直接加载；
- 若版本改变，展示迁移摘要；
- 严禁无提示地用新公式重新解释旧结果。

---

# 14. 错误处理与诊断

## 14.1 输入错误

- 单位不兼容；
- 数字格式错误；
- log/sqrt 域错误；
- 除零；
- 数据点不足；
- n=1 时不能计算样本标准差；
- 回归 x 全相同；
- 权重非正；
- 协方差矩阵非法。

## 14.2 数据诊断

只给客观提示：

- 线性拟合 |r| 较低；
- 残差有明显趋势；
- 单点偏离较大；
- 热导选择区间 U1 仍有显著趋势；
- 温升拟合不线性；
- 结果单位量级可能错误。

不自动删除“异常值”。必须由用户明确选择排除，并在项目审计记录中保存排除动作。

---

# 15. 技术实现方案

## 15.1 前端

- React + TypeScript + Vite；
- Tailwind CSS + Radix/shadcn 风格组件；
- Hash Router，确保 GitHub Pages 深链可用；
- Zustand 管全局 UI/当前项目；
- Dexie 管项目持久化。

## 15.2 数学

- `mathjs`：解析、AST、符号导数、辅助单位；
- `decimal.js`：精确十进制修约；
- `jstat`：Student-t 分布量化；
- 核心统计公式自行实现并用第三方库交叉测试，避免对黑箱库过度依赖。

## 15.3 图

ECharts + SVG renderer。

需要自己包装：

- error bar custom series；
- 数据/拟合分层；
- 课程图表检查；
- SVG 导出。

## 15.4 测试

- Vitest；
- fast-check；
- Playwright；
- GitHub Actions。

---

# 16. 分阶段开发计划

## Phase 0 — 工程骨架（1 个里程碑）

交付：

- Vite React TS；
- GitHub Pages CI；
- 主题/路由；
- 标准 profile 类型；
- IndexedDB 基础；
- 数学核心测试框架。

验收：main 分支可自动部署空壳应用。

## Phase 1 — 数值内核与设置

实现：

- quantity/unit；
- sigfig；
- stats；
- t quantile；
- course uncertainty；
- GB/T uncertainty 基础；
- 设置页完整 profile 切换；
- 资料示例 golden tests。

验收：同一组输入在课程/GB/T 下产生预期不同结果，UI 明确解释差异。

## Phase 2 — 数据表与拟合/作图

实现：

- spreadsheet grid；
- TSV/CSV paste；
- OLS；
- fit uncertainty；
- graph；
- 图导出；
- Markdown 表格。

验收：绪论课线性拟合例可完整复现。

## Phase 3 — 公式工作台

实现：

- FormulaDefinition；
- 搜索；
- 目标变量；
- 单位；
- 自动偏导传播；
- Markdown/LaTeX；
- source provenance。

先录入所有“课程基础 + 7 实验”公式。

## Phase 4 — 第一批实验模板

优先：

1. 霍尔；
2. 透镜焦距；
3. 阻尼。

原因：三者合起来覆盖多列表格、换向组合、拟合、间接量、不确定度、重复测量和时序参数。

验收：可以从空项目一路生成可复制数据处理结果。

## Phase 5 — 其余实验

- 热导；
- 声速/示波器；
- 摩擦；
- 迈克尔逊。

特别处理热导的区间选择和迈克尔逊的 checklist UX。

## Phase 6 — 通用数据处理工具

- 加权平均；
- 相关/协方差；
- 插值；
- 自定义不确定度；
- 科学计算器；
- 高级 GB/T。

## Phase 7 — PWA、移动优化、导出完善

- 离线；
- 手机录数；
- 打印布局；
- 项目导入导出；
- 性能优化。

## Phase 8 — 通用大学物理公式扩展

逐类添加 mechanics / thermal / electromagnetism / optics 等，每个公式必须带测试、单位与条件。

---

# 17. 核心验收测试清单

## 17.1 课程规则

- [ ] P=0.95 t 因子；
- [ ] n-1 与拟合 n-2 自由度区分；
- [ ] ΔB=Δ仪；
- [ ] ΔA<Δ仪/3 简化；
- [ ] 单次测量；
- [ ] 已定系统误差修正；
- [ ] 不确定度 2 位 / 首位≥3 可 1 位；
- [ ] 相对不确定度 2 位；
- [ ] 最终值末位对齐；
- [ ] 中间值不提前修约。

## 17.2 GB/T

- [ ] A 类标准不确定度；
- [ ] 矩形 / 三角 / 正态 B 类；
- [ ] covariance；
- [ ] uc；
- [ ] νeff；
- [ ] U/k；
- [ ] 报告语义正确。

## 17.3 实验

- [ ] 摩擦 A/B/C；
- [ ] 霍尔 4 换向；
- [ ] 热导准稳态选择；
- [ ] 阻尼 lnθ-j；
- [ ] 声速 20 点；
- [ ] 透镜三种主要方法；
- [ ] 迈克尔逊计算 + 流程安全。

---

# 18. 首版页面清单

路由建议：

```text
/#/
/#/experiments
/#/experiments/:experimentId/new
/#/project/:projectId
/#/formulas
/#/formulas/:formulaId
/#/tools/statistics
/#/tools/regression
/#/tools/uncertainty
/#/tools/weighted-mean
/#/tools/calculator
/#/settings
/#/sources
```

GitHub Pages 使用 hash 路由以降低部署复杂度。

---

# 19. 首版组件清单

- `StandardProfileBadge`
- `StandardSelector`
- `QuantityInput`
- `MeasurementInput`
- `UncertaintyInput`
- `UnitSelect`
- `SigFigPreview`
- `FormulaCard`
- `FormulaCalculator`
- `CalculationSteps`
- `UncertaintyBreakdown`
- `ContributionChart`
- `EditableDataGrid`
- `RegressionPanel`
- `PhysicsPlot`
- `PlotChecklist`
- `ExperimentStepper`
- `ResultInspector`
- `SourceBadge`
- `SafetyNotice`
- `ExportDialog`
- `ProjectAutosaveIndicator`

---

# 20. 首版 formula registry 最低条目

必须在 v1 release 前全部落地并通过测试：

### 测量

`mean`, `residual`, `sample-std`, `sem`, `course-type-a`, `course-type-b`, `course-total-uncertainty`, `relative-uncertainty`, `indirect-rss`, `linear-regression`, `fit-correlation`, `fit-parameter-uncertainty`, `half-range`。

### 仪器

`analog-meter-error`, `digital-meter-reading-digits`, `digital-meter-reading-range`, `digital-meter-combined`, `resistance-box-error`。

### 摩擦

`weight-from-mass`, `capstan`。

### 霍尔

`hall-voltage`, `hall-four-direction-combination`, `hall-coefficient`, `hall-sensitivity`, `carrier-density`, `magnetoresistance`。

### 热导

`fourier-law`, `quasi-steady-lambda`, `quasi-steady-specific-heat`, `heat-flux-electrical`, `thermocouple-linear`。

### 振动

`damped-omega`, `damped-period`, `damping-ratio`, `time-constant`, `quality-factor`, `log-decrement`, `forced-amplitude`, `forced-phase`, `resonance-frequency`, `zeta-from-fit-slope`。

### 示波器/声速/电路

`scope-voltage-div`, `scope-period-div`, `frequency-period`, `phase-time`, `lissajous-frequency`, `sound-speed`, `ideal-gas-sound-speed`, `dry-air-sound-speed`, `humid-air-sound-speed`, `rc-charge`, `rc-differentiator`, `lc-resonance`。

### 光学

`thin-lens`, `magnification`, `bessel-focal-length`, `focimeter`, `concave-autocollimation`, `michelson-equal-inclination`, `michelson-wavelength`, `michelson-white-light-plate`。

### GB/T

`standard-uncertainty-type-a`, `rectangular-standard-uncertainty`, `triangular-standard-uncertainty`, `normal-coverage-to-standard`, `combined-standard-uncertainty-independent`, `combined-standard-uncertainty-correlated`, `effective-dof`, `expanded-uncertainty`。

---

# 21. 开发时特别容易出错的点

1. `15` 与 `15.0` 不能等价对待有效数字元数据。
2. 课程 Δ 与 GB/T u/U 不同，不能共享同一含义的字段名。
3. `℃` 的温度与温差转换不同。
4. 霍尔 mV/mA/mT 的数量级非常容易错，内部统一 SI。
5. 热导 c 的公式分母包含 `ρR·dT/dτ`，不要漏掉半厚度 R。
6. 焦距仪的 0.004mm 是“位置”误差，两位置作差的 B 分量为 `√2×0.004mm`。
7. 声速拟合的自由度是 n-2，不是 n-1。
8. 阻尼斜率 b 为负，ζ 是正值；求解时要处理符号。
9. 仪器“分辨率”不能自动当作“仪器误差限”。
10. 相关系数 r 和 R² 不可互相替代；课程强调 r。
11. 不应自动删除异常点或偷偷“优化”学生数据。
12. 不能在中间步骤按显示位数截断。

---

# 22. 项目首个可用版本（MVP）的判定

MVP 不是“能打开网页”，而是必须同时完成：

- 设置页 3 个正式标准 profile + custom；
- 完整数值/单位/有效数字/课程不确定度核心；
- 基础 GB/T 模式；
- 数据表、OLS、图表；
- 公式工作台及课程相关公式；
- 7 个 2026 实验模板；
- Markdown/LaTeX/CSV/JSON/SVG 导出；
- 本地保存；
- GitHub Pages 部署；
- golden tests；
- 手机可用。

完成这些之后再扩大“大学物理公式大全”的覆盖面。

---

# 23. 推荐的第一轮实现顺序（实际编码顺序）

1. `standard-profile` 类型 + 设置页；
2. `NumericDatum` / 单位 / sigfig；
3. statistics；
4. Student-t；
5. course uncertainty；
6. GB/T basic uncertainty；
7. formula AST；
8. OLS；
9. EditableDataGrid；
10. Plot；
11. Formula registry；
12. 霍尔实验；
13. 透镜实验；
14. 阻尼实验；
15. 热导；
16. 声速/示波器；
17. 摩擦；
18. 迈克尔逊；
19. 导出；
20. PWA/移动端。

此顺序优先解决“算对”再解决“覆盖多”，可最大程度减少后续实验模板重复返工。

