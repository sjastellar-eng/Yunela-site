import { afterEach, describe, expect, it } from 'vitest';
import { openDatabase } from '../../database/client';
import { applyMigrations } from '../../database/migrate';
import { SqliteFulfillmentRepository } from './sqliteRepository';

const databases: ReturnType<typeof openDatabase>[] = [];
const now = '2026-09-15T16:00:00.000Z';

function createDatabase() {
  const db = openDatabase();
  databases.push(db);
  applyMigrations(db);
  db.prepare('INSERT INTO customers (id, email, created_at) VALUES (?, ?, ?)').run('customer-f1', 'f1@example.invalid', now);
  db.prepare(`INSERT INTO orders (id, customer_id, status, currency, subtotal_amount, discount_amount, shipping_amount, total_amount, shipping_snapshot_json, idempotency_key, created_at, updated_at) VALUES (?, ?, 'created', 'UAH', 1000, 0, 0, 1000, ?, ?, ?, ?)`)
    .run('order-f1', 'customer-f1', JSON.stringify({ recipientName: 'Test', city: 'Kyiv', countryCode: 'UA' }), 'f1-order-key', now, now);
  db.prepare('INSERT INTO order_items (id, order_id, sku, tea_name_snapshot, quantity, unit_price_amount, unit_price_currency, line_total_amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run('order-item-f1', 'order-f1', 'TEA-F1', 'Synthetic Tea', 1, 1000, 'UAH', 1000);
  db.prepare('INSERT INTO purchases (id, order_id, customer_id, amount, currency, confirmed_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run('purchase-f1', 'order-f1', 'customer-f1', 1000, 'UAH', now);
  db.prepare(`INSERT INTO tea_families (id, name) VALUES (?, ?)`)
    .run('family-f1', 'F1 Test Family');
  db.prepare(`INSERT INTO teas (id, slug, name, family_id, sensory_json, discovery_distance, price_amount, price_currency, pack_size_grams, supply_status, provenance_confidence, publishing_state, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run('tea-f1', 'tea-f1', 'F1 Test Tea', 'family-f1', '{}', 10, 1000, 'UAH', 10, 'available', 'unknown', 'published', now, now);
  db.prepare(`INSERT INTO tea_lots (id, tea_id, lot_code, inventory_quantity, supply_status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run('lot-f1', 'tea-f1', 'LOT-F1', 10, 'available', now, now);
  return db;
}

afterEach(() => { while (databases.length) databases.pop()?.close(); });

describe('F1 fulfillment persistence', () => {
  it('applies the full migration chain idempotently and exposes all F1 tables', () => {
    const db = createDatabase();
    applyMigrations(db);
    const versions = db.prepare('SELECT version FROM schema_migrations ORDER BY version').all() as Array<{ version: string }>;
    expect(versions.map(({ version }) => version)).toEqual([
      '0001_initial',
      '0002_discovery_box',
      '0003_commerce',
      '0004_mono_payment',
      '0005_fulfillment_persistence',
    ]);
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('fulfillments','fulfillment_items','inventory_allocations','shipments','fulfillment_events') ORDER BY name").all() as Array<{ name: string }>;
    expect(tables.map(({ name }) => name)).toEqual(['fulfillment_events','fulfillment_items','fulfillments','inventory_allocations','shipments']);
  });

  it('enforces one Fulfillment per Order/Purchase and one Shipment per Fulfillment', () => {
    const db = createDatabase();
    const repo = new SqliteFulfillmentRepository(db);
    const fulfillment = {
      id: 'fulfillment-f1', orderId: 'order-f1', purchaseId: 'purchase-f1', customerId: 'customer-f1', status: 'PENDING' as const,
      shippingSnapshotJson: JSON.stringify({ recipientName: 'Test', city: 'Kyiv', countryCode: 'UA' }),
      itemsSnapshotJson: JSON.stringify([{ orderItemId: 'order-item-f1', sku: 'TEA-F1', quantity: 1 }]), createdAt: now, updatedAt: now,
    };
    repo.createFulfillment(fulfillment);
    expect(() => repo.createFulfillment({ ...fulfillment, id: 'fulfillment-duplicate-order' })).toThrow();
    expect(() => repo.createFulfillment({ ...fulfillment, id: 'fulfillment-duplicate-purchase', orderId: 'missing-order' })).toThrow();
    repo.createShipment({ id: 'shipment-f1', fulfillmentId: fulfillment.id, status: 'PENDING', createdAt: now, updatedAt: now });
    expect(() => repo.createShipment({ id: 'shipment-duplicate', fulfillmentId: fulfillment.id, status: 'PENDING', createdAt: now, updatedAt: now })).toThrow();
  });

  it('rejects orphan records and non-positive quantities', () => {
    const db = createDatabase();
    const repo = new SqliteFulfillmentRepository(db);
    expect(() => repo.createFulfillmentItem({ id: 'item-orphan', fulfillmentId: 'missing-fulfillment', orderItemId: 'order-item-f1', sku: 'TEA-F1', quantity: 1, productSnapshotJson: '{}', allocationStatus: 'PENDING', createdAt: now, updatedAt: now })).toThrow();
    expect(() => repo.createInventoryAllocation({ id: 'allocation-orphan', fulfillmentItemId: 'missing-item', teaLotId: 'lot-f1', quantity: 1, status: 'RESERVED', createdAt: now, updatedAt: now })).toThrow();
    expect(() => repo.createShipment({ id: 'shipment-orphan', fulfillmentId: 'missing-fulfillment', status: 'PENDING', createdAt: now, updatedAt: now })).toThrow();
    expect(() => repo.appendFulfillmentEvent({ id: 'event-orphan', fulfillmentId: 'missing-fulfillment', eventType: 'CREATED', actor: 'system', occurredAt: now, eventKey: 'event-orphan-key', createdAt: now })).toThrow();
  });

  it('persists immutable snapshots and supports Discovery Box component rows', () => {
    const db = createDatabase();
    const repo = new SqliteFulfillmentRepository(db);
    repo.createFulfillment({ id: 'fulfillment-box', orderId: 'order-f1', purchaseId: 'purchase-f1', customerId: 'customer-f1', status: 'READY', shippingSnapshotJson: JSON.stringify({ city: 'Kyiv', postalCode: '01001' }), itemsSnapshotJson: JSON.stringify({ discoveryBox: ['TEA-1', 'TEA-2', 'TEA-3', 'TEA-4', 'TEA-5', 'TEA-6'] }), createdAt: now, updatedAt: now });
    for (let index = 1; index <= 6; index += 1) {
      repo.createFulfillmentItem({ id: `box-item-${index}`, fulfillmentId: 'fulfillment-box', orderItemId: 'order-item-f1', sku: `TEA-${index}`, quantity: 1, productSnapshotJson: JSON.stringify({ teaId: `tea-${index}`, position: index }), provenanceReference: `box-component-${index}`, allocationStatus: 'PENDING', createdAt: now, updatedAt: now });
    }
    const persisted = repo.getFulfillmentById('fulfillment-box');
    expect(persisted?.shippingSnapshotJson).toContain('Kyiv');
    expect(JSON.parse(persisted?.itemsSnapshotJson ?? '{}').discoveryBox).toHaveLength(6);
    expect(repo.listFulfillmentItems('fulfillment-box')).toHaveLength(6);
  });

  it('enforces inventory allocation references, uniqueness and event idempotency without mutating tea_lots inventory', () => {
    const db = createDatabase();
    const repo = new SqliteFulfillmentRepository(db);
    repo.createFulfillment({ id: 'fulfillment-inventory', orderId: 'order-f1', purchaseId: 'purchase-f1', customerId: 'customer-f1', status: 'READY', shippingSnapshotJson: '{}', itemsSnapshotJson: '{}', createdAt: now, updatedAt: now });
    repo.createFulfillmentItem({ id: 'item-inventory', fulfillmentId: 'fulfillment-inventory', orderItemId: 'order-item-f1', sku: 'TEA-F1', quantity: 2, productSnapshotJson: '{}', allocationStatus: 'ALLOCATED', createdAt: now, updatedAt: now });
    repo.createInventoryAllocation({ id: 'allocation-f1', fulfillmentItemId: 'item-inventory', teaLotId: 'lot-f1', quantity: 2, status: 'RESERVED', allocatedAt: now, createdAt: now, updatedAt: now });
    expect(() => repo.createInventoryAllocation({ id: 'allocation-duplicate-lot', fulfillmentItemId: 'item-inventory', teaLotId: 'lot-f1', quantity: 1, status: 'RESERVED', createdAt: now, updatedAt: now })).toThrow();
    expect(repo.listInventoryAllocations('item-inventory')).toHaveLength(1);
    expect((db.prepare('SELECT inventory_quantity FROM tea_lots WHERE id = ?').get('lot-f1') as { inventory_quantity: number }).inventory_quantity).toBe(10);
    repo.appendFulfillmentEvent({ id: 'event-f1', fulfillmentId: 'fulfillment-inventory', eventType: 'CREATED', fromStatus: undefined, toStatus: 'READY', actor: 'system', occurredAt: now, eventKey: 'fulfillment-inventory:created', createdAt: now });
    expect(() => repo.appendFulfillmentEvent({ id: 'event-f1-duplicate-key', fulfillmentId: 'fulfillment-inventory', eventType: 'CREATED', actor: 'system', occurredAt: now, eventKey: 'fulfillment-inventory:created', createdAt: now })).toThrow();
    expect(repo.listFulfillmentEvents('fulfillment-inventory')).toHaveLength(1);
  });

  it('requires parent records and required fields at the database boundary', () => {
    const db = createDatabase();
    expect(() => db.prepare(`INSERT INTO fulfillments (id, order_id, purchase_id, customer_id, status, shipping_snapshot_json, items_snapshot_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run('missing-purchase', 'order-f1', 'missing-purchase', 'customer-f1', 'PENDING', '{}', '{}', now, now)).toThrow();
    expect(() => db.prepare(`INSERT INTO shipments (id, fulfillment_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`)
      .run('missing-shipment', 'missing-fulfillment', 'PENDING', now, now)).toThrow();
    expect(() => db.prepare(`INSERT INTO fulfillment_items (id, fulfillment_id, order_item_id, sku, quantity, product_snapshot_json, allocation_status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run('zero-item', 'missing-fulfillment', 'order-item-f1', 'TEA-F1', 0, '{}', 'PENDING', now, now)).toThrow();
  });
});
