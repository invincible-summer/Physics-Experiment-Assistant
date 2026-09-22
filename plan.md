# plan.md — Physics Experiment Assistant v4 优化与通用大学物理公式扩展计划

> 审计基线：`invincible-summer/Physics-Experiment-Assistant` `main` 分支，commit `d1950e3a4420fec6e72fd43f16e01e58226f49de`（2026-09-22）。
>
> 本计划是下一轮实现的严格依据。未在本计划中要求改动、且当前已经正确稳定的数值算法、实验计算链和数据模型，应保持现状，不为“重构”而重构。

## 0. 实施结果（2026-09-22，本轮已完成）

Phase A–E 全部落地并验收：

- **A UI 缺陷**：侧栏展开 216px / 折叠 60px；折叠控件改为 28×28 低权重图标按钮；footer 改为齿轮设置入口 + 主题切换（移除可点击标准徽章）；新增字号档位 90–140%（`data-font-scale`，字号 token 全部 rem 化）；课程/GB/T `rulesSummary` 全部 LaTeX 化并配回归测试。
- **B 公式架构**：`FormulaDefinition` 迁移为 `domain + topic + kind + result + tags`；旧 69 个 id 全保留；`result-units.ts` 已删除；公式页为「一级 domain + 二级 topic + 分批渲染（首批 24）」；reference 公式（高斯定律、法拉第定律、薛定谔方程等 10 条）不显示数值计算器；`validateRegistry()` 静态校验入 CI。
- **C 单位与常数**：新增速度/加速度/动量/力矩/黏度/摩尔/电场/磁通/eV 等 40+ 单位（全部往返测试）；`src/physics/constants.ts` 建立（BIPM exact：c/h/e/k_B/N_A 及派生 ħ、R；CODATA 2022：G/ε0/μ0/质量等；`COURSE_DEFAULT_G=9.8` 与 `g_n=9.80665`、`G` 区分）。
- **D 公式库扩展**：15 个主干领域/33 个专题全覆盖，可见公式 298 条（计划预计 200–250，超出部分为 §6 逐条列出的核心关系，无凑数条目）；每条 computable 公式有单位、条件、provenance、校验算例（自动执行），另有独立权威样例交叉检查（逃逸速度 11.19 km/s、Hα 4.567e14 Hz、1 u=931.5 MeV 等）。
- **E 性能与 CI**：公式页/SourcesPage 路由级 lazy（首页初始 chunk gzip 439.5 kB，低于基线 460.3 kB；公式库独立 chunk 165.9 kB）；ECharts 改 `echarts/core` 按需注册（图表 chunk 1043→580 kB，SVG 屏显 + Canvas PNG 导出能力不变）；CI 新增 Chromium Playwright job。
- 验收：typecheck、224 个 unit/golden/property 测试、35 个 Playwright e2e、production build 全部通过；按钮文字无越界的实屏检查见仓库截图轮次。

以下正文为本轮的原始计划，保留作依据。

## 1. 本轮目标与边界

本轮同时解决三个用户可直接感知的问题和一个结构性能力缺口：

1. **侧栏更紧凑、更克制**：当前桌面侧栏展开宽度 `248px`、折叠宽度 `76px`，品牌区的“收起导航”按钮占据独立一行，视觉权重过高；底部当前标准徽章又承担“去设置”的入口，容易被理解为设置按钮。本轮要把展开侧栏压缩到约 `216px`、折叠侧栏压缩到约 `60px`，将收起/展开控件改为低视觉权重的小型控制，并把侧栏底部的“2026 A(1)”设置入口改成**齿轮**。
2. **加入字体大小设置**：当前 `html { font-size: 15px }` 固定，同时大量字号 token 和局部字号使用 `px`，用户无法在应用内改变字号。本轮加入持久化字号偏好，并把主要文字体系改为可缩放的 `rem`/token 体系；同时保证浏览器 200% 缩放时不丢失内容或功能。
3. **修复课程规则中的公式未渲染**：当前 `StandardProfile.rulesSummary` 中的 `P = 0.95`、`ΔA = t₀.₉₅(ν)·S_x̄`、`ΔB = Δ仪`、`Δ = √(ΔA² + ΔB²)` 等是普通 Unicode 文本，没有 `$...$` 数学定界符；`MarkdownList` 虽然支持 KaTeX，但拿不到数学 token，因此最终只显示普通文字。本轮必须改成真正的 Markdown + LaTeX 数学，并加回归测试。
4. **将公式工作台从“课程/实验公式库”扩展为“大学物理主干公式库”**：当前实际注册公式为 **69 条**，主要集中在测量、不确定度、7 个实验、振动/声速/光学和 GB/T；基础力学、流体、热力学、电磁学主干、现代物理等仍大量缺失。扩展目标不是堆字符串，而是建立可维护的领域化公式注册表、单位/常数体系、适用条件和逐式测试，使大学物理 I–III 的主干章节都有可搜索、可复制、可计算或可明确标记为“参考公式”的条目。

本轮仍坚持纯前端 GitHub Pages，不加入后端、不加入运行时数据库服务、不加入大型 UI/Markdown/搜索框架。公式扩展不能破坏当前课程模式与 GB/T 模式隔离，也不能改变已经验证正确的 7 个实验计算链。

## 2. 当前仓库完整架构审计结论

### 2.1 工程与运行时

当前技术栈是 React 18 + TypeScript 5.6 + Vite 5，路由使用 `HashRouter` 以兼容 GitHub Pages；状态偏好使用 Zustand `persist` 写入 `localStorage`，实验项目使用 Dexie/IndexedDB；表达式由 mathjs AST 安全求值，公式由 KaTeX 渲染，图表由 ECharts 绘制。构建工作流在 `.github/workflows/deploy.yml` 中执行 `npm ci`、typecheck、单元测试和 production build，再部署 Pages。

这套技术栈适合当前项目，不需要换框架。特别是以下部分已经足够好，本轮应保留：

- `src/core/numeric`：保留原始输入与有效数字元数据，避免 `15.0` 和 `15` 被等同处理；
- `src/core/sigfig`：修约集中实现，中间计算不提前修约；
- `src/core/statistics` / `regression`：t 分布、OLS、加权拟合、课程公式视图已有较完整测试；
- `src/core/uncertainty`：课程模式与 GB/T 模式通过策略分离，当前课程 `ΔA/ΔB/Δ` 逻辑已经有 golden/性质测试；
- `src/core/expression`：使用 AST 白名单，不使用 `eval` / `new Function`；
- `src/components/Markdown.tsx`：无 raw HTML、无额外 Markdown 依赖，能够渲染 inline/block 数学，安全边界清晰；
- `src/persistence/db.ts`：IndexedDB、导入导出、schema 校验、旧格式兼容和审计日志已经成体系；
- 七个 `src/experiments/tsinghua-a1-2026/*` 实验模板和计算管线：已有逐实验公式测试，不应因本轮 UI 和公式库扩展而重写。

