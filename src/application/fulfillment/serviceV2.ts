import { randomUUID } from 'node:crypto';
import { URL } from 'node:url';
import { ApplicationError } from '../errors';
import type { OrderItemSnapshot } from '../../contracts/commerce';
import { assertDiscoveryBoxComposition, assertFulfillmentTransition, FulfillmentDomainError, type FulfillmentStatus, type ShipmentStatus } from '../../domain/fulfillment';
import type { FulfillmentRecord, FulfillmentItemRecord, ShipmentRecord, FulfillmentEventRecord, InventoryAllocationRecord } from './repositories';
import type { FulfillmentMutationRepository } from './sqliteDomainRepository';
import type { AnalyticsEventName, AnalyticsPayload, AnalyticsTracker } from '../../contracts/analytics';

export interface ReplacementApproval {
  originalTeaId: string;
  originalLotId?: string;
  replacementTeaId: string;
  replacementLotId?: string;
  reason: string;
  actor: string;
  customerDecision: 'APPROVED' | 'REJECTED';
  timestamp: string;
}

export interface DiscoveryBoxShortage {
  originalTeaId: string;
  originalLotId?: string;
  proposedReplacementTeaId: string;
  proposedReplacementLotId?: string;
  reason: string;
}

function domainGuard(fn: () => void): void {
  try { fn(); } catch (error) {
    if (error instanceof FulfillmentDomainError) throw new ApplicationError('DOMAIN_RULE_VIOLATION', error.message);
    throw error;
  }
}
function now() { return new Date().toISOString(); }
function eventKey(fulfillmentId: string, operationKey: string) { return `${fulfillmentId}:${operationKey}`; }
function snapshotItem(item: OrderItemSnapshot) { return JSON.stringify(item); }
function provenance(item: OrderItemSnapshot) { return JSON.stringify({ teaId: item.teaId, recommendationHistoryId: item.recommendationHistoryId, discoveryBoxSnapshot: item.discoveryBoxSnapshot }); }

export class FulfillmentApplicationService {
  constructor(private readonly repo: FulfillmentMutationRepository, private readonly analytics?: AnalyticsTracker) {}

  createFulfillmentFromPurchase(purchaseId: string, operationKey = `create:${purchaseId}`): FulfillmentRecord {
    return this.repo.transaction(() => {
      const context = this.repo.getPurchaseContext(purchaseId);
      if (!context) throw new ApplicationError('NOT_FOUND', `Authoritative Purchase ${purchaseId} or successful PaymentAttempt was not found`);
      const existing = this.repo.getFulfillmentByPurchaseId(purchaseId);
      if (existing) return existing;
      const { purchase, order, paymentAttempt } = context;
      if (order.status !== 'confirmed') throw new ApplicationError('DOMAIN_RULE_VIOLATION', 'Fulfillment requires a CONFIRMED Order');
      if (purchase.orderId !== order.id || purchase.customerId !== order.customerId || paymentAttempt.orderId !== order.id || paymentAttempt.customerId !== order.customerId || paymentAttempt.state !== 'SUCCEEDED') {
        throw new ApplicationError('PURCHASE_NOT_AUTHORIZED', 'Purchase, Order and successful PaymentAttempt ownership does not match');
      }
      if (!order.items.length) throw new ApplicationError('DOMAIN_RULE_VIOLATION', 'Fulfillment requires at least one OrderItem');
      for (const item of order.items) if (item.discoveryBoxSnapshot) domainGuard(() => assertDiscoveryBoxComposition(item.discoveryBoxSnapshot!.items));
      const timestamp = now();
      const record: FulfillmentRecord = { id: randomUUID(), orderId: order.id, purchaseId: purchase.id, customerId: order.customerId, status: 'PENDING', shippingSnapshotJson: JSON.stringify(order.shipping), itemsSnapshotJson: JSON.stringify(order.items), createdAt: timestamp, updatedAt: timestamp };
      this.repo.createFulfillment(record);
      for (const item of order.items) {
        const fi: FulfillmentItemRecord = { id: randomUUID(), fulfillmentId: record.id, orderItemId: item.id, sku: item.sku, quantity: item.quantity, productSnapshotJson: snapshotItem(item), provenanceReference: provenance(item), allocationStatus: 'PENDING', createdAt: timestamp, updatedAt: timestamp };
        this.repo.createFulfillmentItem(fi);
      }
      this.appendEventRequired(this.event(record.id, 'FULFILLMENT_CREATED', undefined, 'PENDING', 'SYSTEM', operationKey, timestamp));
      return record;
    });
  }

