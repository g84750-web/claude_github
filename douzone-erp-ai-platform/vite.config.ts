import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  // GitHub Pages 프로젝트 페이지는 /<repo>/ 하위에 게시된다.
  // 로컬 dev·preview 는 값이 없으므로 루트('/')를 그대로 쓴다.
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
  build: {
    // 외부 CDN 금지 — 모든 자산을 번들에 인라인/동봉
    assetsInlineLimit: 8192,
    sourcemap: false,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
