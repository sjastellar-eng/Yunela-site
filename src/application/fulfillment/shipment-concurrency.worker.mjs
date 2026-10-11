import { createServer } from 'vite';
import { cwd } from 'node:process';
import { parentPort, workerData } from 'node:worker_threads';

async function run() {
  const vite = await createServer({ configFile: false, root: cwd(), appType: 'custom', server: { middlewareMode: true, hmr: false } });
  try {
    const [{ openDatabase }, { SqliteFulfillmentMutationRepository }, { FulfillmentApplicationService }] = await Promise.all([
      vite.ssrLoadModule('/src/database/client.ts'),
      vite.ssrLoadModule('/src/application/fulfillment/sqliteDomainRepository.ts'),
      vite.ssrLoadModule('/src/application/fulfillment/serviceV3.ts'),
    ]);
    const db = openDatabase(workerData.databaseFile);
    try {
      const service = new FulfillmentApplicationService(new SqliteFulfillmentMutationRepository(db));
      let result;
      if (workerData.mode === 'create') {
        const shipment = service.createShipment(workerData.fulfillmentId, 'OPERATOR:concurrency', workerData.operationKey);
        result = { shipmentId: shipment.id, status: shipment.status };
      } else if (workerData.mode === 'transition') {
        const shipment = service.transitionShipment(workerData.fulfillmentId, workerData.to, 'OPERATOR:concurrency', workerData.operationKey);
        result = { shipmentId: shipment.id, status: shipment.status };
      } else if (workerData.mode === 'tracking') {
        const shipment = service.updateShipmentTracking(workerData.fulfillmentId, 'OPERATOR:concurrency', workerData.operationKey, workerData.input);
        result = { shipmentId: shipment.id, status: shipment.status, carrier: shipment.carrier, trackingNumber: shipment.trackingNumber, trackingUrl: shipment.trackingUrl };
      } else {
        throw new Error('Unsupported concurrency worker mode');
      }
      parentPort.postMessage({ ok: true, ...result });
    } finally {
      db.close();
    }
  } finally {
    await vite.close();
  }
}

const ready = new Int32Array(workerData.readyBuffer);
const go = new Int32Array(workerData.goBuffer);
Atomics.add(ready, 0, 1);
Atomics.notify(ready, 0);
while (Atomics.load(go, 0) === 0) Atomics.wait(go, 0);

run().catch((error) => parentPort.postMessage({ ok: false, error: error instanceof Error ? error.stack ?? error.message : String(error) }));