  getFulfillment(id: string) {
    const f = this.repo.getFulfillmentById(id);
    if (!f) throw new ApplicationError('NOT_FOUND', `Fulfillment ${id} was not found`);
    return f;
  }

  transitionFulfillment(id: string, to: FulfillmentStatus, actor: string, operationKey: string): FulfillmentRecord {
    return this.repo.transaction(() => {
      const current = this.require(id);
      const key = eventKey(id, operationKey);
      if (this.repo.listFulfillmentEvents(id).some(e => e.eventKey === key)) return current;
      if (current.status === to) return current;
      domainGuard(() => assertFulfillmentTransition(current.status, to));
      if (to === 'PENDING_CUSTOMER_APPROVAL') throw new ApplicationError('DOMAIN_RULE_VIOLATION', 'Customer approval state is entered only by Discovery Box shortage handling');
      if (to === 'READY') this.requireReadyActor(actor);
      if (to === 'PACKING' || to === 'PACKED') this.requireExecutionActor(actor);
      if (to === 'SHIPPED' || to === 'DELIVERED') this.requireYunela(actor);
      if (to === 'READY') {
        const shortages = this.discoveryBoxShortages(current);
        if (shortages.length > 0) {
          const ts = now();
          const shortage = shortages[0];
          this.appendEventRequired(this.event(id, JSON.stringify({ type: 'DISCOVERY_BOX_SHORTAGE_PROPOSED', ...shortage }), current.status, 'PENDING_CUSTOMER_APPROVAL', actor, operationKey, ts));
          if (!this.repo.setFulfillmentStatus(id, current.status, 'PENDING_CUSTOMER_APPROVAL', ts)) throw new ApplicationError('CONFLICT', 'Fulfillment changed concurrently');
          return this.require(id);
        }
        this.makeReady(current);
      }
      if (to === 'PACKED') this.consume(current);
      if (to === 'SHIPPED' && !this.repo.getShipmentByFulfillmentId(id)) throw new ApplicationError('DOMAIN_RULE_VIOLATION', 'Fulfillment cannot be shipped before Shipment exists');
      if (to === 'CANCELLED' || (to === 'FAILED' && ['READY', 'PACKING', 'PENDING_CUSTOMER_APPROVAL'].includes(current.status))) this.release(current);
      const ts = now();
      if (!this.repo.setFulfillmentStatus(id, current.status, to, ts)) throw new ApplicationError('CONFLICT', 'Fulfillment changed concurrently; retry with a fresh operation');
      const result = this.require(id);
      this.appendEventRequired(this.event(id, `STATE:${current.status}->${to}`, current.status, to, actor, operationKey, ts));
      return result;
    });
  }

  validateReadiness(id: string) { return this.repo.transaction(() => this.readiness(this.require(id))); }
  markReady(id: string, actor: string, operationKey: string) { return this.transitionFulfillment(id, 'READY', actor, operationKey); }
  startPacking(id: string, actor: string, operationKey: string) { return this.transitionFulfillment(id, 'PACKING', actor, operationKey); }
  markPacked(id: string, actor: string, operationKey: string) { return this.transitionFulfillment(id, 'PACKED', actor, operationKey); }

