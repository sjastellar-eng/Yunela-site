import type Database from 'better-sqlite3';

export const FULFILLMENT_STATUSES = [
  'PENDING',
  'READY',
  'PENDING_CUSTOMER_APPROVAL',
  'PACKING',
  'PACKED',
  'SHIPPED',
  'DELIVERED',
  'FAILED',
  'LOST',
  'RETURNED',
  'CANCELLED',
] as const;

export type FulfillmentStatus = typeof FULFILLMENT_STATUSES[number];
export type FulfillmentAllocationStatus = 'PENDING' | 'ALLOCATED' | 'CONSUMED' | 'RELEASED';
export type InventoryAllocationStatus = 'RESERVED' | 'CONSUMED' | 'RELEASED';

export interface FulfillmentRecord {
  id: string;
  orderId: string;
  purchaseId: string;
  customerId: string;
  status: FulfillmentStatus;
  shippingSnapshotJson: string;
  itemsSnapshotJson: string;
  failureCode?: string;
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FulfillmentItemRecord {
  id: string;
  fulfillmentId: string;
  orderItemId: string;
  sku: string;
  quantity: number;
  productSnapshotJson: string;
  provenanceReference?: string;
  allocationStatus: FulfillmentAllocationStatus;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryAllocationRecord {
  id: string;
  fulfillmentItemId: string;
  teaLotId: string;
  quantity: number;
  status: InventoryAllocationStatus;
  allocatedAt?: string;
  consumedAt?: string;
  releasedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ShipmentRecord {
  id: string;
  fulfillmentId: string;
  status: string;
  carrier?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  shippedAt?: string;
  deliveredAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FulfillmentEventRecord {
  id: string;
  fulfillmentId: string;
  eventType: string;
  fromStatus?: string;
  toStatus?: string;
  actor: string;
  occurredAt: string;
  eventKey: string;
  createdAt: string;
}

export interface FulfillmentRepository {
  createFulfillment(record: FulfillmentRecord): void;
  getFulfillmentById(id: string): FulfillmentRecord | undefined;
  createFulfillmentItem(record: FulfillmentItemRecord): void;
  listFulfillmentItems(fulfillmentId: string): FulfillmentItemRecord[];
  createInventoryAllocation(record: InventoryAllocationRecord): void;
  listInventoryAllocations(fulfillmentItemId: string): InventoryAllocationRecord[];
  createShipment(record: ShipmentRecord): void;
  getShipmentByFulfillmentId(fulfillmentId: string): ShipmentRecord | undefined;
  appendFulfillmentEvent(record: FulfillmentEventRecord): void;
  listFulfillmentEvents(fulfillmentId: string): FulfillmentEventRecord[];
}

export type FulfillmentDatabase = Database.Database;
