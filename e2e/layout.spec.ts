import { test, expect } from '@playwright/test';

/** Phase A 侧栏与字号验收（plan §10.1、§10.2） */

test('侧栏展开约 216px、折叠约 60px，品牌与折叠控件同行', async ({ page }) => {
  await page.goto('/');
  const sidebar = page.getByRole('complementary', { name: '主导航' });

  // 展开宽度 212–220px（目标 216）
  const expandedWidth = await sidebar.evaluate((el) => el.getBoundingClientRect().width);
  expect(expandedWidth).toBeGreaterThanOrEqual(212);
  expect(expandedWidth).toBeLessThanOrEqual(220);

  // 品牌名不溢出；品牌与 toggle 同一行（展开态没有"收起导航"文字按钮行）
  const brand = sidebar.locator('.brand-name');
  expect(await brand.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  const toggle = page.getByRole('button', { name: '收起主导航' });
  const brandBox = await sidebar.locator('.brand').boundingBox();
  const toggleBox = await toggle.boundingBox();
  expect(brandBox && toggleBox).toBeTruthy();
  expect(Math.abs((brandBox!.y + brandBox!.height / 2) - (toggleBox!.y + toggleBox!.height / 2)))
    .toBeLessThan(6);

  // toggle 为低视觉权重工具按钮：无实心主按钮样式、约 28×28
  const toggleSize = await toggle.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { w: r.width, h: r.height, bg: getComputedStyle(el).backgroundColor, border: getComputedStyle(el).borderTopWidth };
  });
  expect(toggleSize.w).toBeLessThanOrEqual(32);
  expect(toggleSize.h).toBeLessThanOrEqual(32);
  expect(toggleSize.border).toBe('0px');

  // 折叠：宽度 56–64（目标 60，含 160ms 宽度过渡），compact label 保留
  await toggle.click();
  await expect
    .poll(() => sidebar.evaluate((el) => el.getBoundingClientRect().width))
    .toBeLessThanOrEqual(64);
  const collapsedWidth = await sidebar.evaluate((el) => el.getBoundingClientRect().width);
  expect(collapsedWidth).toBeGreaterThanOrEqual(56);
  await expect(sidebar.locator('.nav-item-text').filter({ hasText: '实验' })).toBeVisible();
  // 折叠后所有导航项不超出侧栏
  for (const item of await sidebar.locator('button, .nav-item').all()) {
    expect(await item.evaluate((el) => el.getBoundingClientRect().right <= 64)).toBe(true);
  }
  // 刷新持久化折叠状态
  await page.reload();
  await expect(page.getByRole('button', { name: '展开主导航' })).toBeVisible();
  await page.getByRole('button', { name: '展开主导航' }).click();
  await expect(sidebar.getByText('物理实验小助手')).toBeVisible();
});

test('侧栏 footer 是齿轮设置入口，不再有可点击标准徽章', async ({ page }) => {
  await page.goto('/');
  const sidebar = page.getByRole('complementary', { name: '主导航' });
  // footer 无标准徽章按钮（"前往设置切换标准"是旧徽章的 aria-label）
  await expect(sidebar.getByRole('button', { name: /前往设置切换标准/ })).toHaveCount(0);
  // 齿轮按钮进入设置页
  await sidebar.getByRole('button', { name: '设置', exact: true }).click();
  await expect(page).toHaveURL(/#\/settings$/);
  await expect(page.getByRole('heading', { name: '设置' })).toBeVisible();
  // 当前标准信息仍在设置页可见
  await expect(page.getByText('2026 秋物理实验 A(1)').first()).toBeVisible();
});

test('字号档位 90–140% 立即生效、持久化并可恢复 100%', async ({ page }) => {
  await page.goto('/#/settings');
  const root = page.locator('html');
  await expect(root).toHaveAttribute('data-font-scale', '1');

  const before = await page.evaluate(() => getComputedStyle(document.body).fontSize);
  await page.getByRole('tab', { name: '140%' }).click();
  await expect(root).toHaveAttribute('data-font-scale', '1.4');
  const after = await page.evaluate(() => getComputedStyle(document.body).fontSize);
  expect(parseFloat(after)).toBeGreaterThan(parseFloat(before));

  // 持久化 + 侧栏导航不裁切（1280px 桌面 140%）
  await page.reload();
  await expect(root).toHaveAttribute('data-font-scale', '1.4');
  const sidebar = page.getByRole('complementary', { name: '主导航' });
  for (const item of await sidebar.locator('.nav-item').all()) {
    expect(await item.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  }
  // 恢复默认把字号重置为 100%（ConfirmButton：按钮文字变为"再次点击确认"后二次点击）
  await page.getByRole('button', { name: '恢复全部默认设置' }).click();
  await page.getByRole('button', { name: '再次点击确认' }).click();
  await expect(root).toHaveAttribute('data-font-scale', '1');
});

test('390px 移动视口在 100% 与 140% 字号下无 body 横向溢出', async ({ page }) => {
  for (const scale of ['1', '1.4']) {
    await page.goto('/#/settings');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate((s) => localStorage.setItem(
      'pea.settings',
      JSON.stringify({ state: { fontScale: Number(s) }, version: 0 }),
    ), scale);
    await page.goto('/#/formulas');
    await expect(page.getByRole('heading', { name: '公式工作台' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  }
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