  markShipped(id: string, actor: string, operationKey: string): FulfillmentRecord {
    this.requireYunela(actor);
    const result = this.repo.transaction(() => {
      const f = this.require(id);
      const key = eventKey(id, operationKey);
      if (this.repo.listFulfillmentEvents(id).some(e => e.eventKey === key)) return { fulfillment: f, changed: false };
      domainGuard(() => assertFulfillmentTransition(f.status, 'SHIPPED'));
      const s = this.repo.getShipmentByFulfillmentId(id);
      if (!s) throw new ApplicationError('DOMAIN_RULE_VIOLATION', 'Shipment must exist before SHIPPED');
      if (s.status !== 'CREATED' && s.status !== 'SHIPPED') throw new ApplicationError('DOMAIN_RULE_VIOLATION', 'Shipment is ' + s.status);
      const ts = now();
      if (s.status === 'CREATED' && !this.repo.updateShipmentStatus(s.id, 'CREATED', 'SHIPPED', ts)) throw new ApplicationError('CONFLICT', 'Shipment changed concurrently');
      if (!this.repo.setFulfillmentStatus(id, f.status, 'SHIPPED', ts)) throw new ApplicationError('CONFLICT', 'Fulfillment changed concurrently');
      const fulfillment = this.require(id);
      this.appendEventRequired(this.event(id, 'STATE:PACKED->SHIPPED', f.status, 'SHIPPED', actor, operationKey, ts));
      return { fulfillment, changed: true };
    });
    if (result.changed) this.track('order_shipped', { fulfillmentId: id, shipmentId: this.getShipment(id).id });
    return result.fulfillment;
  }

  markDelivered(id: string, actor: string, operationKey: string): FulfillmentRecord {
    this.requireYunela(actor);
    const result = this.repo.transaction(() => {
      const f = this.require(id);
      const key = eventKey(id, operationKey);
      if (this.repo.listFulfillmentEvents(id).some(e => e.eventKey === key)) return { fulfillment: f, changed: false };
      domainGuard(() => assertFulfillmentTransition(f.status, 'DELIVERED'));
      const s = this.repo.getShipmentByFulfillmentId(id);
      if (!s || s.status !== 'SHIPPED') throw new ApplicationError('DOMAIN_RULE_VIOLATION', 'Shipment must be SHIPPED before delivery');
      const ts = now();
      if (!this.repo.updateShipmentStatus(s.id, 'SHIPPED', 'DELIVERED', ts)) throw new ApplicationError('CONFLICT', 'Shipment changed concurrently');
      if (!this.repo.setFulfillmentStatus(id, f.status, 'DELIVERED', ts)) throw new ApplicationError('CONFLICT', 'Fulfillment changed concurrently');
      const fulfillment = this.require(id);
      this.appendEventRequired(this.event(id, 'STATE:SHIPPED->DELIVERED', f.status, 'DELIVERED', actor, operationKey, ts));
      return { fulfillment, changed: true };
    });
    if (result.changed) this.track('order_delivered', { fulfillmentId: id, shipmentId: this.getShipment(id).id });
    return result.fulfillment;
  }

  markFailed(id: string, actor: string, reason: string, operationKey: string) { this.requireYunela(actor); return this.exception(id, 'FAILED', actor, reason, operationKey); }
  markLost(id: string, actor: string, reason: string, operationKey: string) { this.requireYunela(actor); return this.exception(id, 'LOST', actor, reason, operationKey); }
  cancelFulfillment(id: string, actor: string, reason: string, operationKey: string) { this.requireYunela(actor); return this.exception(id, 'CANCELLED', actor, reason, operationKey); }
  recordReturn(id: string, actor: string, reason: string, operationKey: string) { this.requireYunela(actor); return this.exception(id, 'RETURNED', actor, reason, operationKey); }

  getShipment(id: string): ShipmentRecord {
    const shipment = this.repo.getShipmentByFulfillmentId(id);
    if (!shipment) throw new ApplicationError('NOT_FOUND', 'Shipment was not created');
    return shipment;
  }

  createShipment(id: string, actor: string, operationKey: string, input: { carrier?: string; trackingNumber?: string; trackingUrl?: string } = {}): ShipmentRecord {
    this.requireYunela(actor);
    const result = this.repo.transaction(() => {
      const f = this.require(id);
      if (f.status !== 'PACKED') throw new ApplicationError('DOMAIN_RULE_VIOLATION', 'Shipment can only be created after PACKED');
      const existing = this.repo.getShipmentByFulfillmentId(id);
      if (existing) return { shipment: existing, created: false };
      const ts = now();
      const s: ShipmentRecord = { id: randomUUID(), fulfillmentId: id, status: 'CREATED', ...(input.carrier ? { carrier: input.carrier.trim() } : {}), ...(input.trackingNumber ? { trackingNumber: input.trackingNumber.trim() } : {}), ...(input.trackingUrl ? { trackingUrl: input.trackingUrl.trim() } : {}), createdAt: ts, updatedAt: ts };
      this.repo.createShipment(s);
      this.appendEventRequired(this.event(id, 'SHIPMENT_CREATED', f.status, f.status, actor, operationKey, ts));
      return { shipment: s, created: true };
    });
    if (result.created) this.track('shipment_created', { fulfillmentId: id, shipmentId: result.shipment.id });
    return result.shipment;
  }

