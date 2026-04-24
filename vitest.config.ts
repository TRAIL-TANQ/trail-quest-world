import path from 'node:path';
import { defineConfig } from 'vitest/config';

// vite.config.ts は `root: "client"` を指定しているためビルド時はそれで良いが、
// テストは repo ルートから実行したいので、vitest 用の独立設定を用意する。
export default defineConfig({
  test: {
    environment: 'node',
    include: ['client/src/**/*.test.ts'],
    globals: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'client', 'src'),
      '@shared': path.resolve(import.meta.dirname, 'shared'),
    },
  },
});
