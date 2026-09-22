import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('function presets, range errors, focus mode and persistent draft', async ({ page }, testInfo) => {
  await page.goto('/#/tools/plotter');
  await page.getByRole('button', { name: '函数曲线', exact: true }).click();
  await page.getByRole('button', { name: '正弦函数', exact: true }).click();
  await expect(page.getByLabel('表达式 y=f(x)')).toHaveValue('sin(x)');
  await expect(page.getByRole('button', { name: '恢复视图' })).toBeVisible();
  await page.getByRole('button', { name: '图名与坐标', exact: true }).click();
  await page.getByLabel('横轴起点', { exact: true }).fill('10');
  await page.getByLabel('横轴终点', { exact: true }).fill('1');
  await expect(page.getByText('坐标起点必须小于终点')).toBeVisible();
  await expect(page.getByRole('button', { name: '导出 PNG' })).toHaveCount(0);
  await page.getByLabel('横轴起点', { exact: true }).fill('0');
  await page.getByLabel('横轴终点', { exact: true }).fill('7');
  await page.getByRole('button', { name: '专注看图' }).click();
  await expect(page.getByLabel('表达式 y=f(x)')).toBeHidden();
  await expect(page.getByRole('button', { name: '导出 PNG' })).toBeVisible();
  await page.getByRole('button', { name: '返回编辑' }).click();
  await page.getByRole('button', { name: '函数曲线', exact: true }).click();
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.screenshot({ path: testInfo.outputPath('plot-desktop.png'), fullPage: true });
  await page.reload();
  await page.getByRole('button', { name: '函数曲线', exact: true }).click();
  await expect(page.getByLabel('表达式 y=f(x)')).toHaveValue('sin(x)');
});

test('dark-theme exports are genuine PNG and printable SVG', async ({ page }) => {
  await page.goto('/#/tools/plotter');
  await page.getByRole('button', { name: /当前主题/ }).click();
  await page.getByRole('button', { name: /当前主题/ }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: '函数曲线', exact: true }).click();
  await page.getByRole('button', { name: '二次函数', exact: true }).click();
  const pngEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出 PNG' }).click();
  const png = await pngEvent;
  expect((await readFile((await png.path())!)).subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  const svgEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出 SVG' }).click();
  const svg = await svgEvent;
  const text = await readFile((await svg.path())!, 'utf8');
  expect(text).toContain('<svg');
  expect(text).toContain('#25313d');
  expect(text).toContain('#ffffff');
  expect(text).toContain('有效点');
});

test('mobile plot and tool search stay inside viewport', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/tools');
  await page.getByPlaceholder(/搜索工具或任务/).fill('画图');
  await expect(page.locator('.quick-card')).toHaveCount(1);
  await page.locator('.quick-card').click();
  await page.getByRole('button', { name: '函数曲线', exact: true }).click();
  await page.getByRole('button', { name: '二次函数', exact: true }).click();
  await page.getByRole('button', { name: '专注看图' }).click();
  await expect(page.getByRole('button', { name: '导出 SVG' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('plot-mobile.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('home defers chart code until a plotting route is opened', async ({ page }) => {
  const chartRequests: string[] = [];
  page.on('request', request => { if (/\/PhysicsPlot-[^/]+\.js/.test(request.url())) chartRequests.push(request.url()); });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '物理实验小助手' })).toBeVisible();
  expect(chartRequests).toHaveLength(0);
  await page.goto('/#/tools/plotter');
  await expect(page.getByRole('heading', { name: '绘图工作台' })).toBeVisible();
  expect(chartRequests.length).toBeGreaterThan(0);
});