  updateShipmentTracking(id: string, actor: string, operationKey: string, input: { carrier?: string; trackingNumber?: string; trackingUrl?: string }): ShipmentRecord {
    this.requireYunela(actor);
    this.validateTracking(input);
    return this.repo.transaction(() => {
      const f = this.require(id);
      const shipment = this.repo.getShipmentByFulfillmentId(id);
      if (!shipment) throw new ApplicationError('NOT_FOUND', 'Shipment was not created');
      const key = eventKey(id, 'SHIPMENT_TRACKING:' + operationKey);
      if (this.repo.listFulfillmentEvents(id).some(e => e.eventKey === key)) return shipment;
      const ts = now();
      if (!this.repo.updateShipmentTracking(shipment.id, input, ts)) throw new ApplicationError('CONFLICT', 'Shipment changed concurrently');
      const result = this.repo.getShipmentByFulfillmentId(id)!;
      this.appendEventRequired(this.event(id, 'SHIPMENT_TRACKING_UPDATED', f.status, f.status, actor, operationKey, ts));
      return result;
    });
  }

  transitionShipment(id: string, to: ShipmentStatus, actor: string, operationKey: string): ShipmentRecord {
    this.requireYunela(actor);
    const result = this.repo.transaction(() => {
      const f = this.require(id);
      const s = this.repo.getShipmentByFulfillmentId(id);
      if (!s) throw new ApplicationError('NOT_FOUND', 'Shipment was not created');
      const key = eventKey(id, 'SHIPMENT:' + operationKey);
      if (this.repo.listFulfillmentEvents(id).some(e => e.eventKey === key)) return { shipment: s, changed: false };
      const shipmentStatus = s.status as ShipmentStatus;
      if (shipmentStatus === to) return { shipment: s, changed: false };
      const allowed: Record<ShipmentStatus, ShipmentStatus[]> = { CREATED: ['SHIPPED'], SHIPPED: ['DELIVERED', 'FAILED', 'LOST', 'RETURNED'], DELIVERED: ['RETURNED'], FAILED: [], LOST: [], RETURNED: [] };
      if (!allowed[shipmentStatus].includes(to)) throw new ApplicationError('DOMAIN_RULE_VIOLATION', 'Shipment cannot transition from ' + shipmentStatus + ' to ' + to);
      const fulfillmentTarget: Record<ShipmentStatus, FulfillmentStatus | undefined> = { CREATED: undefined, SHIPPED: 'SHIPPED', DELIVERED: 'DELIVERED', FAILED: 'FAILED', LOST: 'LOST', RETURNED: 'RETURNED' };
      const targetFulfillment = fulfillmentTarget[to];
      if (!targetFulfillment) throw new ApplicationError('DOMAIN_RULE_VIOLATION', 'Shipment CREATED cannot transition without Fulfillment orchestration');
      domainGuard(() => assertFulfillmentTransition(f.status, targetFulfillment));
      const ts = now();
      if (!this.repo.updateShipmentStatus(s.id, shipmentStatus, to, ts)) throw new ApplicationError('CONFLICT', 'Shipment changed concurrently');
      if (!this.repo.setFulfillmentStatus(id, f.status, targetFulfillment, ts)) throw new ApplicationError('CONFLICT', 'Fulfillment changed concurrently');
      const resultShipment = this.repo.getShipmentByFulfillmentId(id)!;
      this.appendEventRequired(this.event(id, 'SHIPMENT:' + shipmentStatus + '->' + to, f.status, targetFulfillment, actor, operationKey, ts));
      return { shipment: resultShipment, changed: true };
    });
    if (result.changed) {
      const event: AnalyticsEventName | undefined = to === 'SHIPPED' ? 'order_shipped' : to === 'DELIVERED' ? 'order_delivered' : to === 'FAILED' ? 'delivery_failed' : to === 'RETURNED' ? 'order_returned' : undefined;
      if (event) this.track(event, { fulfillmentId: id, shipmentId: result.shipment.id });
    }
    return result.shipment;
  }
  handleDiscoveryBoxShortage(id: string, shortage: DiscoveryBoxShortage, actor: string, operationKey: string) {
    this.requireYunela(actor);
    return this.repo.transaction(() => {
      const f = this.require(id);
      if (f.status !== 'PENDING') throw new ApplicationError('DOMAIN_RULE_VIOLATION', 'Discovery Box shortage can only be raised from PENDING');
      if (!shortage.originalTeaId || !shortage.proposedReplacementTeaId || shortage.originalTeaId === shortage.proposedReplacementTeaId) throw new ApplicationError('VALIDATION_ERROR', 'A concrete operational replacement tea is required');
      const items = this.repo.listFulfillmentItems(id);
      if (!items.some(i => i.provenanceReference?.includes(shortage.originalTeaId))) throw new ApplicationError('DOMAIN_RULE_VIOLATION', 'Shortage tea is not part of this Fulfillment');
      const replacementLots = this.repo.listLotsForTea(shortage.proposedReplacementTeaId);
      if (!replacementLots.length) throw new ApplicationError('DOMAIN_RULE_VIOLATION', 'Proposed replacement tea has no operationally available lot');
      if (shortage.proposedReplacementLotId && !replacementLots.some(l => l.id === shortage.proposedReplacementLotId)) throw new ApplicationError('DOMAIN_RULE_VIOLATION', 'Proposed replacement lot does not belong to replacement tea or is unavailable');
      const ts = now();
      this.appendEventRequired(this.event(id, JSON.stringify({ type: 'DISCOVERY_BOX_SHORTAGE_PROPOSED', ...shortage }), f.status, 'PENDING_CUSTOMER_APPROVAL', actor, operationKey, ts));
      if (!this.repo.setFulfillmentStatus(id, 'PENDING', 'PENDING_CUSTOMER_APPROVAL', ts)) throw new ApplicationError('CONFLICT', 'Fulfillment changed concurrently');
      return this.require(id);
    });
  }