### 2.2 应用壳与侧栏现状

`src/app/shell/AppShell.tsx` 通过 `settings.sidebarCollapsed` 切换 `.is-collapsed`；`SideNav.tsx` 的结构是品牌区、导航区、footer。`nav-config.ts` 已经把桌面与移动端导航放在单一配置源中，这一点应保留。

当前视觉问题有明确代码根因：

- `tokens.css`：`--sidebar-w: 248px`、`--sidebar-w-collapsed: 76px`；
- `SideNav.tsx`：`sidebar-brand-row` 内先放品牌，再放一个带图标和“收起导航/展开”文字的按钮；
- `layout.css`：品牌区使用纵向布局，按钮因此单独占一行；
- 折叠态仍显示两字 compact label，这个设计本身可保留，但 `76px` 有继续压缩空间；
- footer 中 `StandardProfileBadge` 是可点击按钮，展开时显示“标准：2026 A(1)”，折叠时仍显示短名；它事实上又是设置入口，视觉语义不清；
- `nav-config.ts` 已有正常的“设置”导航项，图标也是 `settings`，所以 footer 的大标准徽章没有必要继续承担设置按钮角色。

### 2.3 字体系统现状

当前字号不能全局改变的原因不是单一一处，而是两层：

- `base.css` 将 `html` 固定为 `15px`；
- `tokens.css` 的 `--fs-xs` 至 `--fs-3xl` 全部是 `px`；
- `layout.css` / `components.css` 仍有不少局部硬编码 `10.5px`、`11px`、`12.5px`、`13.5px`、`14px`、`15.5px`、`21px`、`22px` 等。

因此仅新增一个 `fontScale` 并修改 `html.style.fontSize` 并不能完整解决；必须把“文本字号”从绝对像素逐步归一到 token/rem。边框、图标、阴影、像素级间距不需要跟随字号一起放大。

### 2.4 课程规则公式渲染现状

`MarkdownInline` / `MarkdownBlock` 已经能够把 `$...$`、`\(...\)`、`$$...$$`、`\[...\]` 交给 KaTeX，`MarkdownList` 也会逐项调用 `MarkdownBlock`。所以渲染引擎本身不是主要问题。

问题出在标准 profile 数据：`src/standards/tsinghua-a1-2026.ts` 和 `tsinghua-foundation-2020.ts` 的 `rulesSummary` 把公式写成普通 Unicode 字符串，例如：

- `置信概率 P = 0.95`
- `A 类分量 ΔA = t₀.₉₅(ν)·S_x̄，自由度 ν = n−1`
- `B 类分量 ΔB = Δ仪`
- `总不确定度 Δ = √(ΔA² + ΔB²)`

这与课程资料的数学含义一致，但没有用 Markdown 数学分隔符，所以网页只能按正文显示。课程资料明确给出：总不确定度置信概率为 `P=0.95`，A 类分量为 `Δ_A=t_P(ν)S_{x̄}` 且重复测量时 `ν=n−1`，B 类教学简化取 `Δ_B=Δ_仪`，总不确定度使用方和根合成；当 `Δ_A<Δ_仪/3` 或单次测量时允许简化为 `Δ=Δ_仪`。这些表达式必须按课程原意在 UI 中成为真正的数学公式，而不是继续维护 Unicode 伪公式。

### 2.5 公式系统现状与可扩展性瓶颈

当前 `src/formulas` 共 69 个 `F({...})` 公式定义：

- measurement + instruments：18；
- friction：2；
- hall + thermal：11；
- oscillation：10；
- waves：12；
- optics：8；
- GB/T：8。

当前 formula registry 的优点是：公式不散落在 JSX；每条定义有变量、单位、显式解、条件、不确定度能力、provenance、示例等；搜索是轻量线性过滤，无额外依赖。

但要扩展到几百条大学物理公式，现结构有三个明显瓶颈：

1. `FormulaCategory` 把“课程领域”和“实验专题”混在同一级，继续添加 mechanics/electrostatics/modern 等后，一级 tab 会过多；
2. 公式主结果的单位存放在独立的 `src/formulas/result-units.ts`，结果符号又通过 `resultSymbolFromLatex()` 从等式左边猜取，定义元数据分散，容易漏同步；
3. `expression` 当前强制存在，而高斯定律积分式、法拉第定律积分式、薛定谔方程等“重要但不适合直接填几个数求值”的公式并不适合硬塞成普通数值计算器公式。

此外，当前 `README.md` / 旧 `plan.md` 出现“70+ / 70 个公式”的文案，而实际注册定义是 69 条，说明文档中的手写公式数量已经发生漂移。以后不再把某个精确数量写成长期产品事实；运行时页面直接从 registry 计算，文档只写“覆盖哪些领域”。

### 2.6 单位与物理常数现状

`core/quantity` 已有基本长度、面积、体积、质量、时间、频率、温度、力、能量、功率、电流、电压、电阻、电荷、电容、电感、磁场、压强、密度、热导率、比热、霍尔相关单位，足够当前实验，但不足以覆盖完整大学物理公式库。尤其缺少：速度、加速度、动量、角动量、力矩、黏度、表面张力、电场强度、电势梯度、介电常数、磁通、磁通量单位、导电率、电阻率、熵、摩尔热容、电子伏、原子质量单位等常见单位族。

`src/formulas/types.ts` 还同时放着 `E_CHARGE`、`R_GAS`、`G_STANDARD`。其中 `G_STANDARD = 9.8` 实际是本课程常用的重力加速度默认值，不应与标准重力 `9.80665 m/s²` 或万有引力常量 `G` 在命名上混淆。扩展现代物理公式时，应把物理常数从 formula 类型文件中拆出来并记录来源/是否精确。

### 2.7 性能现状

已经做对的部分：Plotter、Regression、WeightedMean、ProjectWorkbench 有路由级 lazy，首页不会加载 `PhysicsPlot` 代码，现有 Playwright 已对此做检查。

仍可优化的部分：

- `App.tsx` 当前**同步导入** `FormulasPage`，因此 formula registry 会进入首页主依赖图。公式扩展到 200+ 后，这会直接增加首屏 JS；
- `PhysicsPlot.tsx` 使用 `import * as echarts from 'echarts'`，会引入完整 ECharts。ECharts 官方明确推荐 `echarts/core` + 按需 charts/components/renderers 以显著减小 bundle；
- 公式列表当前会一次性渲染全部结果；如果直接扩展到几百条，一次挂载数百个 KaTeX 组件会带来不必要的 DOM/CPU 成本。

