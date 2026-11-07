import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
export default defineConfig({
  base: './', plugins: [react()],
  test: { include: ['tests/**/*.test.ts'] },
  build: { target: 'es2022', sourcemap: true },
});
