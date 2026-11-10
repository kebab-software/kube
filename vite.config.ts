import { defineConfig } from 'vitest/config';
import tailwind from '@tailwindcss/vite';
import { cloudflare } from '@cloudflare/vite-plugin';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
export default defineConfig(({ mode }) => ({
  server: { proxy: { '/catalog': 'http://127.0.0.1:4173' } },
  base: './', plugins: [react(), tailwind(), ...(mode === 'cloudflare' ? [cloudflare()] : [])],
  define: { __APP_VERSION__: JSON.stringify(JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version) },
  test: { include: ['tests/**/*.test.ts'] },
  build: { target: 'es2022', rollupOptions: { output: { inlineDynamicImports: true } }, sourcemap: true },
}));
