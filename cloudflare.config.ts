import { defineConfig, bindings } from 'cf/config';

export default defineConfig({
  worker: {
    name: 'kube-music',
    entrypoint: './cloudflare/worker.ts',
    compatibilityDate: '2026-11-10',
    workersDev: true,
    domains: ['kube.jamesd.uk'],
    env: { DB: bindings.d1({ id: '3aa91c00-90ee-4198-8636-081fe207ba70', name: 'kube-accounts' }) },
    assets: { runWorkerFirst: ['/catalog/*', '/api/*', '/health'] },
    observability: { enabled: true, traces: { enabled: true } },
  },
});
