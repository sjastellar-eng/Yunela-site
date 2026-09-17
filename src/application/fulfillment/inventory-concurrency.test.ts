import { describe, expect, it } from 'vitest';
import { Worker } from 'node:worker_threads';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { openDatabase } from '../../database/client';
import { applyMigrations } from '../../database/migrate';

const INVENTORY = 5;
const RESERVATION_QUANTITY = 4;

function createFixture() {
  const directory = mkdtempSync(join(tmpdir(), 'yunela-f4-'));
  const databaseFile = join(directory, 'inventory.sqlite');
  const db = openDatabase(databaseFile);
  applyMigrations(db);
  const now = new Date().toISOString();
  const customerId = randomUUID();
  const orderId = randomUUID();
  const purchaseId = randomUUID();
  const teaId = randomUUID();
  const lotId = randomUUID();
  const orderItemId = randomUUID();
  const fulfillmentId = randomUUID();
  const fulfillmentItemA = randomUUID();
  const fulfillmentItemB = randomUUID();
  const shipping = JSON.stringify({ recipientName: 'F4', addressLine1: '1 Main', city: 'Dnipro', postalCode: '49000', countryCode: 'UA' });

  db.prepare('INSERT INTO customers (id,email,created_at) VALUES (?,?,?)').run(customerId, `${customerId}@test.local`, now);
  db.prepare('INSERT INTO tea_families (id,name) VALUES (?,?)').run(`family-${teaId}`, 'F4 Test Family');
  db.prepare(`INSERT INTO teas (id,slug,name,family_id,sensory_json,discovery_distance,price_amount,price_currency,pack_size_grams,supply_status,provenance_confidence,publishing_state,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(teaId, `tea-${teaId}`, 'F4 Test Tea', `family-${teaId}`, '{}', 50, 100, 'UAH', 10, 'available', 'verified', 'published', now, now);
  db.prepare('INSERT INTO tea_lots (id,tea_id,lot_code,inventory_quantity,supply_status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)').run(lotId, teaId, `LOT-${lotId}`, INVENTORY, 'available', now, now);
  db.prepare('INSERT INTO orders (id,customer_id,status,currency,subtotal_amount,discount_amount,shipping_amount,total_amount,shipping_snapshot_json,idempotency_key,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run(orderId, customerId, 'confirmed', 'UAH', 100, 0, 0, 100, shipping, randomUUID(), now, now);
  db.prepare('INSERT INTO order_items (id,order_id,sku,tea_id,tea_name_snapshot,quantity,unit_price_amount,unit_price_currency,line_total_amount,recommendation_history_id,discovery_box_snapshot_json) VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(orderItemId, orderId, 'F4-TEST', teaId, 'F4 Test Tea', RESERVATION_QUANTITY, 100, 'UAH', RESERVATION_QUANTITY * 100, null, null);
  db.prepare('INSERT INTO purchases (id,order_id,customer_id,amount,currency,confirmed_at) VALUES (?,?,?,?,?,?)').run(purchaseId, orderId, customerId, 100, 'UAH', now);
  db.prepare('INSERT INTO fulfillments (id,order_id,purchase_id,customer_id,status,shipping_snapshot_json,items_snapshot_json,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)').run(fulfillmentId, orderId, purchaseId, customerId, 'READY', shipping, '[]', now, now);
  for (const fulfillmentItemId of [fulfillmentItemA, fulfillmentItemB]) {
    db.prepare('INSERT INTO fulfillment_items (id,fulfillment_id,order_item_id,sku,quantity,product_snapshot_json,allocation_status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)').run(fulfillmentItemId, fulfillmentId, orderItemId, 'F4-TEST', RESERVATION_QUANTITY, '{}', 'ALLOCATED', now, now);
  }
  db.close();
  return { directory, databaseFile, lotId, fulfillmentItemA, fulfillmentItemB, now };
}

function runWorker(databaseFile: string, operation: 'reservation' | 'consumption' | 'release' | 'rollback', teaLotId: string, fulfillmentItemId: string, allocationId: string, now: string, ready: SharedArrayBuffer, go: SharedArrayBuffer) {
  return new Promise<boolean>((resolve, reject) => {
    const worker = new Worker(new URL('./inventory-concurrency.worker.mjs', import.meta.url), {
      workerData: { databaseFile, operation, teaLotId, fulfillmentItemId, allocationId, quantity: RESERVATION_QUANTITY, now, readyBuffer: ready, goBuffer: go },
    });
    worker.once('message', (message: { ok: boolean; result?: boolean; error?: string }) => {
      if (!message.ok) reject(new Error(message.error));
      else resolve(Boolean(message.result));
    });
    worker.once('error', reject);
    worker.once('exit', (code) => {
      if (code !== 0) reject(new Error(`worker exited with code ${code}`));
    });
  });
}

async function runConcurrentPair(fixture: ReturnType<typeof createFixture>, operation: 'reservation' | 'consumption' | 'release', allocationIds: [string, string], fulfillmentItems: [string, string]) {
  const ready = new SharedArrayBuffer(4);
  const go = new SharedArrayBuffer(4);
  const readyView = new Int32Array(ready);
  const goView = new Int32Array(go);
  const first = runWorker(fixture.databaseFile, operation, fixture.lotId, fulfillmentItems[0], allocationIds[0], fixture.now, ready, go);
  const second = runWorker(fixture.databaseFile, operation, fixture.lotId, fulfillmentItems[1], allocationIds[1], fixture.now, ready, go);
  const deadline = Date.now() + 5000;
  while (Atomics.load(readyView, 0) < 2) {
    if (Date.now() > deadline) throw new Error('F4 worker barrier timed out');
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
  Atomics.store(goView, 0, 1);
  Atomics.notify(goView, 0, 2);
  return Promise.all([first, second]);
}

function inventoryState(databaseFile: string, lotId: string) {
  const db = openDatabase(databaseFile);
  const lot = db.prepare('SELECT inventory_quantity AS quantity FROM tea_lots WHERE id=?').get(lotId) as { quantity: number };
  const allocations = db.prepare('SELECT status, COALESCE(SUM(quantity),0) AS quantity FROM inventory_allocations WHERE tea_lot_id=? GROUP BY status').all(lotId) as Array<{ status: string; quantity: number }>;
  db.close();
  return {
    physical: Number(lot.quantity),
    reserved: Number(allocations.find((x) => x.status === 'RESERVED')?.quantity ?? 0),
    consumed: Number(allocations.find((x) => x.status === 'CONSUMED')?.quantity ?? 0),
    released: Number(allocations.find((x) => x.status === 'RELEASED')?.quantity ?? 0),
  };
}

describe('F4 inventory concurrency — independent SQLite connections', () => {
  it('prevents concurrent READY reservations from overselling the same TeaLot', async () => {
    for (let iteration = 0; iteration < 20; iteration += 1) {
      const fixture = createFixture();
      try {
        const results = await runConcurrentPair(fixture, 'reservation', [randomUUID(), randomUUID()], [fixture.fulfillmentItemA, fixture.fulfillmentItemB]);
        expect(results.filter(Boolean)).toHaveLength(1);
        const state = inventoryState(fixture.databaseFile, fixture.lotId);
        expect(state.physical).toBe(INVENTORY);
        expect(state.reserved).toBe(RESERVATION_QUANTITY);
        expect(state.consumed).toBe(0);
        expect(state.released).toBe(0);
        expect(state.physical).toBeGreaterThanOrEqual(0);
        expect(state.physical - state.reserved).toBe(INVENTORY - RESERVATION_QUANTITY);
      } finally {
        rmSync(fixture.directory, { recursive: true, force: true });
      }
    }
  });

  it('permits exactly one concurrent RESERVED -> CONSUMED transition', async () => {
    for (let iteration = 0; iteration < 20; iteration += 1) {
      const fixture = createFixture();
      const allocationId = randomUUID();
      const db = openDatabase(fixture.databaseFile);
      db.prepare('INSERT INTO inventory_allocations (id,fulfillment_item_id,tea_lot_id,quantity,status,allocated_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)').run(allocationId, fixture.fulfillmentItemA, fixture.lotId, RESERVATION_QUANTITY, 'RESERVED', fixture.now, fixture.now, fixture.now);
      db.close();
      try {
        const results = await runConcurrentPair(fixture, 'consumption', [allocationId, allocationId], [fixture.fulfillmentItemA, fixture.fulfillmentItemA]);
        expect(results.filter(Boolean)).toHaveLength(1);
        const state = inventoryState(fixture.databaseFile, fixture.lotId);
        expect(state.physical).toBe(INVENTORY - RESERVATION_QUANTITY);
        expect(state.reserved).toBe(0);
        expect(state.consumed).toBe(RESERVATION_QUANTITY);
        expect(state.released).toBe(0);
        expect(state.physical).toBeGreaterThanOrEqual(0);
      } finally {
        rmSync(fixture.directory, { recursive: true, force: true });
      }
    }
  });

  it('permits exactly one concurrent RELEASE and never changes physical inventory', async () => {
    for (let iteration = 0; iteration < 20; iteration += 1) {
      const fixture = createFixture();
      const allocationId = randomUUID();
      const db = openDatabase(fixture.databaseFile);
      db.prepare('INSERT INTO inventory_allocations (id,fulfillment_item_id,tea_lot_id,quantity,status,allocated_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)').run(allocationId, fixture.fulfillmentItemA, fixture.lotId, RESERVATION_QUANTITY, 'RESERVED', fixture.now, fixture.now, fixture.now);
      db.close();
      try {
        const results = await runConcurrentPair(fixture, 'release', [allocationId, allocationId], [fixture.fulfillmentItemA, fixture.fulfillmentItemA]);
        expect(results.filter(Boolean)).toHaveLength(1);
        const state = inventoryState(fixture.databaseFile, fixture.lotId);
        expect(state.physical).toBe(INVENTORY);
        expect(state.reserved).toBe(0);
        expect(state.consumed).toBe(0);
        expect(state.released).toBe(RESERVATION_QUANTITY);
        expect(state.physical).toBeGreaterThanOrEqual(0);
      } finally {
        rmSync(fixture.directory, { recursive: true, force: true });
      }
    }
  });

  it('rolls back an aborted reservation completely, then allows another independent connection to reserve', async () => {
    const fixture = createFixture();
    try {
      const ready = new SharedArrayBuffer(4);
      const go = new SharedArrayBuffer(4);
      const rolledBack = runWorker(fixture.databaseFile, 'rollback', fixture.lotId, fixture.fulfillmentItemA, randomUUID(), fixture.now, ready, go);
      const readyView = new Int32Array(ready);
      const goView = new Int32Array(go);
      const deadline = Date.now() + 5000;
      while (Atomics.load(readyView, 0) < 1) {
        if (Date.now() > deadline) throw new Error('F4 rollback worker barrier timed out');
        await new Promise((resolve) => setTimeout(resolve, 1));
      }
      Atomics.store(goView, 0, 1);
      Atomics.notify(goView, 0, 1);
      expect(await rolledBack).toBe(true);
      const afterRollback = inventoryState(fixture.databaseFile, fixture.lotId);
      expect(afterRollback.physical).toBe(INVENTORY);
      expect(afterRollback.reserved).toBe(0);
      expect(afterRollback.consumed).toBe(0);
      expect(afterRollback.released).toBe(0);

      const ready2 = new SharedArrayBuffer(4);
      const go2 = new SharedArrayBuffer(4);
      const reservation = runWorker(fixture.databaseFile, 'reservation', fixture.lotId, fixture.fulfillmentItemA, randomUUID(), fixture.now, ready2, go2);
      const readyView2 = new Int32Array(ready2);
      const goView2 = new Int32Array(go2);
      const deadline2 = Date.now() + 5000;
      while (Atomics.load(readyView2, 0) < 1) {
        if (Date.now() > deadline2) throw new Error('F4 follow-up worker barrier timed out');
        await new Promise((resolve) => setTimeout(resolve, 1));
      }
      Atomics.store(goView2, 0, 1);
      Atomics.notify(goView2, 0, 1);
      expect(await reservation).toBe(true);
      const finalState = inventoryState(fixture.databaseFile, fixture.lotId);
      expect(finalState.physical).toBe(INVENTORY);
      expect(finalState.reserved).toBe(RESERVATION_QUANTITY);
      expect(finalState.physical).toBeGreaterThanOrEqual(0);
    } finally {
      rmSync(fixture.directory, { recursive: true, force: true });
    }
  });
});
