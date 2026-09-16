import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { openDatabase } from '../../database/client';
import { applyMigrations } from '../../database/migrate';
import { SqliteFulfillmentMutationRepository } from './sqliteDomainRepository';

describe('F2 inventory semantics', () => {
  it('treats inventory_quantity as physical stock and RESERVED allocations as derived reservation claims', () => {
    const db = openDatabase();
    applyMigrations(db);
    const now = new Date().toISOString();
    const customerId = randomUUID();
    const orderId = randomUUID();
    const purchaseId = randomUUID();
    const teaId = randomUUID();
    const lotId = randomUUID();
    const orderItemId = randomUUID();
    const fulfillmentId = randomUUID();
    const fulfillmentItemId = randomUUID();
    db.prepare('INSERT INTO customers (id,email,created_at) VALUES (?,?,?)').run(customerId, `${customerId}@test.local`, now);
    db.prepare('INSERT INTO tea_families (id,name) VALUES (?,?)').run(`family-${teaId}`, 'Test Family');
    db.prepare(`INSERT INTO teas (id,slug,name,family_id,sensory_json,discovery_distance,price_amount,price_currency,pack_size_grams,supply_status,provenance_confidence,publishing_state,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(teaId, `tea-${teaId}`, 'Test Tea', `family-${teaId}`, '{}', 50, 100, 'UAH', 10, 'available', 'verified', 'published', now, now);
    db.prepare('INSERT INTO tea_lots (id,tea_id,lot_code,inventory_quantity,supply_status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)').run(lotId, teaId, `LOT-${lotId}`, 10, 'available', now, now);
    const shipping = JSON.stringify({recipientName:'Test',addressLine1:'1 Main',city:'Dnipro',postalCode:'49000',countryCode:'UA'});
    db.prepare('INSERT INTO orders (id,customer_id,status,currency,subtotal_amount,discount_amount,shipping_amount,total_amount,shipping_snapshot_json,idempotency_key,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run(orderId, customerId, 'confirmed', 'UAH', 100, 0, 0, 100, shipping, randomUUID(), now, now);
    db.prepare('INSERT INTO order_items (id,order_id,sku,tea_id,tea_name_snapshot,quantity,unit_price_amount,unit_price_currency,line_total_amount,recommendation_history_id,discovery_box_snapshot_json) VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(orderItemId, orderId, 'TEA-TEST', teaId, 'Test Tea', 8, 100, 'UAH', 800, null, null);
    db.prepare('INSERT INTO fulfillments (id,order_id,purchase_id,customer_id,status,shipping_snapshot_json,items_snapshot_json,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)').run(fulfillmentId, orderId, purchaseId, customerId, 'READY', shipping, '[]', now, now);
    db.prepare('INSERT INTO fulfillment_items (id,fulfillment_id,order_item_id,sku,quantity,product_snapshot_json,allocation_status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)').run(fulfillmentItemId, fulfillmentId, orderItemId, 'TEA-TEST', 8, '{}', 'ALLOCATED', now, now);

    const repo = new SqliteFulfillmentMutationRepository(db);
    repo.createInventoryAllocation({id:randomUUID(),fulfillmentItemId,teaLotId:lotId,quantity:8,status:'RESERVED',allocatedAt:now,createdAt:now,updatedAt:now});

    expect((db.prepare('SELECT inventory_quantity q FROM tea_lots WHERE id=?').get(lotId) as {q:number}).q).toBe(10);
    expect(repo.decrementLotInventory(lotId, 2)).toBe(true);
    expect(repo.decrementLotInventory(lotId, 3)).toBe(false);
    db.close();
  });

  it('decrements physical stock exactly at RESERVED -> CONSUMED and not at READY', () => {
    const db = openDatabase();
    applyMigrations(db);
    const now = new Date().toISOString();
    const customerId = randomUUID(), orderId = randomUUID(), teaId = randomUUID(), lotId = randomUUID(), orderItemId = randomUUID(), fulfillmentId = randomUUID(), fulfillmentItemId = randomUUID(), allocationId = randomUUID();
    db.prepare('INSERT INTO customers (id,email,created_at) VALUES (?,?,?)').run(customerId, `${customerId}@test.local`, now);
    db.prepare('INSERT INTO tea_families (id,name) VALUES (?,?)').run(`family-${teaId}`, 'Test Family');
    db.prepare(`INSERT INTO teas (id,slug,name,family_id,sensory_json,discovery_distance,price_amount,price_currency,pack_size_grams,supply_status,provenance_confidence,publishing_state,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(teaId, `tea-${teaId}`, 'Test Tea', `family-${teaId}`, '{}', 50, 100, 'UAH', 10, 'available', 'verified', 'published', now, now);
    db.prepare('INSERT INTO tea_lots (id,tea_id,lot_code,inventory_quantity,supply_status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)').run(lotId, teaId, `LOT-${lotId}`, 10, 'available', now, now);
    const shipping = JSON.stringify({recipientName:'Test',addressLine1:'1 Main',city:'Dnipro',postalCode:'49000',countryCode:'UA'});
    db.prepare('INSERT INTO orders (id,customer_id,status,currency,subtotal_amount,discount_amount,shipping_amount,total_amount,shipping_snapshot_json,idempotency_key,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run(orderId, customerId, 'confirmed', 'UAH', 100, 0, 0, 100, shipping, randomUUID(), now, now);
    db.prepare('INSERT INTO order_items (id,order_id,sku,tea_id,tea_name_snapshot,quantity,unit_price_amount,unit_price_currency,line_total_amount,recommendation_history_id,discovery_box_snapshot_json) VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(orderItemId, orderId, 'TEA-TEST', teaId, 'Test Tea', 2, 100, 'UAH', 200, null, null);
    db.prepare('INSERT INTO fulfillments (id,order_id,purchase_id,customer_id,status,shipping_snapshot_json,items_snapshot_json,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)').run(fulfillmentId, orderId, randomUUID(), customerId, 'READY', shipping, '[]', now, now);
    db.prepare('INSERT INTO fulfillment_items (id,fulfillment_id,order_item_id,sku,quantity,product_snapshot_json,allocation_status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)').run(fulfillmentItemId, fulfillmentId, orderItemId, 'TEA-TEST', 2, '{}', 'ALLOCATED', now, now);
    db.prepare('INSERT INTO inventory_allocations (id,fulfillment_item_id,tea_lot_id,quantity,status,allocated_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)').run(allocationId, fulfillmentItemId, lotId, 2, 'RESERVED', now, now, now);
    const repo = new SqliteFulfillmentMutationRepository(db);

    expect(repo.updateInventoryAllocationStatus(allocationId, 'RESERVED', 'CONSUMED', now)).toBe(true);
    expect((db.prepare('SELECT inventory_quantity q FROM tea_lots WHERE id=?').get(lotId) as {q:number}).q).toBe(8);
    expect(db.prepare('SELECT status FROM inventory_allocations WHERE id=?').get(allocationId)).toEqual({status:'CONSUMED'});
    expect(repo.updateInventoryAllocationStatus(allocationId, 'RESERVED', 'CONSUMED', now)).toBe(false);
    expect((db.prepare('SELECT inventory_quantity q FROM tea_lots WHERE id=?').get(lotId) as {q:number}).q).toBe(8);
    db.close();
  });
});