  recordCustomerApproval(id: string, approval: ReplacementApproval, operationKey: string) {
    return this.repo.transaction(() => {
      const f = this.require(id);
      if (f.status !== 'PENDING_CUSTOMER_APPROVAL') throw new ApplicationError('DOMAIN_RULE_VIOLATION', 'Customer approval is not currently required');
      if (!approval.reason.trim() || !approval.actor.trim()) throw new ApplicationError('VALIDATION_ERROR', 'Approval reason and actor are required');
      const shortage = this.outstandingShortage(id, approval.originalTeaId);
      if (!shortage) throw new ApplicationError('DOMAIN_RULE_VIOLATION', 'No outstanding Discovery Box shortage matches the original tea');
      if (shortage.originalLotId && approval.originalLotId !== shortage.originalLotId) throw new ApplicationError('DOMAIN_RULE_VIOLATION', 'Original lot does not match the recorded shortage');
      if (approval.replacementTeaId !== shortage.proposedReplacementTeaId) throw new ApplicationError('DOMAIN_RULE_VIOLATION', 'Replacement tea is not the operational replacement recorded for the outstanding shortage');
      if (shortage.proposedReplacementLotId && approval.replacementLotId !== shortage.proposedReplacementLotId) throw new ApplicationError('DOMAIN_RULE_VIOLATION', 'Replacement lot does not match the recorded operational replacement');
      const replacementLots = this.repo.listLotsForTea(approval.replacementTeaId);
      if (!replacementLots.length) throw new ApplicationError('DOMAIN_RULE_VIOLATION', 'Replacement tea has no operationally available lot');
      if (approval.replacementLotId && !replacementLots.some(l => l.id === approval.replacementLotId)) throw new ApplicationError('DOMAIN_RULE_VIOLATION', 'Replacement lot does not belong to replacement tea or is unavailable');
      const existingDecision = this.repo.listFulfillmentEvents(id).find(e => { try { const p = JSON.parse(e.eventType) as Record<string, unknown>; return p.type === 'DISCOVERY_BOX_REPLACEMENT_DECISION' && p.originalTeaId === approval.originalTeaId; } catch { return false; } });
      if (existingDecision) return f;
      const ts = approval.timestamp || now();
      this.appendEventRequired(this.event(id, JSON.stringify({ type: 'DISCOVERY_BOX_REPLACEMENT_DECISION', ...approval }), f.status, f.status, approval.actor, operationKey, ts));
      return this.require(id);
    });
  }

