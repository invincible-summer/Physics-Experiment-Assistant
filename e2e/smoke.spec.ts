/** E2E 冒烟测试：应用可加载、导航可用、核心页面渲染、工具数据流转、主题切换生效 */
import { test, expect } from '@playwright/test';

test('首页加载并显示任务导向入口', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '物理实验小助手' })).toBeVisible();
  await expect(page.getByText(/当前标准规则摘要/)).toBeVisible();
  await expect(page.getByRole('link', { name: /实验工作台/ }).first()).toBeVisible();
  await expect(page.getByText('最近项目')).toBeVisible();
});

test('实验列表显示 7 个实验', async ({ page }) => {
  await page.goto('/#/experiments');
  await expect(page.getByRole('heading', { name: '实验工作台' })).toBeVisible();
  await expect(page.getByText('摩擦系数测量')).toBeVisible();
  await expect(page.getByText('霍尔效应及磁电阻测量')).toBeVisible();
  await expect(page.getByText('迈克尔逊干涉实验')).toBeVisible();
  await expect(page.getByRole('button', { name: '新建项目' })).toHaveCount(7);
});

test('工具枢纽列出 7 个工具', async ({ page }) => {
  await page.goto('/#/tools');
  await expect(page.getByRole('heading', { name: '数据处理工具' })).toBeVisible();
  for (const name of ['快速统计', '线性拟合', '加权平均', '不确定度传播', '绘图工作台', '科学计算器', '单位换算']) {
    await expect(page.getByRole('link', { name })).toBeVisible();
  }
  await expect(page.getByText('工具间的数据流转')).toBeVisible();
});

test('公式工作台搜索与卡片', async ({ page }) => {
  await page.goto('/#/formulas');
  await expect(page.getByRole('heading', { name: '公式工作台' })).toBeVisible();
  await page.getByPlaceholder(/搜索公式/).fill('霍尔');
  await expect(page.getByText('霍尔电压').first()).toBeVisible();
  // 复制操作收敛进「复制」菜单
  const card = page.locator('.panel', { hasText: '霍尔电压' }).first();
  await card.getByRole('button', { name: '复制' }).click();
  await expect(page.getByRole('menuitem', { name: '复制 LaTeX' })).toBeVisible();
});

test('快速统计：DataGrid 录入 + 不确定度', async ({ page }) => {
  await page.goto('/#/tools/statistics');
  await expect(page.getByRole('heading', { name: '快速统计' })).toBeVisible();
  // 逐格录入：Enter 自动跳到下一行
  const firstCell = page.locator('.data-grid .cell-input').first();
  await firstCell.click();
  for (const v of ['5.12', '5.10', '5.07', '5.11', '5.10']) {
    await page.keyboard.type(v);
    await page.keyboard.press('Enter');
  }
  await expect(page.getByRole('cell', { name: '平均值', exact: true })).toBeVisible();
  await page.getByPlaceholder('如 0.02').fill('0.02');
  await expect(page.locator('.result-final .value').first()).toContainText('±');
});

test('工具间数据流转：统计列 → 线性拟合', async ({ page }) => {
  await page.goto('/#/tools/statistics');
  const firstCell = page.locator('.data-grid .cell-input').first();
  await firstCell.click();
  for (const v of ['1.5', '2.4', '3.2', '4.1', '5.3']) {
    await page.keyboard.type(v);
    await page.keyboard.press('Enter');
  }
  await page.getByRole('button', { name: '发送到…' }).click();
  await page.getByRole('menuitem', { name: /线性拟合/ }).click();
  await expect(page).toHaveURL(/\/tools\/regression/);
  await expect(page.getByText(/收到来自「快速统计/)).toBeVisible();
  await page.getByRole('button', { name: '填入本页' }).click();
  // 单列数据作为 y、x 自动取序号后应立即出现拟合结果
  await expect(page.getByText('拟合结果', { exact: true })).toBeVisible();
  await expect(page.locator('.result-final .value').first()).toBeVisible();
});

test('实验工作台：建项目、stepper 状态与步骤翻页', async ({ page }) => {
  await page.goto('/#/experiments/friction/new');
  await page.getByRole('button', { name: '创建项目并进入工作台' }).click();
  await expect(page).toHaveURL(/\/project\//);
  // stepper 与顶栏进度
  await expect(page.locator('.step-nav-list li')).toHaveCount(4);
  await expect(page.locator('.topbar-progress')).toContainText('第 1/4 步');
  // 步骤翻页
  await page.getByRole('button', { name: '下一步' }).click();
  await expect(page.locator('.topbar-progress')).toContainText('第 2/4 步');
  await expect(page.getByRole('button', { name: '上一步' })).toBeEnabled();
  // 非法参数标红（g 在第一步）
  await page.getByRole('button', { name: '上一步' }).click();
  const gInput = page.locator('.wb-main .panel', { hasText: '重力加速度' }).locator('.input').first();
  await gInput.fill('abc');
  await expect(page.locator('.wb-main .field-error').first()).toBeVisible();
});

test('设置页可切换标准', async ({ page }) => {
  await page.goto('/#/settings');
  await expect(page.getByRole('heading', { name: '设置' })).toBeVisible();
  await expect(page.getByText('GB/T 27418-2017').first()).toBeVisible();
});

test('绘图工作台：表达式出图 + 轴范围 + 导出按钮', async ({ page }) => {
  await page.goto('/#/tools/plotter');
  await expect(page.getByRole('heading', { name: '绘图工作台' })).toBeVisible();
  // 添加表达式 y=x^2，取样 [0,10]
  await page.getByRole('button', { name: '添加表达式' }).click();
  await page.getByLabel('表达式 y=f(x)').fill('x^2');
  // 图渲染（ECharts SVG）
  await expect(page.locator('.panel svg').first()).toBeVisible();
  // 导出按钮存在
  await expect(page.getByRole('button', { name: '导出 SVG' })).toBeVisible();
  await expect(page.getByRole('button', { name: '导出 CSV' })).toBeVisible();
  // 横轴起点设置后仍然正常渲染
  await page.getByLabel('横轴起点').fill('0');
  await page.getByLabel('横轴终点').fill('10');
  await expect(page.locator('.panel svg').first()).toBeVisible();
});

test('主题三态切换作用于文档根', async ({ page }) => {
  await page.goto('/');
  const themeBtn = page.getByRole('button', { name: /主题：/ });
  await expect(themeBtn).toBeVisible();
  // system → light → dark（测试环境 prefers-color-scheme 默认 light）
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await themeBtn.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.getByRole('button', { name: /主题：浅色/ })).toBeVisible();
  await page.getByRole('button', { name: /主题：浅色/ }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});
