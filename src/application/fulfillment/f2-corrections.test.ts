import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { openDatabase } from '../../database/client';
import { applyMigrations } from '../../database/migrate';
import { SqliteFulfillmentMutationRepository } from './sqliteDomainRepository';
import { FulfillmentApplicationService, type DiscoveryBoxShortage } from './service';

function fixture() {
  const db = openDatabase();
  applyMigrations(db);
  const customerId = randomUUID();
  const orderId = randomUUID();
  const purchaseId = randomUUID();
  const attemptId = randomUUID();
  const teaId = randomUUID();
  const replacementTeaId = randomUUID();
  const lotId = randomUUID();
  const replacementLotId = randomUUID();
  const now = new Date().toISOString();
  db.prepare('INSERT INTO customers (id,email,created_at) VALUES (?,?,?)').run(customerId, `${customerId}@test.local`, now);
  db.prepare('INSERT INTO tea_families (id,name) VALUES (?,?)').run(`family-${teaId}`, 'Test Family');
  db.prepare('INSERT INTO tea_families (id,name) VALUES (?,?)').run(`family-${replacementTeaId}`, 'Replacement Family');
  const teaSql = `INSERT INTO teas (id,slug,name,family_id,sensory_json,discovery_distance,price_amount,price_currency,pack_size_grams,supply_status,provenance_confidence,publishing_state,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
  db.prepare(teaSql).run(teaId, `tea-${teaId}`, 'Original Tea', `family-${teaId}`, '{}', 50, 100, 'UAH', 10, 'available', 'verified', 'published', now, now);
  db.prepare(teaSql).run(replacementTeaId, `tea-${replacementTeaId}`, 'Replacement Tea', `family-${replacementTeaId}`, '{}', 50, 100, 'UAH', 10, 'available', 'verified', 'published', now, now);
  const lotSql = `INSERT INTO tea_lots (id,tea_id,lot_code,inventory_quantity,supply_status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)`;
  db.prepare(lotSql).run(lotId, teaId, `LOT-${lotId}`, 10, 'available', now, now);
  db.prepare(lotSql).run(replacementLotId, replacementTeaId, `LOT-${replacementLotId}`, 20, 'available', now, now);
  const itemId = randomUUID();
  const shipping = { recipientName: 'Test', addressLine1: '1 Main', city: 'Dnipro', postalCode: '49000', countryCode: 'UA' };
  db.prepare(`INSERT INTO orders (id,customer_id,status,currency,subtotal_amount,discount_amount,shipping_amount,total_amount,shipping_snapshot_json,idempotency_key,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(orderId, customerId, 'confirmed', 'UAH', 100, 0, 0, 100, JSON.stringify(shipping), randomUUID(), now, now);
  db.prepare(`INSERT INTO order_items (id,order_id,sku,tea_id,tea_name_snapshot,quantity,unit_price_amount,unit_price_currency,line_total_amount,recommendation_history_id,discovery_box_snapshot_json) VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(itemId, orderId, 'TEA-TEST', teaId, 'Original Tea', 1, 100, 'UAH', 100, null, null);
  db.prepare(`INSERT INTO payment_attempts (id,order_id,customer_id,provider,merchant_reference,requested_amount,requested_currency,state,idempotency_key,created_at,updated_at,confirmed_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(attemptId, orderId, customerId, 'MONO', `ref-${attemptId}`, 100, 'UAH', 'SUCCEEDED', randomUUID(), now, now, now);
  db.prepare(`INSERT INTO purchases (id,order_id,customer_id,amount,currency,confirmed_at,payment_attempt_id,provider,provider_invoice_id,provider_reference) VALUES (?,?,?,?,?,?,?,?,?,?)`).run(purchaseId, orderId, customerId, 100, 'UAH', now, attemptId, 'MONO', `inv-${purchaseId}`, `ref-${purchaseId}`);
  const service = new FulfillmentApplicationService(new SqliteFulfillmentMutationRepository(db));
  return { db, service, purchaseId, teaId, replacementTeaId, lotId, replacementLotId, itemId };
}

function boxFixture() {
  const f = fixture();
  const items = ['MATCH', 'MATCH', 'MATCH', 'STRETCH', 'STRETCH', 'WILDCARD'].map((classification, i) => ({ teaId: f.teaId, teaName: 'Original Tea', classification, position: i + 1, score: 80 - i, reasons: ['reason'] }));
  f.db.prepare('UPDATE order_items SET sku=?, discovery_box_snapshot_json=? WHERE id=?').run('DISCOVERY-BOX', JSON.stringify({ discoveryBoxId: randomUUID(), algorithmVersion: 'recommendation-v1', selectionVersion: 'discovery-box-v1', items }), f.itemId);
  return f;
}

function preparePacked(f: ReturnType<typeof fixture>) {
  const x = f.service.createFulfillmentFromPurchase(f.purchaseId);
  f.service.markReady(x.id, 'SYSTEM', 'ready');
  f.service.startPacking(x.id, 'YUNELA:operator', 'packing');
  f.service.markPacked(x.id, 'YUNELA:operator', 'packed');
  return x;
}

describe('F2 review corrections', () => {
  it('does not allow Supplier to create Shipment', () => {
    const f = fixture();
    const x = preparePacked(f);
    expect(() => f.service.createShipment(x.id, 'SUPPLIER:one', 'shipment')).toThrow();
    expect(f.db.prepare('SELECT COUNT(*) c FROM shipments WHERE fulfillment_id=?').get(x.id)).toEqual({ c: 0 });
    f.db.close();
  });

  it('synchronizes Shipment SHIPPED with Fulfillment SHIPPED atomically', () => {
    const f = fixture();
    const x = preparePacked(f);
    f.service.createShipment(x.id, 'YUNELA:operator', 'shipment');
    const s = f.service.transitionShipment(x.id, 'SHIPPED', 'YUNELA:operator', 'ship');
    expect(s.status).toBe('SHIPPED');
    expect(f.service.getFulfillment(x.id).status).toBe('SHIPPED');
    f.db.close();
  });

  it('does not allow Shipment DELIVERED while Fulfillment is not DELIVERED', () => {
    const f = fixture();
    const x = preparePacked(f);
    f.service.createShipment(x.id, 'YUNELA:operator', 'shipment');
    expect(() => f.service.transitionShipment(x.id, 'DELIVERED', 'YUNELA:operator', 'deliver')).toThrow();
    expect(f.service.getFulfillment(x.id).status).toBe('PACKED');
    expect(f.service.getFulfillment(x.id).status).not.toBe('DELIVERED');
    f.db.close();
  });

  it('synchronizes LOST Shipment to Fulfillment LOST', () => {
    const f = fixture();
    const x = preparePacked(f);
    f.service.createShipment(x.id, 'YUNELA:operator', 'shipment');
    f.service.transitionShipment(x.id, 'SHIPPED', 'YUNELA:operator', 'ship');
    const s = f.service.transitionShipment(x.id, 'LOST', 'YUNELA:operator', 'lost');
    expect(s.status).toBe('LOST');
    expect(f.service.getFulfillment(x.id).status).toBe('LOST');
    f.db.close();
  });

  it('synchronizes RETURNED Shipment to Fulfillment RETURNED', () => {
    const f = fixture();
    const x = preparePacked(f);
    f.service.createShipment(x.id, 'YUNELA:operator', 'shipment');
    f.service.transitionShipment(x.id, 'SHIPPED', 'YUNELA:operator', 'ship');
    f.service.transitionShipment(x.id, 'DELIVERED', 'YUNELA:operator', 'deliver');
    const s = f.service.transitionShipment(x.id, 'RETURNED', 'YUNELA:operator', 'return');
    expect(s.status).toBe('RETURNED');
    expect(f.service.getFulfillment(x.id).status).toBe('RETURNED');
    f.db.close();
  });

  it('rejects approval when replacement tea is not the outstanding operational replacement', () => {
    const f = boxFixture();
    const x = f.service.createFulfillmentFromPurchase(f.purchaseId);
    const shortage: DiscoveryBoxShortage = { originalTeaId: f.teaId, originalLotId: f.lotId, proposedReplacementTeaId: f.replacementTeaId, proposedReplacementLotId: f.replacementLotId, reason: 'shortage' };
    f.service.handleDiscoveryBoxShortage(x.id, shortage, 'YUNELA:operator', 'shortage');
    expect(() => f.service.recordCustomerApproval(x.id, { originalTeaId: f.teaId, originalLotId: f.lotId, replacementTeaId: f.teaId, reason: 'bad', actor: 'YUNELA:operator', customerDecision: 'APPROVED', timestamp: new Date().toISOString() }, 'approval-bad')).toThrow();
    f.db.close();
  });

  it('rejects approval when replacement lot does not belong to replacement tea', () => {
    const f = boxFixture();
    const x = f.service.createFulfillmentFromPurchase(f.purchaseId);
    f.service.handleDiscoveryBoxShortage(x.id, { originalTeaId: f.teaId, originalLotId: f.lotId, proposedReplacementTeaId: f.replacementTeaId, proposedReplacementLotId: f.replacementLotId, reason: 'shortage' }, 'YUNELA:operator', 'shortage');
    expect(() => f.service.recordCustomerApproval(x.id, { originalTeaId: f.teaId, originalLotId: f.lotId, replacementTeaId: f.replacementTeaId, replacementLotId: f.lotId, reason: 'bad lot', actor: 'YUNELA:operator', customerDecision: 'APPROVED', timestamp: new Date().toISOString() }, 'approval-bad-lot')).toThrow();
    f.db.close();
  });

  it('rejects approval without an outstanding shortage', () => {
    const f = boxFixture();
    const x = f.service.createFulfillmentFromPurchase(f.purchaseId);
    expect(() => f.service.recordCustomerApproval(x.id, { originalTeaId: f.teaId, replacementTeaId: f.replacementTeaId, reason: 'arbitrary', actor: 'YUNELA:operator', customerDecision: 'APPROVED', timestamp: new Date().toISOString() }, 'approval')).toThrow();
    f.db.close();
  });

  it('keeps Fulfillment blocked after REJECTED approval', () => {
    const f = boxFixture();
    const x = f.service.createFulfillmentFromPurchase(f.purchaseId);
    f.service.handleDiscoveryBoxShortage(x.id, { originalTeaId: f.teaId, originalLotId: f.lotId, proposedReplacementTeaId: f.replacementTeaId, proposedReplacementLotId: f.replacementLotId, reason: 'shortage' }, 'YUNELA:operator', 'shortage');
    f.service.recordCustomerApproval(x.id, { originalTeaId: f.teaId, originalLotId: f.lotId, replacementTeaId: f.replacementTeaId, replacementLotId: f.replacementLotId, reason: 'customer rejected', actor: 'YUNELA:operator', customerDecision: 'REJECTED', timestamp: new Date().toISOString() }, 'reject');
    expect(f.service.getFulfillment(x.id).status).toBe('PENDING_CUSTOMER_APPROVAL');
    expect(() => f.service.markReady(x.id, 'SYSTEM', 'ready-after-reject')).toThrow();
    f.db.close();
  });

  it('accepts valid approval, then allows readiness, without changing OrderItem snapshot', () => {
    const f = boxFixture();
    const before = (f.db.prepare('SELECT discovery_box_snapshot_json v FROM order_items WHERE id=?').get(f.itemId) as { v: string }).v;
    const x = f.service.createFulfillmentFromPurchase(f.purchaseId);
    f.service.handleDiscoveryBoxShortage(x.id, { originalTeaId: f.teaId, originalLotId: f.lotId, proposedReplacementTeaId: f.replacementTeaId, proposedReplacementLotId: f.replacementLotId, reason: 'shortage' }, 'YUNELA:operator', 'shortage');
    f.service.recordCustomerApproval(x.id, { originalTeaId: f.teaId, originalLotId: f.lotId, replacementTeaId: f.replacementTeaId, replacementLotId: f.replacementLotId, reason: 'approved', actor: 'YUNELA:operator', customerDecision: 'APPROVED', timestamp: new Date().toISOString() }, 'approve');
    expect(f.service.markReady(x.id, 'SYSTEM', 'ready-after-approval').status).toBe('READY');
    const after = (f.db.prepare('SELECT discovery_box_snapshot_json v FROM order_items WHERE id=?').get(f.itemId) as { v: string }).v;
    expect(after).toBe(before);
    f.db.close();
  });

  it('makes duplicate approval idempotent and records one decision event', () => {
    const f = boxFixture();
    const x = f.service.createFulfillmentFromPurchase(f.purchaseId);
    f.service.handleDiscoveryBoxShortage(x.id, { originalTeaId: f.teaId, originalLotId: f.lotId, proposedReplacementTeaId: f.replacementTeaId, proposedReplacementLotId: f.replacementLotId, reason: 'shortage' }, 'YUNELA:operator', 'shortage');
    const approval = { originalTeaId: f.teaId, originalLotId: f.lotId, replacementTeaId: f.replacementTeaId, replacementLotId: f.replacementLotId, reason: 'approved', actor: 'YUNELA:operator', customerDecision: 'APPROVED' as const, timestamp: new Date().toISOString() };
    f.service.recordCustomerApproval(x.id, approval, 'approve');
    f.service.recordCustomerApproval(x.id, approval, 'approve-duplicate');
    const rows = f.db.prepare("SELECT COUNT(*) c FROM fulfillment_events WHERE fulfillment_id=? AND event_type LIKE '%DISCOVERY_BOX_REPLACEMENT_DECISION%'").get(x.id);
    expect(rows).toEqual({ c: 1 });
    f.db.close();
  });

  it('returns deterministic success for duplicate audit event append', () => {
    const f = fixture();
    const repo = new SqliteFulfillmentMutationRepository(f.db);
    const event = { id: randomUUID(), fulfillmentId: randomUUID(), eventType: 'TEST', fromStatus: undefined, toStatus: undefined, actor: 'SYSTEM', occurredAt: new Date().toISOString(), eventKey: `duplicate:${randomUUID()}`, createdAt: new Date().toISOString() };
    expect(repo.appendFulfillmentEvent(event)).toBe(true);
    expect(repo.appendFulfillmentEvent({ ...event, id: randomUUID() })).toBe(true);
    expect(f.db.prepare('SELECT COUNT(*) c FROM fulfillment_events WHERE event_key=?').get(event.eventKey)).toEqual({ c: 1 });
    f.db.close();
  });
});
