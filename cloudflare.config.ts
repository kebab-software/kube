import { defineConfig } from 'cf/config';

export default defineConfig({
  worker: {
    name: 'kube-music',
    entrypoint: './cloudflare/worker.ts',
    compatibilityDate: '2026-11-10',
    workersDev: true,
    assets: { runWorkerFirst: ['/catalog/*', '/health'] },
    observability: { enabled: true, traces: { enabled: true } },
  },
});