因此“公式更多”必须和“按路由加载 + 分批渲染 + ECharts 按需引入”一起做，而不是只增加数据文件。

## 3. UI 优化详细方案

### 3.1 侧栏尺寸与布局

目标值：

- 展开宽度：`216px`；若实屏检查发现英文品牌副标题持续溢出，可在 `212–220px` 内微调，但不得回到 `240px+`；
- 折叠宽度：`60px`；保留现有两字 compact label，不退化为只有图标的不可读导航；
- 品牌标记：从当前视觉 `36px` 容器收至约 `32px`，品牌文字保持一行截断；
- 导航项垂直高度保持紧凑，鼠标/触控可点击区域不低于 32px，移动端继续使用现有底部导航。

`sidebar-brand-row` 改回一行：左侧品牌，右侧小型折叠控制。不要再让“收起导航”形成第二行。

### 3.2 收起/展开按钮

按钮仍必须是真正的 `<button>`，保留键盘、focus-visible、`aria-expanded`、`aria-label`，但视觉上改为“工具按钮”而不是“主按钮”：

- 默认无实心背景、无明显边框，仅显示 `panel-left` 图标；
- 尺寸约 28×28px；
- 默认使用 `ink-3`，hover/focus 时才增强到 `ink-1` / accent；
- 展开态不再显示“收起导航”文字；折叠态也不显示“展开”文字，文字只放在 `title` / `aria-label`；
- 不做漂浮大圆按钮，不放到内容区，不制造第二条边栏。

这样解决“按钮过于突兀”，但没有牺牲可访问性。

### 3.3 设置入口：`2026 A(1)` 改为齿轮

`SideNav` footer 不再把 `StandardProfileBadge` 当成设置按钮。具体方案：

- 删除 footer 中可点击的标准徽章；
- footer 改为一行轻量工具区：**齿轮设置按钮** + 主题切换；
- 齿轮按钮使用现有 `Icon name="settings"`，点击 `navigate('/settings')`；
- 展开态可以在 hover/focus tooltip 说明“设置”，不需要再显示 `2026 A(1)`；折叠态仍是同一齿轮；
- 当前标准仍在首页“当前标准规则摘要”、公式页页头、设置页中明确展示，因此不会丢失状态信息；
- `nav-config.ts` 中现有“设置”导航项先保留，避免改变用户既有导航路径。实屏验收若发现 footer 齿轮与导航项重复感明显，可以在同一 PR 中把系统组的“设置”项移除，但必须确保桌面和移动端都仍有至少一个显式设置入口。默认建议是**先保留，后根据实屏结果决定是否去重**。

### 3.4 字体大小设置

在 `Preferences` 增加：

- `fontScale: 0.9 | 1 | 1.1 | 1.25 | 1.4`；默认 `1`；
- 设置页“外观”面板增加“界面字号”选项：90%、100%、110%、125%、140%；
- 恢复默认设置时恢复到 100%；
- `pea.settings` 持久化，旧用户没有该字段时自然合并为默认 1，不需要 IndexedDB migration。

把 `useThemeSync()` 扩展成 `useAppearanceSync()`：统一同步 `data-theme` 和 `data-font-scale` 到 `<html>`。不要在每个组件读取字号设置。

CSS 迁移原则：

- `html` 默认仍等价于 15px；各 `data-font-scale` 只改变根字号；
- `--fs-xs` 至 `--fs-3xl` 改成 `rem`；
- 所有“文字字号”的硬编码 px 改为 token 或 rem；
- 图标尺寸、1px 边框、阴影、侧栏宽度、部分布局间距保留 px，不随着字号机械放大；
- 输入框、按钮、tab、badge、表格、toast、modal、Markdown、KaTeX 所在父级全部随正文字号缩放；
- `.katex` 保持 em 相对字号，避免单独乘倍导致数学式和正文失衡。

设置中的 140% 是便捷应用内缩放；浏览器本身还必须支持到 200% zoom 而不丢内容。W3C WCAG 1.4.4 的目标是文本可放大到 200% 且不损失内容或功能，因此验收不能只看“设置项能改变 CSS”，必须做 200% 浏览器缩放布局测试。

### 3.5 响应式与字体放大时的布局规则

- `<=900px` 继续隐藏桌面侧栏并使用 mobile bottom nav；
- 大字号时 panel header、按钮组、filter、表单列允许换行，不允许把文本裁掉；
- 表格、代码、长数学式可以在自身容器横向滚动，但**页面 body 不能出现整体横向滚动**；
- 公式卡、badge、按钮长文案允许换行，图标不得被挤压；
- 工作台继续保持“左步骤 + 中央内容 + 唯一右结果检查器”，不增加第二右栏。

## 4. 课程规则公式渲染修复

### 4.1 直接修复 profile 数据

`TSINGHUA_A1_2026.rulesSummary` 和 `TSINGHUA_FOUNDATION_2020.rulesSummary` 的数学内容统一改为 Markdown 数学：

- `置信概率 $P=0.95$`
- `A 类分量 $\Delta_A=t_{0.95}(\nu)\,S_{\bar{x}}$，自由度 $\nu=n-1$`
- `B 类分量 $\Delta_B=\Delta_{\text{仪}}$（仪器误差限，教学简化）`
- `总不确定度 $\Delta=\sqrt{\Delta_A^2+\Delta_B^2}$（方和根合成）`
- `单次测量取 $\Delta=\Delta_{\text{仪}}$`
- `$\Delta_A<\Delta_{\text{仪}}/3$ 时允许简化为 $\Delta=\Delta_{\text{仪}}$`
- 间接量传播统一用 `\Delta_Y`、`\partial f/\partial x_i` 的 LaTeX 写法。

GB/T profile 同样把 `u_c²`、`c_i`、`U=k u_c` 等 Unicode 伪公式改为 `$...$`，但**不改变标准含义**。

### 4.2 保留 Markdown 渲染器，不引入新依赖

现有 `Markdown.tsx + Tex/KaTeX` 足以完成修复，不引入 `react-markdown`、remark、rehype 或 MathJax。仅补充测试和少量公式字符串规范。

为了避免以后再出现“看起来像公式但没有渲染”的回归，新增约束：

- `rulesSummary` 中出现 `Δ`、`u_c`、`` 等数学表达时必须放在数学定界符内；
- 不依赖 Unicode 下标 `₀.₉₅`、Unicode 根号 `√`、Unicode 上标 `²` 来模拟排版；
- 原生 `<option>` / `title` / `aria-label` 等无法放 React 节点的地方才允许使用纯文本符号。

