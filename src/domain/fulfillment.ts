export class FulfillmentDomainError extends Error {
  constructor(message: string) { super(message); this.name = 'FulfillmentDomainError'; }
}

export const FULFILLMENT_STATUSES = [
  'PENDING','READY','PENDING_CUSTOMER_APPROVAL','PACKING','PACKED','SHIPPED','DELIVERED',
  'FAILED','LOST','RETURNED','CANCELLED',
] as const;
export type FulfillmentStatus = typeof FULFILLMENT_STATUSES[number];

export const SHIPMENT_STATUSES = ['CREATED','SHIPPED','DELIVERED','FAILED','LOST','RETURNED'] as const;
export type ShipmentStatus = typeof SHIPMENT_STATUSES[number];

const transitions: Record<FulfillmentStatus, readonly FulfillmentStatus[]> = {
  PENDING: ['READY','PENDING_CUSTOMER_APPROVAL','FAILED','CANCELLED'],
  READY: ['PACKING','FAILED','CANCELLED'],
  PENDING_CUSTOMER_APPROVAL: ['READY','FAILED','CANCELLED'],
  PACKING: ['PACKED','FAILED','CANCELLED'],
  PACKED: ['SHIPPED','FAILED','LOST','RETURNED'],
  SHIPPED: ['DELIVERED','FAILED','LOST','RETURNED'],
  DELIVERED: ['RETURNED'],
  FAILED: [], LOST: [], RETURNED: [], CANCELLED: [],
};

export function isValidFulfillmentTransition(from: FulfillmentStatus, to: FulfillmentStatus): boolean {
  return transitions[from].includes(to);
}
export function assertFulfillmentTransition(from: FulfillmentStatus, to: FulfillmentStatus): void {
  if (!isValidFulfillmentTransition(from, to)) throw new FulfillmentDomainError(`Fulfillment cannot transition from ${from} to ${to}`);
}
export function isTerminalFulfillmentStatus(status: FulfillmentStatus): boolean {
  return status === 'DELIVERED' || status === 'FAILED' || status === 'LOST' || status === 'RETURNED' || status === 'CANCELLED';
}
export function assertDiscoveryBoxComposition(items: readonly { classification: string }[]): void {
  const counts = { MATCH: 0, STRETCH: 0, WILDCARD: 0 };
  for (const item of items) if (item.classification in counts) counts[item.classification as keyof typeof counts] += 1;
  if (items.length !== 6 || counts.MATCH !== 3 || counts.STRETCH !== 2 || counts.WILDCARD !== 1) {
    throw new FulfillmentDomainError('Discovery Box execution composition must be exactly 3 MATCH, 2 STRETCH and 1 WILDCARD');
  }
}

export interface FulfillmentSnapshot {
  orderId: string;
  purchaseId: string;
  customerId: string;
  shipping: unknown;
  items: unknown[];
}
