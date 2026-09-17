import { createServer } from 'vite';
import { parentPort, workerData } from 'node:worker_threads';

async function loadProduction() {
  const vite = await createServer({
    configFile: false,
    root: process.cwd(),
    appType: 'custom',
    server: { middlewareMode: true },
  });
  try {
    const [{ openDatabase }, { SqliteFulfillmentMutationRepository }, { FulfillmentApplicationService }] = await Promise.all([
      vite.ssrLoadModule('/src/database/client.ts'),
      vite.ssrLoadModule('/src/application/fulfillment/sqliteDomainRepository.ts'),
      vite.ssrLoadModule('/src/application/fulfillment/serviceV2.ts'),
    ]);
    return { vite, openDatabase, SqliteFulfillmentMutationRepository, FulfillmentApplicationService };
  } catch (error) {
    await vite.close();
    throw error;
  }
}

async function run() {
  const { vite, openDatabase, SqliteFulfillmentMutationRepository, FulfillmentApplicationService } = await loadProduction();
  const db = openDatabase(workerData.databaseFile);
  try {
    const repo = new SqliteFulfillmentMutationRepository(db);
    const service = new FulfillmentApplicationService(repo);
    if (workerData.operation === 'reservation') {
      service.allocateInventory(workerData.fulfillmentId, workerData.operationKey);
      return true;
    }
    if (workerData.operation === 'consumption') {
      service.consumeInventory(workerData.fulfillmentId, workerData.operationKey);
      return true;
    }
    if (workerData.operation === 'release') {
      service.releaseInventory(workerData.fulfillmentId, workerData.operationKey);
      return true;
    }
    if (workerData.operation === 'rollback') {
      try {
        service.consumeInventory(workerData.fulfillmentId, workerData.operationKey);
        return false;
      } catch (error) {
        return true;
      }
    }
    throw new Error(`Unknown F4 operation: ${workerData.operation}`);
  } finally {
    db.close();
    await vite.close();
  }
}

const ready = new Int32Array(workerData.readyBuffer);
const go = new Int32Array(workerData.goBuffer);
Atomics.add(ready, 0, 1);
Atomics.notify(ready, 0);
while (Atomics.load(go, 0) === 0) Atomics.wait(go, 0, 0);

run().then(
  (result) => parentPort.postMessage({ ok: true, result }),
  (error) => parentPort.postMessage({ ok: false, error: error instanceof Error ? error.stack ?? error.message : String(error) }),
);