### 4.3 课程来源不改义

课程资料中的关键规则继续保持：`P=0.95`；重复测量的 `\Delta_A=t_P(\nu)S_{\bar{x}}`、`\nu=n-1`；教学简化 `\Delta_B=\Delta_{\text{仪}}`；方和根合成；`\Delta_A<\Delta_{\text{仪}}/3` 或单次测量可按课程规定简化。不得为了“统一成 GB/T”而把课程模式 B 类改成 `a/\sqrt3`。

## 5. 公式库架构升级

### 5.1 公式分类从单层 category 改为“domain + topic”

为了容纳完整大学物理，不继续向当前 `FormulaCategory` 塞几十个一级分类。建议一次迁移成：

- `domain`：一级学科域，稳定、数量少；
- `topic`：章节/专题，可扩展；
- `tags`：搜索辅助词。

一级 domain 建议固定为：

- `measurement`：测量、统计、仪器、不确定度；
- `mechanics`：运动学、动力学、能量动量、转动、引力、流体；
- `thermal`：热学、气体、热力学；
- `electromagnetism`：静电、电路、磁学、电磁感应、交流、电磁波、霍尔；
- `oscillations-waves`：振动、机械波、声学；
- `optics`：几何光学、干涉、衍射、偏振；
- `modern`：相对论、量子、原子、凝聚态/半导体、核物理；
- `standards`：GB/T 等测量标准公式。

当前 friction 归入 mechanics/friction，hall 归入 electromagnetism/hall，实验 thermal 归入 thermal/heat-transfer；不丢失原有搜索词和来源。

### 5.2 把结果元数据收回 FormulaDefinition

删除“双数据源”设计：`result-units.ts` 不应继续随着公式数增长而维护一个并行映射。

`FormulaDefinition` 增加显式结果信息：

- 主结果符号 LaTeX；
- 主结果名称；
- 主结果默认单位；
- 必要时 quantityKind；
- 计算类型 `computable` / `reference`。

迁移完成后：

- `FormulaCalculator` 不再调用 `resultSymbolFromLatex()` 猜左值；
- 不再从 `RESULT_UNITS[id]` 查主结果单位；
- `src/formulas/result-units.ts` 删除；
- 旧公式逐条迁移，不能同时保留新旧两套长期并行。

### 5.3 支持“参考公式”而不是硬凑数值计算

对通用积分/微分方程或定义式，例如高斯定律积分形式、法拉第定律积分形式、麦克斯韦方程组、含时/定态薛定谔方程，增加 `kind: 'reference'`：

- 仍可搜索、显示、复制 LaTeX/Markdown、显示变量/符号和来源；
- 详情页不显示普通数值输入计算器，而显示“参考公式/适用条件”；
- 不伪造一个不正确的 scalar expression；
- 可同时存在对应的可计算特例，例如“无限长直导线磁场”“球对称电场”“粒子在一维无限深势阱能级”。

### 5.4 公式模块按领域拆分

建议目录：

- `formulas/measurement.ts`（保留）；
- `formulas/mechanics/kinematics.ts`；
- `formulas/mechanics/dynamics.ts`；
- `formulas/mechanics/energy-momentum.ts`；
- `formulas/mechanics/rotation-gravity-fluids.ts`；
- `formulas/thermal/thermal-properties.ts`；
- `formulas/thermal/thermodynamics.ts`；
- `formulas/em/electrostatics.ts`；
- `formulas/em/circuits.ts`；
- `formulas/em/magnetism.ts`；
- `formulas/em/induction-ac.ts`；
- `formulas/waves/oscillations.ts`；
- `formulas/waves/waves-sound.ts`；
- `formulas/optics/geometric.ts`；
- `formulas/optics/physical.ts`；
- `formulas/modern/relativity.ts`；
- `formulas/modern/quantum-atomic.ts`；
- `formulas/modern/nuclear-solid.ts`；
- 当前 7 实验特有公式仍可放原实验相关模块或被合并到上述 domain，但 provenance 必须保留课程来源。

每个文件保持几十条以内，避免出现一个 2,000 行巨型公式文件。

## 6. 大学物理公式覆盖矩阵

“全覆盖”按大学物理主干章节定义，而不是简单按条数。OpenStax University Physics Vol. 1–3 的章节结构覆盖了力学、波与声、热力学、电磁学、光学、相对论、量子、原子、凝聚态、核物理，可作为**通用扩展的章节覆盖参考**；这些条目必须标记 `provenance.status = 'general'`，不能冒充上传课程资料。

以下列表是最低覆盖集合；当前已存在且正确的公式直接复用，不重复制造第二个 id。

### 6.1 测量、统计与仪器

保留现有平均值、残差、贝塞尔标准差、平均值标准偏差、课程 A/B/总不确定度、相对不确定度、间接传播、OLS、相关系数、拟合参数不确定度、区间半宽、模拟/数字表、电阻箱、GB/T 各公式。补充：

- 绝对误差与相对误差定义；
- 百分差、百分偏差；
- 加权平均与 `w_i=1/u_i²` 特例；
- 协方差/相关系数定义的可计算版本；
- 线性插值；
- 组合测量常见面积/体积/密度表达式作为实验数据处理常用条目。

### 6.2 力学：运动学与动力学

至少覆盖：

- 位移、平均/瞬时速度、平均/瞬时加速度；
- 匀加速 `v=v0+at`、`x=x0+v0t+at²/2`、`v²=v0²+2aΔx`、平均速度特例；
- 自由落体；
- 抛体水平/竖直分量、飞行时间、射程、最大高度；
- 相对速度；
- `v=ωr`、`a_c=v²/r=ω²r`、切向加速度；
- 牛顿第二定律、重力、弹力、静/动摩擦；
- 斜面分力；
- 向心力关系；
- 线性阻力/二次阻力只在能够明确给出模型假设时加入，必须写明适用范围。

### 6.3 力学：功、能量、动量、碰撞

至少覆盖：

- 恒力功 `W=Fs cosθ`；
- 动能、动能定理；
- 瞬时/平均功率；
- 重力势能、弹性势能；
- 机械能守恒；
- 动量、冲量、动量定理；
- 质心位置/速度；
- 一维完全非弹性碰撞；
- 一维弹性碰撞通式；
- 恢复系数；
- 二体系统质心关系。

### 6.4 力学：转动、平衡、弹性、引力、流体

至少覆盖：