  allocateInventory(id: string, operationKey: string) { return this.markReady(id, 'SYSTEM', operationKey); }
  consumeInventory(id: string, operationKey: string) { return this.markPacked(id, 'SYSTEM', operationKey); }
  releaseInventory(id: string, operationKey: string) {
    return this.repo.transaction(() => {
      const f = this.require(id);
      this.release(f);
      this.appendEventRequired(this.event(id, 'INVENTORY_RELEASED', f.status, f.status, 'SYSTEM', operationKey, now()));
      return this.require(id);
    });
  }

  private discoveryBoxShortages(f: FulfillmentRecord): DiscoveryBoxShortage[] {
    const replacements = this.approvedReplacements(f.id);
    const shortages: DiscoveryBoxShortage[] = [];
    for (const item of this.repo.listFulfillmentItems(f.id)) {
      const oi = JSON.parse(item.productSnapshotJson) as OrderItemSnapshot;
      for (const c of oi.discoveryBoxSnapshot?.items ?? []) {
        const r = replacements.find(x => x.originalTeaId === c.teaId);
        const tea = r?.replacementTeaId ?? c.teaId;
        const available = this.repo.listLotsForTea(tea).filter(l => l.supplyStatus !== 'unavailable' && l.supplyStatus !== 'discontinued').reduce((sum, l) => sum + l.inventoryQuantity, 0);
        if (available < item.quantity) {
          const proposed = this.proposedReplacementFor(f.id, c.teaId);
          shortages.push(proposed ?? { originalTeaId: c.teaId, reason: 'required component inventory unavailable', proposedReplacementTeaId: '' });
        }
      }
    }
    return shortages;
  }

  private makeReady(f: FulfillmentRecord) {
    const readiness = this.readiness(f);
    if (!readiness.ready) {
      if (readiness.shortages.length) throw new ApplicationError('INSUFFICIENT_INVENTORY', `Insufficient inventory: ${readiness.shortages.join(', ')}`);
      throw new ApplicationError('DOMAIN_RULE_VIOLATION', 'Fulfillment is not ready');
    }
    const items = this.repo.listFulfillmentItems(f.id);
    const replacements = this.approvedReplacements(f.id);
    const ts = now();
    const totals = new Map<string, InventoryAllocationRecord>();
    for (const item of items) {
      const oi = JSON.parse(item.productSnapshotJson) as OrderItemSnapshot;
      const components = oi.discoveryBoxSnapshot?.items.map(x => ({ teaId: x.teaId, quantity: item.quantity })) ?? [{ teaId: oi.teaId, quantity: item.quantity }];
      for (const component of components) {
        const replacement = replacements.find(r => r.originalTeaId === component.teaId);
        const targetTeaId = replacement?.replacementTeaId ?? component.teaId;
        let remaining = component.quantity;
        const lots = this.repo.listLotsForTea(targetTeaId!).filter(l => l.supplyStatus !== 'unavailable' && l.supplyStatus !== 'discontinued');
        for (const lot of (replacement?.replacementLotId ? lots.sort((a, b) => a.id === replacement.replacementLotId ? -1 : b.id === replacement.replacementLotId ? 1 : 0) : lots)) {
          if (remaining <= 0) break;
          const q = Math.min(remaining, lot.inventoryQuantity);
          if (q > 0 && this.repo.decrementLotInventory(lot.id, q)) {
            const key = `${item.id}:${lot.id}`;
            const existing = totals.get(key);
            if (existing) existing.quantity += q;
            else totals.set(key, { id: randomUUID(), fulfillmentItemId: item.id, teaLotId: lot.id, quantity: q, status: 'RESERVED', allocatedAt: ts, createdAt: ts, updatedAt: ts });
            remaining -= q;
          }
        }
        if (remaining > 0) throw new ApplicationError('INSUFFICIENT_INVENTORY', `Allocation failed for tea ${targetTeaId}`);
        this.repo.setFulfillmentItemAllocationStatus(item.id, 'ALLOCATED', ts);
      }
    }
    for (const allocation of totals.values()) this.repo.createInventoryAllocation(allocation);
  }

