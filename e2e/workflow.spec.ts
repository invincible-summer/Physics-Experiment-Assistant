import { test, expect } from '@playwright/test';

test('计算器在选区插入，重用历史并保留角度模式', async ({ page }) => {
  await page.goto('/#/tools/calculator');
  const input = page.getByRole('textbox', { name: '表达式', exact: true });
  await input.fill('12+3');
  await input.evaluate((el: HTMLInputElement) => el.setSelectionRange(0, 2));
  await page.getByRole('button', { name: '7', exact: true }).click();
  await expect(input).toHaveValue('7+3');
  await input.press('Enter');
  await expect(page.getByRole('button', { name: '重新计算' })).toBeVisible();
  await input.fill('99');
  await page.getByRole('button', { name: '重新计算' }).click();
  await expect(input).toHaveValue('7+3');
  await expect(page.locator('.calc-display')).toContainText('10');
});

test('非法不确定度阻止公式计算，修正后可恢复', async ({ page }) => {
  await page.goto('/#/formulas/hall-voltage');
  // 公式页为路由级 lazy：先等计算器输入框挂载
  const firstInput = page.locator('.input-unit input').first();
  await firstInput.waitFor({ state: 'visible' });
  for (const input of await page.locator('.input-unit input').all()) await input.fill('1');
  const uncertainty = page.getByRole('textbox', { name: /的不确定度/ }).first();
  await uncertainty.fill('-0.1');
  await expect(uncertainty).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByRole('button', { name: '计算', exact: true })).toBeDisabled();
  await uncertainty.fill('abc');
  await expect(page.getByRole('button', { name: '计算', exact: true })).toBeDisabled();
  await uncertainty.fill('0.1');
  await expect(page.getByRole('button', { name: '计算', exact: true })).toBeEnabled();
});

test('报告提供完整源码、阅读预览和一致的下载文件', async ({ page }) => {
  await page.goto('/#/experiments/friction/new');
  await page.getByRole('button', { name: '创建项目并进入工作台' }).click();
  await expect(page).toHaveURL(/\/project\//);
  await page.getByRole('button', { name: '导出', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '导出', exact: true });
  const source = dialog.getByRole('textbox', { name: '完整 Markdown 源码' });
  const text = await source.inputValue();
  expect(text).toContain('报告时间');
  await dialog.getByRole('button', { name: '全选源码' }).click();
  expect(await source.evaluate((el: HTMLTextAreaElement) => el.selectionEnd - el.selectionStart)).toBe(text.length);
  await dialog.getByRole('button', { name: '阅读预览' }).click();
  await expect(dialog.getByLabel('报告阅读预览')).toContainText('实验信息');
  await expect(dialog.locator('.katex-error')).toHaveCount(0);
  await dialog.getByRole('tab', { name: '完整报告 LaTeX' }).click();
  await expect(dialog.getByRole('textbox', { name: '完整 LaTeX 源码' })).toContainText('\\end{document}');
  const downloadEvent = page.waitForEvent('download');
  await dialog.getByRole('button', { name: '下载 .tex' }).click();
  const download = await downloadEvent;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  expect(Buffer.concat(chunks).toString()).toBe(await dialog.getByRole('textbox', { name: '完整 LaTeX 源码' }).inputValue());
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: '导出', exact: true })).toBeFocused();
});

test('复制失败不冒充成功，并给出可操作提示', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => { throw new Error('denied'); } } });
    document.execCommand = () => false;
  });
  await page.goto('/#/tools/calculator');
  await page.getByRole('textbox', { name: '表达式', exact: true }).fill('2+3');
  await page.getByRole('button', { name: '复制当前结果' }).click();
  await expect(page.getByRole('status', { name: '操作反馈' })).toContainText('复制失败');
  await expect(page.getByRole('button', { name: '已复制', exact: true })).toHaveCount(0);
});