- 角位移、角速度、角加速度与匀角加速关系；
- 力矩、转动惯量定义；
- 细杆、圆环、圆盘/圆柱、实心球、球壳常见转动惯量；
- 平行轴定理；
- `τ=Iα`、转动动能、角动量、角动量守恒；
- 无滑动滚动 `v=ωR` 和滚动总动能；
- 静力平衡 `ΣF=0`、`Στ=0`；
- 正应力/应变/杨氏模量、剪切模量、体积模量；
- 万有引力、重力场强、引力势能；
- 轨道速度、轨道周期、逃逸速度、开普勒第三定律；
- 密度、压强、静水压；
- 阿基米德浮力；
- 连续性方程；
- Bernoulli 方程；
- Torricelli；
- Poiseuille、Stokes 阻力、终端速度；
- 表面张力/毛细上升的常用形式。

### 6.5 振动、机械波与声学

在现有阻尼/受迫振动、示波器/声速公式上补齐：

- 简谐运动 `x=A cos(ωt+φ)`、速度、加速度；
- 弹簧振子 `ω=√(k/m)`、周期、总能量；
- 单摆小角度周期；
- 物理摆周期（作为可选进阶）；
- 行波 `y=A cos(kx−ωt+φ)`、`v=fλ=ω/k`；
- 弦波速 `√(T/μ)`；
- 波强与振幅平方关系；
- 驻波波节/波腹、两端固定弦谐波；
- 开管/闭管共鸣频率；
- 声强 `I=P/A`；
- 声强级 `β=10log10(I/I0)`；
- 拍频；
- Doppler 常见静止介质模型，并在条件中写清声源/观察者符号约定。

### 6.6 热学与热力学

至少覆盖：

- 摄氏/开尔文换算（温度与温差语义继续分离）；
- 线膨胀、面积/体积膨胀；
- `Q=mcΔT`、相变潜热；
- 混合量热平衡；
- Fourier 一维导热及稳态平板特例（现有实验式保留）；
- 理想气体 `PV=nRT`；
- 分子平均平动动能、`v_rms`；
- 单原子理想气体内能；
- 热力学第一定律，明确项目统一的做功符号约定；
- 等容、等压、等温过程的热/功/内能变化；
- 绝热关系 `PV^γ=const`、`TV^{γ−1}=const`；
- `C_p-C_v=R`、`γ=C_p/C_v`；
- 热机效率、制冷系数；
- Carnot 效率；
- 可逆过程熵变常见公式。

### 6.7 静电学、电势与电容

至少覆盖：

- Coulomb 定律；
- 点电荷电场；
- 电场叠加（参考）；
- 电偶极矩、轴线/赤道线远场可作为进阶；
- 电通量；
- Gauss 定律积分形式（reference）；
- 无限长线电荷、无限大平面、球对称分布的可计算特例；
- 点电荷电势、电势能；
- `E=-dV/dx` 一维形式与通用梯度 reference；
- 平行板电容、含介质；
- 电容串并联；
- 电容储能与电场能量密度。

### 6.8 电流、直流电路与 RC

至少覆盖：

- `I=dQ/dt`、电流密度；
- 漂移速度 `I=nqAv_d`；
- `R=ρL/A`；
- 电阻温度系数；
- Ohm `V=IR`；
- 电功率 `P=VI=I²R=V²/R`；
- 电阻串并联；
- Kirchhoff 结点/回路定律（reference + 简单计算特例）；
- 电源内阻与端电压；
- Wheatstone 平衡；
- RC 充电/放电、电荷/电压/电流、时间常数。

这里可以直接补上旧 plan 写过但实际 registry 中缺失的 `R=U/I` 与 `P=UI`。

### 6.9 磁场、磁力与磁场源

至少覆盖：

- Lorentz 力；
- 带电粒子垂直磁场圆周半径与回旋频率；
- 载流导线磁力；
- 磁偶极矩与力矩；
- Biot–Savart 定律（reference）；
- 长直导线、圆电流中心、长螺线管磁场；
- Ampère 环路定律（reference）；
- 平行长直导线单位长度作用力；
- 现有 Hall 电压、Hall 系数、载流子浓度、磁阻公式继续保留。

### 6.10 电磁感应、电感、交流与电磁波

至少覆盖：

- 磁通量；
- Faraday–Lenz 定律（reference）；
- 匀强磁场中运动导体 `ε=Blv` 特例；
- 转动线圈发电机正弦电动势；
- 自感 `ε_L=-L dI/dt`；
- 长螺线管电感；
- 电感储能；
- RL 上升/衰减时间常数；
- `X_L=ωL`、`X_C=1/(ωC)`；
- 串联 RLC 阻抗、相位、共振；
- RMS 电压/电流、平均功率与功率因数；
- 理想变压器；
- `c=1/√(μ0ε0)`；
- 平面电磁波 `E/B=c`；
- Poynting 矢量和平均强度常见形式。

### 6.11 几何光学

在现有薄透镜、放大率、共轭法、焦距仪、凹透镜自准上补齐：

- 反射定律；
- Snell 定律；
- 临界角与全反射；
- 平面镜；
- 球面镜成像与放大率；
- 薄透镜成像与放大率（复用当前）；
- 透镜制造者公式；
- 光焦度；
- 多薄透镜贴合等效焦距（可选进阶）；
- Brewster 角。

所有涉及符号正负的公式必须在 `conditions` 明确项目采用的符号约定，避免不同教材约定混用。

### 6.12 干涉、衍射与偏振

至少覆盖：

- 双缝光程差、亮/暗纹条件、条纹间距；
- 薄膜干涉的正入射常见条件，并明确相位反转假设；
- 现有 Michelson 光程差/测波长/白光玻片继续保留；
- 单缝衍射极小条件；
- 光栅方程；
- 光栅分辨本领；
- Rayleigh 圆孔分辨极限；
- Malus 定律；
- 非偏振光通过理想偏振片的 `I=I0/2` 特例。

### 6.13 狭义相对论

至少覆盖：

- Lorentz 因子 `γ`；
- 时间膨胀；
- 长度收缩；
- 一维 Lorentz 坐标变换；
- 一维速度合成；
- 相对论动量；
- 总能量、静能、动能；
- `E²=p²c²+m²c⁴`；
- 质能关系。

所有速度输入约束 `|v|<c`。

### 6.14 光子、物质波与量子基础

至少覆盖：

- `E=hf=hc/λ`；
- 光子动量；
- 光电效应 Einstein 方程；
- 截止电势；
- Compton 位移；
- de Broglie 波长；
- Heisenberg 位置-动量不确定关系；
- 定态薛定谔方程（reference）；
- 一维无限深势阱能级；
- 隧穿的简单矩形势垒近似可列为进阶，并明确近似条件。

### 6.15 原子、固体/半导体与核物理

至少覆盖：

