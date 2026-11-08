import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
export default defineConfig({
  base: './', plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify(JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version) },
  test: { include: ['tests/**/*.test.ts'] },
  build: { target: 'es2022', sourcemap: true },
});
