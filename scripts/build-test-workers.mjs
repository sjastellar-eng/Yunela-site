import { build } from 'vite';
import { resolve } from 'node:path';

// Compile the same production sources once, rather than starting a Vite server in every race-test worker.
// SQLite remains native and external; no services or inventory assertions are mocked.
const exportSource = (service) => [
  ['openDatabase', 'src/database/client.ts'],
  ['SqliteFulfillmentMutationRepository', 'src/application/fulfillment/sqliteDomainRepository.ts'],
  ['FulfillmentApplicationService', `src/application/fulfillment/${service}.ts`],
].map(([name, path]) => `export { ${name} } from ${JSON.stringify(resolve(path))};`).join('\n');
const sources = { 'test-worker-inventory': exportSource('serviceV2'), 'test-worker-shipment': exportSource('serviceV3') };
await build({
  configFile: false,
  publicDir: false,
  logLevel: 'warn',
  plugins: [{
    name: 'production-test-worker-entries',
    resolveId(id) { if (id in sources) return '\0' + id; },
    load(id) { if (id.startsWith('\0test-worker-')) return sources[id.slice(1)]; },
  }],
  build: {
    ssr: true,
    outDir: 'artifacts/test-workers',
    emptyOutDir: true,
    rollupOptions: {
      input: { inventory: 'test-worker-inventory', shipment: 'test-worker-shipment' },
      external: [/^node:/, 'better-sqlite3'],
      output: { entryFileNames: '[name].mjs', chunkFileNames: 'shared-[hash].mjs' },
    },
  },
});