- Bohr 半径/氢样原子能级；
- Rydberg 光谱关系；
- 能级跃迁光子频率/波长；
- 晶格/能带类只放大学物理通用且可定义清楚的关系，不把材料物理专门模型硬塞入；
- 现有 Hall/载流子浓度可作为半导体实验入口；
- 核半径经验式；
- 质能亏损与结合能；
- 放射性衰变 `N=N0e^{-λt}`；
- 活度 `A=λN`；
- 半衰期 `T1/2=ln2/λ`；
- 核反应 Q 值；
- 成对产生/湮灭等可作为 modern reference，不追求粒子物理百科化。

### 6.16 覆盖数量的约束

最终可见公式预计会落在约 **200–250 条**。验收以“上面 15 个主干领域和列出的核心关系全部存在”为第一标准；总数只作为漏项预警，不允许为了达到数字而添加重复、无条件说明、无单位、无测试的公式。

## 7. 物理常数与单位扩展

### 7.1 常数模块

新增独立的 `src/physics/constants.ts`（或等价单一模块），常数元数据至少包含 symbol、数值、单位、`isExact`、来源。

优先加入：

- `c`、`h`、`e`、`k_B`、`N_A`：SI 定义常数，按 BIPM 固定值并标记 exact；
- `\hbar`：由 exact `h/(2π)` 派生；
- `G`、`ε0`、`μ0`、电子质量、质子质量等：使用 NIST/CODATA 2022 推荐值，按实际情况标记非 exact；
- 标准重力 `g_n=9.80665 m/s²` 与课程默认 `g=9.8 m/s²` 明确区分；
- 当前 `G_STANDARD` 重命名为 `COURSE_DEFAULT_G`，避免和万有引力常量 `G` 发生语义冲突；
- `R` 使用受控常数值，且说明是摩尔气体常数。

公式表达式内部避免把字母 `e` 当成基本电荷，因为 expression 引擎的 `e` 已代表 Euler 常数；基本电荷统一用 `q_e` 或 formula constant 名。

### 7.2 单位目录扩展

继续使用当前显式静态 `UNIT_CATALOG`，**不引入完整单位解析库**。对大学物理常见单位新增明确定义，至少包括：

- `m/s`、`km/h`、`m/s2`；
- `kg·m/s`、`N·s`、`kg·m2/s`、`N·m`；
- `Pa·s`、`N/m`；
- `mol`、`J/mol`、`J/(mol·K)`；
- `W/m2`；
- `V/m`、`N/C`；
- `F/m`、`C/m2`；
- `Ω·m`、`S`、`S/m`；
- `Wb`；
- `eV`、`keV`、`MeV`、`u`；
- 现代物理常用 `eV/c` 不建议进入普通数值换算体系，除非维度模型能明确表达；优先保持 SI 输入并在显示层提供说明。

所有新增单位必须有 `dim`、factor、中文名、family 和往返测试；带偏置温标仍沿用当前“绝对温度/温差”两套转换函数，不改现有正确逻辑。

## 8. 公式页面 UX 与性能

### 8.1 过滤界面

公式页改为：搜索框 + 一级 domain + 二级 topic。一级 domain 数量保持约 8 个，不做 20 多个横向 tab。

默认“全部”时不一次渲染全部卡片。采用**无依赖分批显示**：

- 首批 24 或 30 条；
- “加载更多”每次增加一批；
- 改搜索词/分类时重置到首批；
- 不引入 virtualization 库。

这样 200+ 公式不会一次初始化数百个 KaTeX DOM。

### 8.2 搜索

继续使用轻量 substring 搜索，不引入 Fuse.js。搜索字段扩展为：title、aliases、domain label、topic label、tags、变量名/中文名、LaTeX。数据规模在几百条内，线性过滤足够。

### 8.3 路由懒加载

`FormulasPage` / `FormulaDetailPage` 改为 route-level lazy，使大型公式定义不会进入首页初始 chunk。Vite 会自动对动态 import 做 code splitting，并对 async chunk 的共享依赖做 preload 优化。

如果以后公式库继续增长，再考虑按 domain 动态拆分 registry；本轮先做到“公式路由整体 lazy + 列表分批渲染”，不要过度设计。

### 8.4 ECharts 按需引入

`PhysicsPlot.tsx` 从整包 `import * as echarts from 'echarts'` 改为 ECharts 官方 tree-shaking API：`echarts/core` + 当前实际使用的 Line/Scatter 等 chart、Grid/Tooltip/Legend 等 component，以及真正需要的 renderer。

当前项目需要导出 SVG/PNG，renderer 选择必须按已有导出实现核实：如果同一个 chart 实例依赖 Canvas PNG 导出，则保留 CanvasRenderer；如果某条路径明确用 SVGRenderer，也只注册实际需要者。不要为了“体积更小”破坏现有 PNG/SVG 导出。

## 9. 文件级实施清单

### 9.1 必改

- `src/app/styles/tokens.css`：侧栏宽度、rem 字阶、字号 scale data selector；
- `src/app/styles/base.css`：根字号逻辑和残余文本 px 审计；
- `src/app/styles/layout.css`：品牌行、sidebar toggle、footer 工具区、折叠态 60px；
- `src/app/styles/components.css`：按钮/badge/input/table 等硬编码字号迁移；
- `src/app/App.tsx`：`useAppearanceSync`、公式路由 lazy；
- `src/app/shell/SideNav.tsx`：低权重 toggle、gear 设置按钮、移除可点击标准徽章；
- `src/stores/settings.ts`：`fontScale`；
- `src/features/settings/SettingsPage.tsx`：字号设置；
- `src/standards/tsinghua-a1-2026.ts`、`tsinghua-foundation-2020.ts`、`gbt-27418-2017.ts`：rulesSummary 数学 Markdown；
- `src/formulas/types.ts`：domain/topic/result/kind/tags 等结构；
- `src/formulas/registry.ts`：新 domain/topic 聚合和搜索；
- `src/features/formulas/FormulasPage.tsx`：二级分类、分批显示、reference 公式详情；
- `src/components/FormulaCalculator.tsx`：从 formula.result 读结果元数据，不再依赖外部 mapping；
- `src/formulas/result-units.ts`：迁移后删除；
- `src/core/quantity/index.ts`：新增单位；
- `src/physics/constants.ts`：新增；
- `src/components/PhysicsPlot.tsx`：ECharts 按需引入；
- `src/tests/registry.test.ts`、`markdown-ui.test.ts`、`core-basics.test.ts`：新增对应回归；
- `e2e/layout.spec.ts`、`e2e/smoke.spec.ts`：侧栏、齿轮、字号、数学渲染；
- `.github/workflows/deploy.yml`：加入 Chromium e2e job；
- `README.md` / `AGENTS.md` / `plan.md`：更新架构和公式覆盖说明，去掉会漂移的硬编码公式数量。

