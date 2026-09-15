import Database from 'better-sqlite3';
import type {
  FulfillmentEventRecord,
  FulfillmentItemRecord,
  FulfillmentRecord,
  FulfillmentRepository,
  InventoryAllocationRecord,
  ShipmentRecord,
} from './repositories';

function optionalString(value: unknown): string | undefined {
  return value === null || value === undefined ? undefined : String(value);
}

function mapFulfillment(row: Record<string, unknown>): FulfillmentRecord {
  return {
    id: String(row.id),
    orderId: String(row.order_id),
    purchaseId: String(row.purchase_id),
    customerId: String(row.customer_id),
    status: row.status as FulfillmentRecord['status'],
    shippingSnapshotJson: String(row.shipping_snapshot_json),
    itemsSnapshotJson: String(row.items_snapshot_json),
    ...(optionalString(row.failure_code) ? { failureCode: optionalString(row.failure_code) } : {}),
    ...(optionalString(row.failure_reason) ? { failureReason: optionalString(row.failure_reason) } : {}),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapFulfillmentItem(row: Record<string, unknown>): FulfillmentItemRecord {
  return {
    id: String(row.id),
    fulfillmentId: String(row.fulfillment_id),
    orderItemId: String(row.order_item_id),
    sku: String(row.sku),
    quantity: Number(row.quantity),
    productSnapshotJson: String(row.product_snapshot_json),
    ...(optionalString(row.provenance_reference) ? { provenanceReference: optionalString(row.provenance_reference) } : {}),
    allocationStatus: row.allocation_status as FulfillmentItemRecord['allocationStatus'],
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapInventoryAllocation(row: Record<string, unknown>): InventoryAllocationRecord {
  return {
    id: String(row.id),
    fulfillmentItemId: String(row.fulfillment_item_id),
    teaLotId: String(row.tea_lot_id),
    quantity: Number(row.quantity),
    status: row.status as InventoryAllocationRecord['status'],
    ...(optionalString(row.allocated_at) ? { allocatedAt: optionalString(row.allocated_at) } : {}),
    ...(optionalString(row.consumed_at) ? { consumedAt: optionalString(row.consumed_at) } : {}),
    ...(optionalString(row.released_at) ? { releasedAt: optionalString(row.released_at) } : {}),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapShipment(row: Record<string, unknown>): ShipmentRecord {
  return {
    id: String(row.id),
    fulfillmentId: String(row.fulfillment_id),
    status: String(row.status),
    ...(optionalString(row.carrier) ? { carrier: optionalString(row.carrier) } : {}),
    ...(optionalString(row.tracking_number) ? { trackingNumber: optionalString(row.tracking_number) } : {}),
    ...(optionalString(row.tracking_url) ? { trackingUrl: optionalString(row.tracking_url) } : {}),
    ...(optionalString(row.shipped_at) ? { shippedAt: optionalString(row.shipped_at) } : {}),
    ...(optionalString(row.delivered_at) ? { deliveredAt: optionalString(row.delivered_at) } : {}),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapEvent(row: Record<string, unknown>): FulfillmentEventRecord {
  return {
    id: String(row.id),
    fulfillmentId: String(row.fulfillment_id),
    eventType: String(row.event_type),
    ...(optionalString(row.from_status) ? { fromStatus: optionalString(row.from_status) } : {}),
    ...(optionalString(row.to_status) ? { toStatus: optionalString(row.to_status) } : {}),
    actor: String(row.actor),
    occurredAt: String(row.occurred_at),
    eventKey: String(row.event_key),
    createdAt: String(row.created_at),
  };
}

export class SqliteFulfillmentRepository implements FulfillmentRepository {
  constructor(private readonly db: Database.Database) {}

  createFulfillment(record: FulfillmentRecord): void {
    this.db.prepare(`
      INSERT INTO fulfillments (
        id, order_id, purchase_id, customer_id, status,
        shipping_snapshot_json, items_snapshot_json, failure_code, failure_reason,
        created_at, updated_at
      ) VALUES (
        @id, @orderId, @purchaseId, @customerId, @status,
        @shippingSnapshotJson, @itemsSnapshotJson, @failureCode, @failureReason,
        @createdAt, @updatedAt
      )
    `).run({
      id: record.id,
      orderId: record.orderId,
      purchaseId: record.purchaseId,
      customerId: record.customerId,
      status: record.status,
      shippingSnapshotJson: record.shippingSnapshotJson,
      itemsSnapshotJson: record.itemsSnapshotJson,
      failureCode: record.failureCode ?? null,
      failureReason: record.failureReason ?? null,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  getFulfillmentById(id: string): FulfillmentRecord | undefined {
    const row = this.db.prepare('SELECT * FROM fulfillments WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    return row ? mapFulfillment(row) : undefined;
  }

  createFulfillmentItem(record: FulfillmentItemRecord): void {
    this.db.prepare(`
      INSERT INTO fulfillment_items (
        id, fulfillment_id, order_item_id, sku, quantity, product_snapshot_json,
        provenance_reference, allocation_status, created_at, updated_at
      ) VALUES (
        @id, @fulfillmentId, @orderItemId, @sku, @quantity, @productSnapshotJson,
        @provenanceReference, @allocationStatus, @createdAt, @updatedAt
      )
    `).run({
      id: record.id,
      fulfillmentId: record.fulfillmentId,
      orderItemId: record.orderItemId,
      sku: record.sku,
      quantity: record.quantity,
      productSnapshotJson: record.productSnapshotJson,
      provenanceReference: record.provenanceReference ?? null,
      allocationStatus: record.allocationStatus,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  listFulfillmentItems(fulfillmentId: string): FulfillmentItemRecord[] {
    const rows = this.db.prepare(`
      SELECT * FROM fulfillment_items WHERE fulfillment_id = ? ORDER BY created_at, id
    `).all(fulfillmentId) as Array<Record<string, unknown>>;
    return rows.map(mapFulfillmentItem);
  }

  createInventoryAllocation(record: InventoryAllocationRecord): void {
    this.db.prepare(`
      INSERT INTO inventory_allocations (
        id, fulfillment_item_id, tea_lot_id, quantity, status,
        allocated_at, consumed_at, released_at, created_at, updated_at
      ) VALUES (
        @id, @fulfillmentItemId, @teaLotId, @quantity, @status,
        @allocatedAt, @consumedAt, @releasedAt, @createdAt, @updatedAt
      )
    `).run({
      id: record.id,
      fulfillmentItemId: record.fulfillmentItemId,
      teaLotId: record.teaLotId,
      quantity: record.quantity,
      status: record.status,
      allocatedAt: record.allocatedAt ?? null,
      consumedAt: record.consumedAt ?? null,
      releasedAt: record.releasedAt ?? null,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  listInventoryAllocations(fulfillmentItemId: string): InventoryAllocationRecord[] {
    const rows = this.db.prepare(`
      SELECT * FROM inventory_allocations WHERE fulfillment_item_id = ? ORDER BY created_at, id
    `).all(fulfillmentItemId) as Array<Record<string, unknown>>;
    return rows.map(mapInventoryAllocation);
  }

  createShipment(record: ShipmentRecord): void {
    this.db.prepare(`
      INSERT INTO shipments (
        id, fulfillment_id, status, carrier, tracking_number, tracking_url,
        shipped_at, delivered_at, created_at, updated_at
      ) VALUES (
        @id, @fulfillmentId, @status, @carrier, @trackingNumber, @trackingUrl,
        @shippedAt, @deliveredAt, @createdAt, @updatedAt
      )
    `).run({
      id: record.id,
      fulfillmentId: record.fulfillmentId,
      status: record.status,
      carrier: record.carrier ?? null,
      trackingNumber: record.trackingNumber ?? null,
      trackingUrl: record.trackingUrl ?? null,
      shippedAt: record.shippedAt ?? null,
      deliveredAt: record.deliveredAt ?? null,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  getShipmentByFulfillmentId(fulfillmentId: string): ShipmentRecord | undefined {
    const row = this.db.prepare('SELECT * FROM shipments WHERE fulfillment_id = ?').get(fulfillmentId) as Record<string, unknown> | undefined;
    return row ? mapShipment(row) : undefined;
  }

  appendFulfillmentEvent(record: FulfillmentEventRecord): void {
    this.db.prepare(`
      INSERT INTO fulfillment_events (
        id, fulfillment_id, event_type, from_status, to_status,
        actor, occurred_at, event_key, created_at
      ) VALUES (
        @id, @fulfillmentId, @eventType, @fromStatus, @toStatus,
        @actor, @occurredAt, @eventKey, @createdAt
      )
    `).run({
      id: record.id,
      fulfillmentId: record.fulfillmentId,
      eventType: record.eventType,
      fromStatus: record.fromStatus ?? null,
      toStatus: record.toStatus ?? null,
      actor: record.actor,
      occurredAt: record.occurredAt,
      eventKey: record.eventKey,
      createdAt: record.createdAt,
    });
  }

  listFulfillmentEvents(fulfillmentId: string): FulfillmentEventRecord[] {
    const rows = this.db.prepare(`
      SELECT * FROM fulfillment_events WHERE fulfillment_id = ? ORDER BY occurred_at, id
    `).all(fulfillmentId) as Array<Record<string, unknown>>;
    return rows.map(mapEvent);
  }
}
