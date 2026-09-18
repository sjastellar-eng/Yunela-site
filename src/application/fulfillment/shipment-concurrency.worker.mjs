import { parentPort, workerData } from 'node:worker_threads';
import { createServer } from 'vite';

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
  const [{ openDatabase }, { applyMigrations }, { SqliteFulfillmentMutationRepository }, { FulfillmentApplicationService }] =
    await Promise.all([
      vite.ssrLoadModule('/src/database/client.ts'),
      vite.ssrLoadModule('/src/database/migrate.ts'),
      vite.ssrLoadModule('/src/application/fulfillment/sqliteDomainRepository.ts'),
      vite.ssrLoadModule('/src/application/fulfillment/serviceV3.ts'),
    ]);
  const db = openDatabase(workerData.databaseFile);
  applyMigrations(db);
  const service = new FulfillmentApplicationService(new SqliteFulfillmentMutationRepository(db));
  const ready = new Int32Array(workerData.readyBuffer);
  const go = new Int32Array(workerData.goBuffer);
  Atomics.add(ready, 0, 1);
  Atomics.notify(ready, 0);
  while (Atomics.load(go, 0) === 0) Atomics.wait(go, 0, 0);
  const shipment = service.createShipment(workerData.fulfillmentId, 'OPERATOR:concurrency', workerData.operationKey);
  parentPort.postMessage({ ok: true, shipmentId: shipment.id });
  db.close();
} catch (error) {
  parentPort?.postMessage({ ok: false, error: error instanceof Error ? error.message : String(error) });
} finally {
  await vite.close();
}
