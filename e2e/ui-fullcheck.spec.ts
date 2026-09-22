import { test, expect, Page } from '@playwright/test';

/**
 * 全站 UI 完整检查（每轮实屏验收运行）：
 * - 覆盖全部路由 × 视图变体（桌面展开 / 折叠 / 140% 字号 / 深色 / 390px 移动）；
 * - 断言：页面无整体横向溢出；所有可见按钮文字不被裁切（scrollWidth ≤ clientWidth + 1）；
 * - 导航项、标签页不被裁切；
 * - 同时输出截图到 test-results/ui-check/ 供人工复核。
 */

const PAGES: ReadonlyArray<{ name: string; hash: string }> = [
  { name: 'home', hash: '/#/' },
  { name: 'experiments', hash: '/#/experiments' },
  { name: 'new-project', hash: '/#/experiments/friction/new' },
  { name: 'formulas', hash: '/#/formulas' },
  { name: 'formula-detail', hash: '/#/formulas/ohms-law' },
  { name: 'formula-reference', hash: '/#/formulas/gauss-law' },
  { name: 'tools', hash: '/#/tools' },
  { name: 'statistics', hash: '/#/tools/statistics' },
  { name: 'regression', hash: '/#/tools/regression' },
  { name: 'uncertainty', hash: '/#/tools/uncertainty' },
  { name: 'weighted-mean', hash: '/#/tools/weighted-mean' },
  { name: 'calculator', hash: '/#/tools/calculator' },
  { name: 'units', hash: '/#/tools/units' },
  { name: 'plotter', hash: '/#/tools/plotter' },
  { name: 'projects', hash: '/#/projects' },
  { name: 'settings', hash: '/#/settings' },
  { name: 'sources', hash: '/#/sources' },
];

type Variant = {
  name: string;
  viewport: { width: number; height: number };
  setup?: (page: Page) => Promise<void>;
};

async function clearPrefs(page: Page) {
  await page.goto('/#/');
  await page.evaluate(() => localStorage.clear());
}

async function setPref(page: Page, patch: Record<string, unknown>) {
  await page.evaluate((p) => {
    const raw = localStorage.getItem('pea.settings');
    let state: Record<string, unknown> = {};
    try { state = (JSON.parse(raw ?? '{}').state) ?? {}; } catch { state = {}; }
    localStorage.setItem('pea.settings', JSON.stringify({ state: { ...state, ...p }, version: 0 }));
  }, patch);
}

const VARIANTS: Variant[] = [
  {
    name: 'desktop',
    viewport: { width: 1280, height: 800 },
    setup: async (page) => { await clearPrefs(page); },
  },
  {
    name: 'collapsed',
    viewport: { width: 1280, height: 800 },
    setup: async (page) => { await clearPrefs(page); await setPref(page, { sidebarCollapsed: true }); },
  },
  {
    name: 'font140',
    viewport: { width: 1280, height: 800 },
    setup: async (page) => { await clearPrefs(page); await setPref(page, { fontScale: 1.4 }); },
  },
  {
    name: 'dark',
    viewport: { width: 1280, height: 800 },
    setup: async (page) => { await clearPrefs(page); await setPref(page, { theme: 'dark' }); },
  },
  {
    name: 'mobile390',
    viewport: { width: 390, height: 844 },
    setup: async (page) => { await clearPrefs(page); },
  },
];

/** 单页断言：无横向溢出 + 可见按钮/标签无文字裁切 */
async function assertNoOverflow(page: Page, label: string) {
  // body 不出现整体横向滚动（表格/公式内部滚动除外）
  const docOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(docOverflow, `${label}: 页面整体横向溢出 ${docOverflow}px`).toBeLessThanOrEqual(1);

  // 所有可见按钮：文字不被裁切（允许 1px 亚像素）
  const clipped = await page.evaluate(() => {
    const bad: string[] = [];
    const check = (el: Element, kind: string) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none') return;
      // 横向内容超出可见宽度且不允许换行 → 裁切
      if (el.scrollWidth > el.clientWidth + 1 && cs.whiteSpace === 'nowrap') {
        bad.push(`${kind} "${(el.textContent ?? '').trim().slice(0, 24)}" sw=${el.scrollWidth} cw=${el.clientWidth}`);
      }
    };
    document.querySelectorAll('button, .btn, .nav-item, .m-item, .tab, [role="tab"]').forEach((el) => check(el, el.tagName.toLowerCase()));
    return bad;
  });
  expect(clipped, `${label}: 文字被裁切的控件 → ${clipped.join(' | ')}`).toEqual([]);

  // 侧栏导航与品牌不溢出（桌面侧栏存在时）。
  // 品牌名/副标题按 plan §3.1 设计为单行截断（侧栏定宽而字号可缩放，140% 时
  // 数学上无法完整容纳），故不参与严格断言；导航项在大字号下必须完整可读（§10.2.5）。
  const sidebar = page.locator('.app-sidebar');
  if (await sidebar.count() > 0) {
    const sidebarOverflow = await sidebar.evaluate((el) => {
      const bad: string[] = [];
      el.querySelectorAll('.nav-item').forEach((n) => {
        if (n.scrollWidth > n.clientWidth + 1) bad.push((n.textContent ?? '').trim().slice(0, 16));
      });
      return bad;
    });
    expect(sidebarOverflow, `${label}: 侧栏文字溢出 → ${sidebarOverflow.join(' | ')}`).toEqual([]);
  }
}

test.describe('全站 UI 完整检查', () => {
  for (const variant of VARIANTS) {
    test(`视图 ${variant.name}`, async ({ page }) => {
      await page.setViewportSize(variant.viewport);
      if (variant.setup) await variant.setup(page);
      for (const p of PAGES) {
        await page.goto(p.hash.startsWith('/#') ? p.hash : `/#${p.hash}`);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(150);
        await assertNoOverflow(page, `${variant.name}/${p.name}`);
        await page.screenshot({
          path: `test-results/ui-check/${variant.name}-${p.name}.png`,
          fullPage: false,
        });
      }
    });
  }
});