  private consume(f: FulfillmentRecord) {
    const ts = now();
    for (const item of this.repo.listFulfillmentItems(f.id)) {
      const allocations = this.repo.listInventoryAllocations(item.id);
      if (!allocations.length) throw new ApplicationError('DOMAIN_RULE_VIOLATION', 'Cannot mark PACKED without allocated inventory');
      for (const a of allocations.filter(x => x.status === 'RESERVED')) if (!this.repo.updateInventoryAllocationStatus(a.id, 'RESERVED', 'CONSUMED', ts)) throw new ApplicationError('CONFLICT', 'Inventory allocation changed concurrently');
      this.repo.setFulfillmentItemAllocationStatus(item.id, 'CONSUMED', ts);
    }
  }

  private release(f: FulfillmentRecord) {
    if (['PACKED', 'SHIPPED', 'DELIVERED', 'RETURNED'].includes(f.status)) throw new ApplicationError('DOMAIN_RULE_VIOLATION', 'Consumed inventory cannot be released through cancellation');
    const ts = now();
    for (const item of this.repo.listFulfillmentItems(f.id)) {
      for (const a of this.repo.listInventoryAllocations(item.id)) {
        if (a.status === 'RESERVED') {
          if (!this.repo.incrementLotInventory(a.teaLotId, a.quantity)) throw new ApplicationError('CONFLICT', 'Inventory release failed');
          if (!this.repo.updateInventoryAllocationStatus(a.id, 'RESERVED', 'RELEASED', ts)) throw new ApplicationError('CONFLICT', 'Inventory allocation changed concurrently');
        }
      }
      if (item.allocationStatus === 'ALLOCATED') this.repo.setFulfillmentItemAllocationStatus(item.id, 'RELEASED', ts);
    }
  }

  private readiness(f: FulfillmentRecord) {
    if (f.status !== 'PENDING' && f.status !== 'PENDING_CUSTOMER_APPROVAL') return { ready: f.status === 'READY', shortages: [] as string[] };
    const items = this.repo.listFulfillmentItems(f.id);
    const replacements = this.approvedReplacements(f.id);
    const shortages: string[] = [];
    for (const item of items) {
      const oi = JSON.parse(item.productSnapshotJson) as OrderItemSnapshot;
      const comps = oi.discoveryBoxSnapshot?.items.map(x => ({ teaId: x.teaId, quantity: item.quantity })) ?? [{ teaId: oi.teaId, quantity: item.quantity }];
      for (const c of comps) {
        const r = replacements.find(x => x.originalTeaId === c.teaId);
        const tea = r?.replacementTeaId ?? c.teaId;
        const available = tea ? this.repo.listLotsForTea(tea).filter(l => l.supplyStatus !== 'unavailable' && l.supplyStatus !== 'discontinued').reduce((s, l) => s + l.inventoryQuantity, 0) : 0;
        if (available < c.quantity) shortages.push(`${tea}:${c.quantity}`);
      }
    }
    return { ready: shortages.length === 0 && f.status === 'PENDING' || (f.status === 'PENDING_CUSTOMER_APPROVAL' && shortages.length === 0 && replacements.length > 0), shortages };
  }

  private approvedReplacements(id: string) {
    return this.repo.listFulfillmentEvents(id).map(e => { try { return JSON.parse(e.eventType) as { type: string; originalTeaId: string; replacementTeaId: string; replacementLotId?: string; customerDecision: string }; } catch { return undefined; } }).filter((e): e is { type: string; originalTeaId: string; replacementTeaId: string; replacementLotId?: string; customerDecision: string } => Boolean(e && e.type === 'DISCOVERY_BOX_REPLACEMENT_DECISION' && e.customerDecision === 'APPROVED'));
  }

  private outstandingShortage(id: string, originalTeaId: string): DiscoveryBoxShortage | undefined {
    const events = this.repo.listFulfillmentEvents(id);
    for (let i = events.length - 1; i >= 0; i -= 1) {
      try {
        const p = JSON.parse(events[i].eventType) as DiscoveryBoxShortage & { type: string };
        if (p.type === 'DISCOVERY_BOX_SHORTAGE_PROPOSED' && p.originalTeaId === originalTeaId) return p;
      } catch { /* ignore non-JSON events */ }
    }
    return undefined;
  }

