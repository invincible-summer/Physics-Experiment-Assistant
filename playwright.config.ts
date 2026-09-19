import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60000,
  retries: 0,
  use: {
    // 与 vite.config.ts 的 base 保持一致（GitHub Pages 子路径）
    baseURL: process.env.VITE_BASE ?? 'http://127.0.0.1:4173/Physics-Experiment-Assistant/',
    viewport: { width: 1280, height: 800 },
  },
  webServer: {
    command: 'npm run preview -- --port 4173 --strictPort',
    port: 4173,
    reuseExistingServer: true,
    timeout: 60000,
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
});
