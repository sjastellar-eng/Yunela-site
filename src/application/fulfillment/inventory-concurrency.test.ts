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
  const teaId = randomUUID();
  const lotId = randomUUID();
  const orderA = randomUUID();
  const orderB = randomUUID();
  const purchaseA = randomUUID();
  const purchaseB = randomUUID();
  const orderItemA = randomUUID();
  const orderItemB = randomUUID();
  const fulfillmentA = randomUUID();
  const fulfillmentB = randomUUID();
  const fulfillmentItemA = randomUUID();
  const fulfillmentItemB = randomUUID();
  const shipping = JSON.stringify({ recipientName: 'F4', addressLine1: '1 Main', city: 'Dnipro', postalCode: '49000', countryCode: 'UA' });

  db.prepare('INSERT INTO customers (id,email,created_at) VALUES (?,?,?)').run(customerId, `${customerId}@test.local`, now);
  db.prepare('INSERT INTO tea_families (id,name) VALUES (?,?)').run(`family-${teaId}`, 'F4 Test Family');
  db.prepare(`INSERT INTO teas (id,slug,name,family_id,sensory_json,discovery_distance,price_amount,price_currency,pack_size_grams,supply_status,provenance_confidence,publishing_state,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(teaId, `tea-${teaId}`, 'F4 Test Tea', `family-${teaId}`, '{}', 50, 100, 'UAH', 10, 'available', 'verified', 'published', now, now);
  db.prepare('INSERT INTO tea_lots (id,tea_id,lot_code,inventory_quantity,supply_status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)').run(lotId, teaId, `LOT-${lotId}`, INVENTORY, 'available', now, now);

  for (const [orderId, purchaseId, orderItemId, fulfillmentId, fulfillmentItemId] of [[orderA, purchaseA, orderItemA, fulfillmentA, fulfillmentItemA], [orderB, purchaseB, orderItemB, fulfillmentB, fulfillmentItemB]]) {
    db.prepare('INSERT INTO orders (id,customer_id,status,currency,subtotal_amount,discount_amount,shipping_amount,total_amount,shipping_snapshot_json,idempotency_key,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run(orderId, customerId, 'confirmed', 'UAH', 100, 0, 0, 100, shipping, randomUUID(), now, now);
    db.prepare('INSERT INTO order_items (id,order_id,sku,tea_id,tea_name_snapshot,quantity,unit_price_amount,unit_price_currency,line_total_amount,recommendation_history_id,discovery_box_snapshot_json) VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(orderItemId, orderId, `F4-TEST-${orderItemId}`, teaId, 'F4 Test Tea', RESERVATION_QUANTITY, 100, 'UAH', RESERVATION_QUANTITY * 100, null, null);
    db.prepare('INSERT INTO purchases (id,order_id,customer_id,amount,currency,confirmed_at) VALUES (?,?,?,?,?,?)').run(purchaseId, orderId, customerId, 100, 'UAH', now);
    db.prepare('INSERT INTO fulfillments (id,order_id,purchase_id,customer_id,status,shipping_snapshot_json,items_snapshot_json,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)').run(fulfillmentId, orderId, purchaseId, customerId, 'PENDING', shipping, '[]', now, now);
    db.prepare('INSERT INTO fulfillment_items (id,fulfillment_id,order_item_id,sku,quantity,product_snapshot_json,allocation_status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)').run(fulfillmentItemId, fulfillmentId, orderItemId, `F4-TEST-${orderItemId}`, RESERVATION_QUANTITY, JSON.stringify({ id: orderItemId, sku: `F4-TEST-${orderItemId}`, teaId, teaName: 'F4 Test Tea', quantity: RESERVATION_QUANTITY, unitPrice: { amount: 100, currency: 'UAH' }, lineTotal: { amount: RESERVATION_QUANTITY * 100, currency: 'UAH' }}), 'PENDING', now, now);
  }

  db.close();
  return { directory, databaseFile, lotId, fulfillmentA, fulfillmentB, fulfillmentItemA, fulfillmentItemB, now };
}

function runWorker(databaseFile: string, operation: 'reservation' | 'consumption' | 'release' | 'rollback', fulfillmentId: string, ready: SharedArrayBuffer, go: SharedArrayBuffer, operationKey: string) {
  return new Promise<boolean>((resolve, reject) => {
    const worker = new Worker(new URL('./inventory-concurrency.worker.mjs', import.meta.url), {
      workerData: { databaseFile, operation, fulfillmentId, operationKey, readyBuffer: ready, goBuffer: go },
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

async function runConcurrentPair(fixture: ReturnType<typeof createFixture>, operation: 'reservation' | 'consumption' | 'release', fulfillmentIds: [string, string]) {
  const ready = new SharedArrayBuffer(4);
  const go = new SharedArrayBuffer(4);
  const readyView = new Int32Array(ready);
  const goView = new Int32Array(go);
  const first = runWorker(fixture.databaseFile, operation, fulfillmentIds[0], ready, go, `${operation}-a-${randomUUID()}`);
  const second = runWorker(fixture.databaseFile, operation, fulfillmentIds[1], ready, go, `${operation}-b-${randomUUID()}`);
  const deadline = Date.now() + 15000;
  while (Atomics.load(readyView, 0) < 2) {
    if (Date.now() > deadline) throw new Error('F4 worker barrier timed out');
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
  Atomics.store(goView, 0, 1);
  Atomics.notify(goView, 0, 2);
  return Promise.all([first, second]);
}

async function runSingleWorker(databaseFile: string, operation: 'reservation' | 'consumption' | 'release' | 'rollback', fulfillmentId: string, operationKey: string) {
  const ready = new SharedArrayBuffer(4);
  const go = new SharedArrayBuffer(4);
  const readyView = new Int32Array(ready);
  const goView = new Int32Array(go);
  const result = runWorker(databaseFile, operation, fulfillmentId, ready, go, operationKey);
  const deadline = Date.now() + 15000;
  while (Atomics.load(readyView, 0) < 1) {
    if (Date.now() > deadline) throw new Error('F4 single worker barrier timed out');
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
  Atomics.store(goView, 0, 1);
  Atomics.notify(goView, 0, 1);
  return result;
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

function prepareReservedState(databaseFile: string, fulfillmentId: string, fulfillmentItemId: string, lotId: string, now: string) {
  const db = openDatabase(databaseFile);
  db.prepare('UPDATE fulfillments SET status=?, updated_at=? WHERE id=?').run('READY', now, fulfillmentId);
  db.prepare('UPDATE fulfillment_items SET allocation_status=?, updated_at=? WHERE id=?').run('ALLOCATED', now, fulfillmentItemId);
  db.prepare('INSERT INTO inventory_allocations (id,fulfillment_item_id,tea_lot_id,quantity,status,allocated_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)').run(randomUUID(), fulfillmentItemId, lotId, RESERVATION_QUANTITY, 'RESERVED', now, now, now);
  db.close();
}

describe('F4 inventory concurrency — independent SQLite connections through production path', () => {
  it('prevents concurrent production READY reservations from overselling the same TeaLot', async () => {
    for (let iteration = 0; iteration < 20; iteration += 1) {
      const fixture = createFixture();
      try {
        const results = await runConcurrentPair(fixture, 'reservation', [fixture.fulfillmentA, fixture.fulfillmentB]);
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
  }, 120000);

  it('proves concurrent production PACKED transitions perform physical consumption only once', async () => {
    for (let iteration = 0; iteration < 20; iteration += 1) {
      const fixture = createFixture();
      prepareReservedState(fixture.databaseFile, fixture.fulfillmentA, fixture.fulfillmentItemA, fixture.lotId, fixture.now);
      const db = openDatabase(fixture.databaseFile);
      db.prepare('UPDATE fulfillments SET status=?, updated_at=? WHERE id=?').run('PACKING', fixture.now, fixture.fulfillmentA);
      db.close();
      try {
        const results = await runConcurrentPair(fixture, 'consumption', [fixture.fulfillmentA, fixture.fulfillmentA]);
        expect(results).toHaveLength(2);
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
  }, 120000);

  it('allows concurrent production release operations without double release or inventory mutation', async () => {
    for (let iteration = 0; iteration < 20; iteration += 1) {
      const fixture = createFixture();
      prepareReservedState(fixture.databaseFile, fixture.fulfillmentA, fixture.fulfillmentItemA, fixture.lotId, fixture.now);
      try {
        const results = await runConcurrentPair(fixture, 'release', [fixture.fulfillmentA, fixture.fulfillmentA]);
        expect(results.filter(Boolean)).toHaveLength(2);
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
  }, 120000);

  it('rolls back the production PACKED transaction after a downstream database failure, then permits an independent reservation after release', async () => {
    const fixture = createFixture();
    try {
      prepareReservedState(fixture.databaseFile, fixture.fulfillmentA, fixture.fulfillmentItemA, fixture.lotId, fixture.now);
      const db = openDatabase(fixture.databaseFile);
      db.prepare('UPDATE fulfillments SET status=?, updated_at=? WHERE id=?').run('PACKING', fixture.now, fixture.fulfillmentA);
      db.exec("CREATE TRIGGER f4_force_packed_failure BEFORE UPDATE OF status ON fulfillments WHEN NEW.status = 'PACKED' BEGIN SELECT RAISE(ABORT, 'F4 forced downstream failure'); END;");
      db.close();

      expect(await runSingleWorker(fixture.databaseFile, 'rollback', fixture.fulfillmentA, `rollback-${randomUUID()}`)).toBe(true);
      const afterRollback = inventoryState(fixture.databaseFile, fixture.lotId);
      expect(afterRollback.physical).toBe(INVENTORY);
      expect(afterRollback.reserved).toBe(RESERVATION_QUANTITY);
      expect(afterRollback.consumed).toBe(0);
      expect(afterRollback.released).toBe(0);

      const cleanupDb = openDatabase(fixture.databaseFile);
      cleanupDb.exec('DROP TRIGGER f4_force_packed_failure');
      cleanupDb.close();
      expect(await runSingleWorker(fixture.databaseFile, 'release', fixture.fulfillmentA, `release-after-rollback-${randomUUID()}`)).toBe(true);
      expect(await runSingleWorker(fixture.databaseFile, 'reservation', fixture.fulfillmentB, `reservation-after-rollback-${randomUUID()}`)).toBe(true);

      const finalState = inventoryState(fixture.databaseFile, fixture.lotId);
      expect(finalState.physical).toBe(INVENTORY);
      expect(finalState.reserved).toBe(RESERVATION_QUANTITY);
      expect(finalState.consumed).toBe(0);
      expect(finalState.released).toBe(RESERVATION_QUANTITY);
    } finally {
      rmSync(fixture.directory, { recursive: true, force: true });
    }
  }, 120000);
});