  private proposedReplacementFor(id: string, originalTeaId: string): DiscoveryBoxShortage | undefined { return this.outstandingShortage(id, originalTeaId); }

  private exception(id: string, to: Extract<FulfillmentStatus, 'FAILED' | 'LOST' | 'CANCELLED' | 'RETURNED'>, actor: string, reason: string, operationKey: string) {
    return this.repo.transaction(() => {
      const f = this.require(id);
      const key = eventKey(id, operationKey);
      if (this.repo.listFulfillmentEvents(id).some(e => e.eventKey === key)) return f;
      domainGuard(() => assertFulfillmentTransition(f.status, to));
      if (to === 'CANCELLED' || (to === 'FAILED' && ['READY', 'PACKING', 'PENDING_CUSTOMER_APPROVAL'].includes(f.status))) this.release(f);
      const ts = now();
      if (!this.repo.setFulfillmentStatus(id, f.status, to, ts)) throw new ApplicationError('CONFLICT', 'Fulfillment changed concurrently');
      const result = this.require(id);
      this.appendEventRequired(this.event(id, JSON.stringify({ type: 'EXCEPTION', reason }), f.status, to, actor, operationKey, ts));
      return result;
    });
  }

  private require(id: string) { const f = this.repo.getFulfillmentById(id); if (!f) throw new ApplicationError('NOT_FOUND', `Fulfillment ${id} was not found`); return f; }
  private event(id: string, type: string, from: string | undefined, to: string | undefined, actor: string, key: string, ts: string): FulfillmentEventRecord { return { id: randomUUID(), fulfillmentId: id, eventType: type, fromStatus: from, toStatus: to, actor, occurredAt: ts, eventKey: eventKey(id, key), createdAt: ts }; }
  private appendEventRequired(event: FulfillmentEventRecord) { const result = this.repo.appendFulfillmentEvent(event); if (!result) { const existing = this.repo.listFulfillmentEvents(event.fulfillmentId).find(e => e.eventKey === event.eventKey); if (!existing) throw new ApplicationError('AUDIT_WRITE_FAILED', `Fulfillment audit event ${event.eventKey} was not persisted`); return existing; } return result; }
  private requireExecutionActor(actor: string) { if (!actor.trim() || (!actor.startsWith('YUNELA:') && !actor.startsWith('SUPPLIER:') && !actor.startsWith('SYSTEM'))) throw new ApplicationError('DOMAIN_RULE_VIOLATION', 'Authorized execution actor required'); }
  private requireReadyActor(actor: string) { if (!actor.trim() || (!actor.startsWith('YUNELA:') && !actor.startsWith('SYSTEM'))) throw new ApplicationError('DOMAIN_RULE_VIOLATION', 'YUNELA or SYSTEM authority required for READY'); }
  private requireYunela(actor: string) { if (!actor.startsWith('YUNELA:') && !actor.startsWith('OPERATOR:') && !actor.startsWith('SYSTEM')) throw new ApplicationError('DOMAIN_RULE_VIOLATION', 'YUNELA/operator-controlled operation required'); }
  private validateTracking(input: { carrier?: string; trackingNumber?: string; trackingUrl?: string }) {\n    if (input.carrier === undefined && input.trackingNumber === undefined && input.trackingUrl === undefined) throw new ApplicationError('VALIDATION_ERROR', 'At least one tracking field is required');\n    if (input.carrier !== undefined && (!input.carrier.trim() || input.carrier.trim().length > 128)) throw new ApplicationError('VALIDATION_ERROR', 'carrier must contain 1-128 characters');\n    if (input.trackingNumber !== undefined && (!input.trackingNumber.trim() || input.trackingNumber.trim().length > 256)) throw new ApplicationError('VALIDATION_ERROR', 'trackingNumber must contain 1-256 characters');\n    if (input.trackingUrl !== undefined) { try { const url = new URL(input.trackingUrl.trim()); if (!['http:', 'https:'].includes(url.protocol)) throw new Error(); } catch { throw new ApplicationError('VALIDATION_ERROR', 'trackingUrl must be a valid HTTP(S) URL'); } }\n  }\n  private track(event: AnalyticsEventName, payload: AnalyticsPayload) { this.analytics?.track(event, payload); }
}