test('部分不确定度正确传播，反解单位与导出输入可复核', async ({ page }) => {
  await page.goto('/#/formulas/hall-voltage');
  const values = page.locator('.input-unit input');
  await values.nth(0).fill('2.00');
  await values.nth(1).fill('3');
  await values.nth(2).fill('4');
  await page.getByRole('textbox', { name: /的不确定度/ }).first().fill('0.1');
  await page.getByRole('button', { name: '计算', exact: true }).click();
  await expect(page.locator('.result-final')).toContainText('±');
  await expect(page.locator('.rc-body')).toContainText('当前传播未计入其贡献');
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: '下载 .md', exact: true }).click();
  const stream = await (await pending).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  expect(Buffer.concat(chunks).toString()).toContain('| KH | 2.00 | m2/C | 0.1 | 2 | m2/C |');
  await page.getByRole('combobox', { name: '求解目标量' }).selectOption('B');
  await page.locator('.input-unit input').last().fill('24');
  await page.getByRole('button', { name: '计算', exact: true }).click();
  await expect(page.locator('.result-final .unit')).toHaveText('T');
  await expect(page.locator('.result-final .value')).toContainText('4');
});

test('温差以摄氏度输入不附加温标偏移', async ({ page }) => {
  await page.goto('/#/formulas/quasi-steady-lambda');
  const values = page.locator('.input-unit input');
  await values.nth(0).fill('100');
  await values.nth(1).fill('0.02');
  await values.nth(2).fill('10');
  await page.getByRole('combobox', { name: '上下两面温差 Δt单位', exact: true }).selectOption('degC');
  await page.getByRole('button', { name: '计算', exact: true }).click();
  await expect(page.locator('.result-final .value')).toHaveText('0.1');
});

test('公式输入刷新恢复，切换公式保持隔离', async ({ page }) => {
  await page.goto('/#/formulas/hall-voltage');
  await page.getByRole('combobox', { name: '求解目标量' }).selectOption('B');
  await page.locator('.input-unit input').nth(0).fill('2.00');
  await page.getByRole('textbox', { name: /的不确定度/ }).first().fill('0.010');
  await page.reload();
  await expect(page.getByRole('combobox', { name: '求解目标量' })).toHaveValue('B');
  await expect(page.locator('.input-unit input').nth(0)).toHaveValue('2.00');
  await expect(page.getByRole('textbox', { name: /的不确定度/ }).first()).toHaveValue('0.010');
  await expect(page.locator('.result-final')).toHaveCount(0);
  await page.goto('/#/formulas/hall-coefficient');
  await expect(page.locator('.input-unit input').first()).toHaveValue('');
  await page.goto('/#/formulas/hall-voltage');
  await expect(page.locator('.input-unit input').first()).toHaveValue('2.00');
});

test('聚合原始数据恢复，填入不提前修约并提示无效行', async ({ page }) => {
  await page.goto('/#/formulas/mean');
  const cells = page.locator('.agg-panel table input');
  await cells.nth(0).fill('1.2345678901234567');
  await cells.nth(1).fill('bad');
  await page.reload();
  await expect(cells.nth(0)).toHaveValue('1.2345678901234567');
  await expect(cells.nth(1)).toHaveValue('bad');
  await expect(page.locator('.agg-panel')).toContainText('非空但不完整或非法 1 行');
  await page.getByRole('button', { name: '填入输入框', exact: true }).click();
  await expect(page.locator('.input-unit input').first()).toHaveValue('1.2345678901234567');
});

test('损坏公式草稿不阻止重新输入', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('pea.tool-draft.formula.mean.v1', JSON.stringify({ target: 'bad', vars: { S: null }, rows: [1] })));
  await page.goto('/#/formulas/mean');
  await expect(page.locator('.input-unit input').first()).toHaveValue('');
  await page.locator('.input-unit input').first().fill('10');
  await expect(page.locator('.input-unit input').first()).toHaveValue('10');
});

test('项目筛选可恢复，手机项目页保持单列宽度', async ({ page }) => {
  await page.goto('/#/experiments/friction/new');
  await page.getByRole('button', { name: '创建项目并进入工作台' }).click();
  await expect(page).toHaveURL(/\/project\//);
  await page.goto('/#/projects');
  await expect(page.getByRole('link', { name: '继续实验', exact: true })).toBeVisible();
  await page.getByRole('searchbox', { name: '搜索项目' }).fill('不存在的项目xyz');
  await expect(page.getByText('没有匹配的项目', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '显示全部项目', exact: true }).click();
  await expect(page.getByRole('link', { name: '打开', exact: true })).toHaveCount(1);
  await page.getByRole('combobox', { name: '按实验筛选' }).selectOption('friction');
  await expect(page.getByRole('button', { name: '清除筛选', exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: '/tmp/pea-projects-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.locator('.app-main')).toHaveCSS('margin-left', '216px');
  await page.screenshot({ path: '/tmp/pea-projects-desktop.png', fullPage: true });
});