### 9.2 新增公式模块

按第 5、6 节领域拆分新增文件。每个新公式模块只导出定义数组，不放 React/UI 逻辑。

### 9.3 默认不改

除非新增公式暴露真实 bug，否则不改：

- `core/sigfig`；
- `core/statistics` 的 t/正态实现；
- `core/uncertainty` 的课程与 GB/T 策略；
- 7 个实验 compute；
- IndexedDB schema；
- Markdown parser 总体结构；
- 报告导出数据模型。

## 10. 测试与验收标准

### 10.1 侧栏验收

1. 1280×800、1440×900、1920×1080 桌面视口下，展开侧栏实测宽度在 `212–220px`，默认目标 `216px`；折叠态在 `56–64px`，默认目标 `60px`。
2. 展开态品牌和折叠按钮处于同一行；页面首屏不再出现一整行“收起导航”按钮。
3. toggle 默认无高对比实心底/重边框；hover、focus-visible 时可清晰识别。
4. toggle 有 `aria-expanded`，展开/折叠 `aria-label` 正确；Tab 可聚焦，Enter/Space 可触发。
5. 折叠后所有主导航仍能通过 compact label 识别；当前已有“首页/实验/公式/工具/项目/设置/规则”语义不得丢失。
6. 刷新页面后 `sidebarCollapsed` 持久化。
7. 侧栏 footer 不再显示一个可点击的 `2026 A(1)` 标准徽章作为设置入口；可看到一个齿轮设置按钮，点击进入 `/#/settings`。
8. 当前标准信息仍能在首页/公式页/设置页查到。

### 10.2 字号验收

1. 设置页有 90%、100%、110%、125%、140% 五档；修改立即生效并持久化。
2. 主要正文、标题、按钮文字、输入、select、tab、badge、表格、toast、Markdown、KaTeX 随字号档位变化。
3. 图标、1px 边框等不出现不合理倍增。
4. 390px 移动视口分别在 100%、140% 下无 body 横向溢出；长公式只在公式容器内部滚动。
5. 1280px 桌面在 140% 字号下：侧栏导航不裁切，panel header 可自然换行，按钮不相互覆盖。
6. 浏览器 200% zoom 下：首页、公式列表、公式详情、设置页、实验工作台、工具页均无文字被不可恢复地裁切/遮挡；功能仍可操作。
7. `resetToDefaults()` 将字号恢复为 100%。

### 10.3 课程数学渲染验收

1. 首页“当前标准规则摘要”中至少以下内容出现 KaTeX + MathML，而不是普通 Unicode 文本：`P=0.95`、`Δ_A=t_{0.95}(ν)S_{x̄}`、`ν=n−1`、`Δ_B=Δ_仪`、`Δ=√(Δ_A²+Δ_B²)`。
2. 设置页 2026 profile 的规则摘要同样渲染上述数学。
3. 2020 profile 的相同规则也渲染数学。
4. GB/T 的 `u_c`、`U=k u_c` 等摘要数学渲染正常。
5. 数学式在 390px 下不撑破页面；MathML 仍存在。
6. 课程规则的数值含义不变：现有 `uncertainty.test.ts` 全部继续通过。

### 10.4 公式定义静态验收

每个公式必须满足：

1. id 全局唯一，version 为正整数；
2. domain/topic 存在并已注册 label；
3. title、aliases/tags 足以搜索中英文常用名；
4. latex 非空且 KaTeX 可渲染；
5. `computable` 公式 expression 可被安全 AST 编译；
6. `solutions` 中每个显式解可编译；
7. 所有 variable/result unit 在单位系统中可解析，或明确为空/无量纲；
8. 物理约束明确：分母非零、根号定义域、概率范围、`|v|<c`、小角近似等应放 `constraints/conditions`；
9. provenance 必填；上传资料公式使用 source-explicit/source-derived，一般大学物理扩展用 general；
10. `computable` 公式至少 1 个 numerical example，并有自动测试；reference 公式至少有符号/适用条件测试；
11. 不允许 `experimental` 条目进入默认可见库。

### 10.5 公式覆盖验收

1. 第 6 节 15 个主干领域全部有公式；
2. 第 6 节逐条列出的核心公式均能通过 id/标题/别名搜索到；
3. 当前 69 个公式的 id 保持兼容，已有链接和草稿 key 不失效；如必须改 id，要提供 alias/migration，默认不改旧 id；
4. 旧课程/实验公式的 provenance 不被改成 general；
5. 公式总可见条目预计 200–250，但不能以数量替代逐领域 checklist；
6. 公式页默认首屏只挂载一批卡片，不一次渲染全部 200+ KaTeX。

### 10.6 单位与常数验收

1. 新单位全部 `convert(a→b→a)` 往返满足数值容差；
2. 不相容量纲仍抛 `DimensionMismatchError`；
3. ℃ 绝对值与温差逻辑现有测试继续通过；
4. BIPM 定义常数 `c/h/e/k_B/N_A` 标记 exact；
5. `G/ε0/μ0` 等按 CODATA 元数据标记正确；
6. 课程默认 `g=9.8` 与标准重力/万有引力常量命名和语义不混淆。

### 10.7 公式计算验收

对每个新增 domain 至少做一组手算/权威样例交叉检查；此外对每个 computable 条目跑 `examples`。重点 golden：

- 匀加速、抛体；
- 动量守恒碰撞；
- 转动惯量/滚动；
- 轨道速度/逃逸速度；
- Bernoulli；
- 理想气体/热机；
- Coulomb/电容/RC；
- Lorentz/长直导线/感应；
- RLC；
- 双缝/单缝/光栅；
- 相对论 `γ`；
- 光电效应/de Broglie；
- 放射性衰变。

结果不允许 NaN/Infinity 穿透 UI；定义域错误必须显示可操作信息。

### 10.8 性能验收

1. 首页初始加载不请求公式库 route chunk，也不请求 `PhysicsPlot/ECharts` chunk；
2. 打开公式页后才加载公式相关 chunk；
3. 打开绘图/需要图表的页面后才加载 ECharts；
4. ECharts 改为官方按需导入后，production build 的 chart chunk 应比整包导入基线明显下降；如果未下降，必须说明是哪些组件/renderer 导致并撤回无收益复杂化；
5. 添加 200+ 公式后，首页 initial JS gzip 不得相对本轮基线显著增长；目标是不增或下降；
6. 公式搜索使用 O(N) 内存内过滤，无 Web Worker、无后台轮询、无大型搜索索引；
7. 公式列表只渲染首批 24/30 条，连续“加载更多”不会重复创建已存在项。

