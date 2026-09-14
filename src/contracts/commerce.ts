export type CurrencyCode = string;
export type MinorUnitAmount = number & { readonly __brand: 'MinorUnitAmount' };

export interface Money {
  amount: MinorUnitAmount;
  currency: CurrencyCode;
}

export function createMoney(amount: number, currency: CurrencyCode): Money {
  if (!Number.isInteger(amount)) throw new Error('Money amount must be an integer number of minor units');
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error('Currency must be a three-letter uppercase ISO 4217 code');
  return { amount: amount as MinorUnitAmount, currency };
}

/** Future-oriented primitives retained for compatibility; D2 does not run payment/fulfillment state machines. */
export type PaymentStatus = 'pending' | 'authorized' | 'paid' | 'failed' | 'refunded';
export type FulfillmentStatus = 'unfulfilled' | 'processing' | 'fulfilled' | 'cancelled';
export type OrderStatus = 'created' | 'confirmed' | 'cancelled';

export interface CartItem {
  id: string;
  sku: string;
  teaId?: string;
  quantity: number;
  unitPrice: Money;
  recommendationHistoryId?: string;
  discoveryBoxId?: string;
}

export interface Cart {
  id: string;
  customerId: string;
  items: CartItem[];
  subtotal: Money;
  discounts: Money;
  total: Money;
  createdAt: string;
  updatedAt: string;
}

export interface ShippingDetails {
  recipientName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  region?: string;
  postalCode: string;
  countryCode: string;
  phone?: string;
}

export interface DiscoveryBoxItemSnapshot {
  teaId: string;
  teaName: string;
  classification: 'MATCH' | 'STRETCH' | 'WILDCARD';
  position: number;
  score: number;
  reasons: string[];
}

export interface DiscoveryBoxSnapshot {
  discoveryBoxId: string;
  algorithmVersion: string;
  selectionVersion: string;
  items: DiscoveryBoxItemSnapshot[];
}

export interface OrderItemSnapshot {
  id: string;
  sku: string;
  teaId?: string;
  teaName: string;
  quantity: number;
  unitPrice: Money;
  lineTotal: Money;
  recommendationHistoryId?: string;
  discoveryBoxSnapshot?: DiscoveryBoxSnapshot;
}

export interface Order {
  id: string;
  customerId: string;
  status: OrderStatus;
  items: OrderItemSnapshot[];
  pricingSnapshot: { subtotal: Money; discounts: Money; shipping: Money; total: Money };
  shipping: ShippingDetails;
  createdAt: string;
  updatedAt: string;
}

export interface Purchase {
  id: string;
  orderId: string;
  customerId: string;
  amount: Money;
  confirmedAt: string;
}

export interface CreateOrderRequest {
  cartId: string;
  shipping: ShippingDetails;
  idempotencyKey: string;
}
