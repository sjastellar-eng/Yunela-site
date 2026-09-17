import Database from 'better-sqlite3';
import { parentPort, workerData } from 'node:worker_threads';

const db = new Database(workerData.databaseFile, { timeout: 5000 });
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

const ready = new Int32Array(workerData.readyBuffer);
const go = new Int32Array(workerData.goBuffer);
Atomics.add(ready, 0, 1);
Atomics.notify(ready, 0);
while (Atomics.load(go, 0) === 0) Atomics.wait(go, 0, 0);

function reservation() {
  const tx = db.transaction(() => {
    const row = db.prepare(`
      SELECT t.inventory_quantity - COALESCE((
        SELECT SUM(a.quantity)
        FROM inventory_allocations a
        WHERE a.tea_lot_id = t.id AND a.status = 'RESERVED'
      ), 0) AS available
      FROM tea_lots t
      WHERE t.id = ?
    `).get(workerData.teaLotId);
    if (!row || Number(row.available) < workerData.quantity) return false;
    db.prepare(`
      INSERT INTO inventory_allocations
        (id, fulfillment_item_id, tea_lot_id, quantity, status, allocated_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'RESERVED', ?, ?, ?)
    `).run(workerData.allocationId, workerData.fulfillmentItemId, workerData.teaLotId, workerData.quantity, workerData.now, workerData.now, workerData.now);
    return true;
  });
  return tx.immediate();
}

function consumption() {
  const tx = db.transaction(() => {
    const consumed = db.prepare(`
      UPDATE tea_lots
      SET inventory_quantity = inventory_quantity - (
        SELECT quantity
        FROM inventory_allocations
        WHERE id = ? AND status = 'RESERVED' AND tea_lot_id = tea_lots.id
      ), updated_at = ?
      WHERE id = (
        SELECT tea_lot_id
        FROM inventory_allocations
        WHERE id = ? AND status = 'RESERVED'
      )
      AND inventory_quantity >= (
        SELECT quantity
        FROM inventory_allocations
        WHERE id = ? AND status = 'RESERVED'
      )
    `).run(workerData.allocationId, workerData.now, workerData.allocationId, workerData.allocationId).changes === 1;
    if (!consumed) return false;
    return db.prepare(`
      UPDATE inventory_allocations
      SET status = 'CONSUMED', consumed_at = ?, updated_at = ?
      WHERE id = ? AND status = 'RESERVED'
    `).run(workerData.now, workerData.now, workerData.allocationId).changes === 1;
  });
  return tx.immediate();
}

function release() {
  const tx = db.transaction(() => db.prepare(`
    UPDATE inventory_allocations
    SET status = 'RELEASED', released_at = ?, updated_at = ?
    WHERE id = ? AND status = 'RESERVED'
  `).run(workerData.now, workerData.now, workerData.allocationId).changes === 1);
  return tx.immediate();
}

function rollback() {
  let rolledBack = false;
  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO inventory_allocations
        (id, fulfillment_item_id, tea_lot_id, quantity, status, allocated_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'RESERVED', ?, ?, ?)
    `).run(workerData.allocationId, workerData.fulfillmentItemId, workerData.teaLotId, workerData.quantity, workerData.now, workerData.now, workerData.now);
    throw new Error('forced rollback');
  });
  try {
    tx.immediate();
  } catch (error) {
    if (!(error instanceof Error) || error.message !== 'forced rollback') throw error;
    rolledBack = true;
  }
  return rolledBack;
}

try {
  let result;
  if (workerData.operation === 'reservation') result = reservation();
  else if (workerData.operation === 'consumption') result = consumption();
  else if (workerData.operation === 'release') result = release();
  else if (workerData.operation === 'rollback') result = rollback();
  else throw new Error(`Unknown operation: ${workerData.operation}`);
  parentPort.postMessage({ ok: true, result });
} catch (error) {
  parentPort.postMessage({ ok: false, error: error instanceof Error ? `${error.name}: ${error.message}` : String(error) });
} finally {
  db.close();
}