### 10.9 CI 验收

每次 PR / main 至少执行：

- `npm run typecheck`；
- `npm test`；
- `npm run build`；
- Chromium Playwright e2e。

GitHub Actions 新增 Playwright 浏览器安装步骤并缓存 npm，不要求部署 job 重复跑 e2e。最终 Pages 部署仍只在 main 且 verify 全通过后进行。

### 10.10 回归验收

以下既有能力不得退化：

- 7 个实验均可创建项目并计算；
- 课程与 GB/T 同输入得到不同且符合各自语义的结果；
- `15.0` 有效数字语义不丢；
- 公式草稿刷新恢复、公式间隔离；
- DataGrid 粘贴/撤销/重做；
- CSV/Markdown/LaTeX/JSON 报告导出；
- SVG/PNG 图导出；
- 深/浅/系统主题；
- 390px 手机布局；
- Markdown 不执行 raw HTML / javascript 链接。

## 11. 实施顺序

### Phase A — UI 缺陷先修

一次 PR 完成侧栏宽度、toggle、gear 设置入口、fontScale、字号 CSS 归一和课程规则 LaTeX 化。这个阶段**不碰公式 schema**，便于快速验证用户当前最明显的问题。

验收：第 10.1–10.3 全通过，既有 unit/e2e 全绿。

### Phase B — 公式架构迁移

迁移 `FormulaDefinition` 到 domain/topic/result/kind/tags；逐条迁移现有 69 个公式；删 `result-units.ts`；公式页改二级过滤和 reference 类型；新增 registry static validation。

验收：现有 69 id 全保留；所有现有公式计算结果不变；公式页功能回归全通过。

### Phase C — 单位与常数地基

扩 `quantity` 单位族；新建 constants；重命名课程 g；添加 BIPM/NIST 来源元数据和测试。

验收：第 10.6 全通过，现有 quantity 测试无回归。

### Phase D — 公式库分领域扩展

按以下顺序分多个小 PR，每个 PR 都可独立验收，避免一次加入 150 条无法审查：

1. mechanics：运动学/动力学；
2. mechanics：能量/动量/转动/引力/流体；
3. thermal；
4. electromagnetism：静电/直流；
5. electromagnetism：磁场/感应/交流/电磁波；
6. oscillations-waves；
7. optics；
8. modern。

每个 PR 必须同时带定义、单位、examples、registry tests，不允许“先堆公式，之后再补测试”。

### Phase E — 性能与 CI 收尾

公式 route lazy、列表分批、ECharts tree-shaking、Playwright CI、文档清理、构建产物对比。

最终验收：第 10 节全部通过，且不留下旧 result-unit 映射、旧 category 双体系、废弃 formula module 或临时兼容代码。

## 12. 明确不做的事情

- 不把课程 `Δ_B=Δ_仪` 改成 GB/T 的矩形分布标准不确定度；
- 不用“更科学”为理由替换课程指定规则；
- 不加入后端、账号、云同步；
- 不加入 react-markdown/remark/MathJax/Fuse 等当前不需要的运行时依赖；
- 不为公式库引入通用 CAS；mathjs AST 足够当前 scalar calculator；
- 不做无限滚动复杂状态、虚拟列表库或 Web Worker 搜索；
- 不为了视觉效果引入新的 icon/UI 框架；
- 不重写已经验证的实验计算内核；
- 不同时长期保留新旧 formula schema；迁移完成后清理旧文件和兼容层。

## 13. 资料与外部依据

### 13.1 项目/课程资料

- `2026秋物理实验A(1)教学资料.pdf`：本项目课程规则最高优先级；其中 II-1 明确 `P=0.95`、A 类 t 因子、B 类 `Δ仪` 教学简化、方和根合成、`ΔA<Δ仪/3` 简化和有效数字规则。
- `课程基础知识202009.pptx`、`讲义第II部分课程基础知识.pdf`：课程基础知识与历史兼容规则交叉核对。
- `GB/T 27418-2017 测量不确定度评定和表示.pdf`：GB/T profile 的 A/B 类标准不确定度、合成标准不确定度、扩展不确定度依据。

### 13.2 通用大学物理覆盖参考

- OpenStax University Physics Vol. 1–3：用于定义通用大学物理的章节覆盖边界（Mechanics；Waves/Acoustics；Thermodynamics；Electricity & Magnetism；Optics；Relativity；Quantum；Atomic；Condensed Matter；Nuclear）。通用扩展仅标记 `general`。
- https://openstax.org/books/university-physics-volume-1/pages/preface

### 13.3 SI 与常数

- BIPM SI defining constants：`c/h/e/k/N_A` 等定义常数及 exact 语义。
- https://www.bipm.org/en/measurement-units/si-defining-constants
- BIPM SI Brochure：SI 单位和书写规则。
- https://www.bipm.org/en/publications/si-brochure
- NIST/CODATA 2022：非定义常数与推荐值。
- https://physics.nist.gov/cuu/Constants/

### 13.4 可访问性、构建与图表

- W3C WCAG SC 1.4.4 Resize Text：文本可放大至 200% 而不丢失内容/功能。
- https://www.w3.org/WAI/WCAG21/Understanding/resize-text
- Vite Features：dynamic import 和自动 code splitting/preload。
- https://vite.dev/guide/features
- Apache ECharts Handbook — Import ECharts：官方推荐 `echarts/core` 按需注册以减小 bundle。
- https://echarts.apache.org/handbook/en/basics/import/

## 14. 最终 Definition of Done

只有同时满足以下条件，本轮才算完成：

- 侧栏展开约 216px、折叠约 60px，收起按钮不再抢视觉焦点；
- 侧栏设置入口已从 `2026 A(1)` 徽章改为齿轮，标准信息在内容区仍清晰可查；
- 用户可以在设置中持久化改变字号，140% 应用内字号和 200% 浏览器 zoom 均无关键功能损失；
- 课程/GB/T 规则摘要中的数学表达全部由 KaTeX/MathML 渲染；
- 现有课程不确定度计算数值完全不变；
- formula schema 已完成一次性清理迁移，不再保留 `result-units.ts` 双数据源；
- 大学物理 15 个主干领域覆盖完成，每个核心 computable 公式有单位、条件、provenance 和测试；
- 公式页不会一次渲染几百个 KaTeX 卡片，公式 route 不进入首页初始 chunk；
- ECharts 使用按需导入且导出能力不回退；
- typecheck、unit/property/golden tests、Playwright、production build 全部通过；
- README / AGENTS / plan 与当前实现一致，不再宣称错误的硬编码公式数量；
- 无死代码、无废弃兼容层、无第二套 formula schema、无新增不必要运行时依赖。
