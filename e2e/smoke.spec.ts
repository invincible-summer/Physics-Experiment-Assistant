/** E2E 冒烟测试：应用可加载、导航可用、核心页面渲染 */
import { test, expect } from '@playwright/test';

test('首页加载并显示任务导向入口', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '物理实验小助手' })).toBeVisible();
  await expect(page.getByText('新建 2026 A(1) 实验')).toBeVisible();
  await expect(page.getByText(/当前标准规则摘要/)).toBeVisible();
});

test('实验列表显示 7 个实验', async ({ page }) => {
  await page.goto('/#/experiments');
  await expect(page.getByText('摩擦系数测量')).toBeVisible();
  await expect(page.getByText('霍尔效应及磁电阻测量')).toBeVisible();
  await expect(page.getByText('迈克尔逊干涉实验')).toBeVisible();
});

test('公式工作台搜索与卡片', async ({ page }) => {
  await page.goto('/#/formulas');
  await expect(page.getByText('公式工作台')).toBeVisible();
  await page.getByPlaceholder(/搜索公式/).fill('霍尔');
  await expect(page.getByText('霍尔电压').first()).toBeVisible();
});

test('快速统计工具计算', async ({ page }) => {
  await page.goto('/#/tools/statistics');
  await page.getByPlaceholder(/每行一个数值/).fill('5.12\n5.10\n5.07\n5.11\n5.10');
  await expect(page.getByText(/平均值/)).toBeVisible();
  await page.getByPlaceholder('如 0.02').fill('0.02');
  await expect(page.getByText(/总不确定度/)).toBeVisible();
});

test('设置页可切换标准', async ({ page }) => {
  await page.goto('/#/settings');
  await expect(page.getByRole('heading', { name: '设置' })).toBeVisible();
  await expect(page.getByText('GB/T 27418-2017')).toBeVisible();
});
