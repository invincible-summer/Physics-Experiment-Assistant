/** E2E 冒烟测试：应用可加载、导航可用、核心页面渲染、主题切换生效 */
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

test('公式工作台搜索与卡片', async ({ page }) => {
  await page.goto('/#/formulas');
  await expect(page.getByRole('heading', { name: '公式工作台' })).toBeVisible();
  await page.getByPlaceholder(/搜索公式/).fill('霍尔');
  await expect(page.getByText('霍尔电压').first()).toBeVisible();
  await expect(page.getByRole('button', { name: '复制 LaTeX' }).first()).toBeVisible();
});

test('快速统计工具计算', async ({ page }) => {
  await page.goto('/#/tools/statistics');
  await expect(page.getByRole('heading', { name: '快速统计' })).toBeVisible();
  await page.getByPlaceholder(/每行一个数值/).fill('5.12\n5.10\n5.07\n5.11\n5.10');
  await expect(page.getByRole('cell', { name: '平均值', exact: true })).toBeVisible();
  await page.getByPlaceholder('如 0.02').fill('0.02');
  await expect(page.locator('.result-final .value').first()).toContainText('±');
});

test('设置页可切换标准', async ({ page }) => {
  await page.goto('/#/settings');
  await expect(page.getByRole('heading', { name: '设置' })).toBeVisible();
  await expect(page.getByText('GB/T 27418-2017').first()).toBeVisible();
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
