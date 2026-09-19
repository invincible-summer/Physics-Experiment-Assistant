import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages 仓库子路径部署：默认按仓库名，可用 VITE_BASE 覆盖（本地预览设为 /）
const repoBase = process.env.VITE_BASE ?? '/Physics-Experiment-Assistant/';

export default defineConfig({
  plugins: [react()],
  base: repoBase,
  build: {
    sourcemap: false,
    target: 'es2020',
  },
  test: {
    environment: 'node',
    include: ['src/tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/core/**/*.ts'],
      reporter: ['text', 'lcov'],
    },
  },
} as ReturnType<typeof defineConfig>);
