import { test, expect } from '@playwright/test';

test('边栏收起保留标签、偏好与完整品牌', async ({ page }) => {
  await page.goto('/');
  const sidebar = page.getByRole('complementary', { name: '主导航' });
  const brand = sidebar.locator('.brand-name');
  expect(await brand.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.getByRole('button', { name: '收起主导航' }).click();
  await expect(sidebar.locator('.nav-item-text').filter({ hasText: '实验' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: '展开主导航' })).toBeVisible();
  for (const item of await sidebar.locator('button, .nav-item').all()) {
    expect(await item.evaluate(el => el.getBoundingClientRect().right <= 76)).toBe(true);
  }
  await page.getByRole('button', { name: '展开主导航' }).click();
  await expect(sidebar.getByText('物理实验小助手')).toBeVisible();
});

test('窄屏公式保留 MathML，复制反馈可以关闭', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-write', 'clipboard-read']);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/formulas');
  await expect(page.locator('.katex').first()).toBeVisible();
  expect(await page.locator('math').count()).toBeGreaterThan(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const card = page.locator('.panel').filter({ has: page.getByRole('button', { name: '复制', exact: true }) }).first();
  await card.getByRole('button', { name: '复制', exact: true }).click();
  await page.getByRole('menuitem', { name: '复制 LaTeX', exact: true }).click();
  const feedback = page.getByRole('status', { name: '操作反馈' });
  await expect(feedback).toContainText('已复制');
  await feedback.getByRole('button', { name: '关闭' }).click();
  await expect(feedback.locator('.toast')).toHaveCount(0);
});
