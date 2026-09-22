import { test, expect } from '@playwright/test';

/** 公式工作台 Phase B/D/E 验收（plan §8、§10.5、§10.8） */

test('公式页默认只渲染首批卡片，加载更多逐步展开', async ({ page }) => {
  await page.goto('/#/formulas');
  await expect(page.getByRole('heading', { name: '公式工作台' })).toBeVisible();
  const firstBatch = await page.locator('.formula-card').count();
  expect(firstBatch).toBeLessThanOrEqual(24);
  expect(firstBatch).toBeGreaterThan(0);
  const more = page.getByRole('button', { name: /加载更多/ });
  await expect(more).toBeVisible();
  await more.click();
  const secondBatch = await page.locator('.formula-card').count();
  expect(secondBatch).toBeGreaterThan(firstBatch);
  // 搜索时重置到首批
  await page.getByPlaceholder(/搜索公式/).fill('霍尔');
  await expect(page.locator('.formula-card').first()).toBeVisible();
  expect(await page.locator('.formula-card').count()).toBeLessThanOrEqual(24);
});

test('domain + topic 二级过滤', async ({ page }) => {
  await page.goto('/#/formulas');
  await page.getByRole('tab', { name: '力学' }).click();
  await expect(page.getByRole('tab', { name: /全部专题/ })).toBeVisible();
  await page.getByRole('tab', { name: '运动学' }).click();
  await expect(page.getByText(/匹配 \d+ 个公式/)).toBeVisible();
  const titles = await page.locator('.formula-card').allInnerTexts();
  expect(titles.join('\n')).toContain('匀加速');
});

test('参考公式详情不显示数值计算器', async ({ page }) => {
  await page.goto('/#/formulas/gauss-law');
  await expect(page.getByRole('heading', { name: '高斯定律（积分形式）' })).toBeVisible();
  expect(await page.getByText('参考公式', { exact: true }).count()).toBeGreaterThan(0);
  await expect(page.getByRole('button', { name: '计算', exact: true })).toHaveCount(0);
  await expect(page.getByText('适用条件')).toBeVisible();
});

test('可计算公式：计算器读 formula.result 元数据并完成一次计算', async ({ page }) => {
  await page.goto('/#/formulas/ohms-law');
  await expect(page.getByRole('heading', { name: '欧姆定律' })).toBeVisible();
  await page.getByPlaceholder('按 A 输入').fill('0.1');
  await page.getByPlaceholder('按 Ω 输入').fill('220');
  await page.getByRole('button', { name: '计算', exact: true }).click();
  await expect(page.locator('.result-final .value').first()).toContainText('22');
});

test('首页不加载公式库与 ECharts chunk，进入公式页才加载公式 chunk（plan §10.8）', async ({ page }) => {
  const chunkUrls: string[] = [];
  page.on('request', (req) => {
    const url = req.url();
    if (url.endsWith('.js') && url.includes('/assets/')) chunkUrls.push(url.split('/').pop()!);
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '物理实验小助手' })).toBeVisible();
  await page.waitForTimeout(500);
  const homeChunks = [...chunkUrls];
  expect(homeChunks.some((c) => c.startsWith('FormulasPage-'))).toBe(false);
  expect(homeChunks.some((c) => c.startsWith('PhysicsPlot-') || c.includes('echarts'))).toBe(false);

  await page.goto('/#/formulas');
  await expect(page.getByRole('heading', { name: '公式工作台' })).toBeVisible();
  await page.waitForTimeout(500);
  expect(chunkUrls.some((c) => c.startsWith('FormulasPage-'))).toBe(true);
});
