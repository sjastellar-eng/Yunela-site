export type CurrencyCode = string;

/** Monetary amounts are integer minor units (for example 1999 USD = $19.99). */
export type MinorUnitAmount = number & { readonly __brand: 'MinorUnitAmount' };

export interface Money {
  amount: MinorUnitAmount;
  currency: CurrencyCode;
}

export function createMoney(amount: number, currency: CurrencyCode): Money {
  if (!Number.isInteger(amount)) {
    throw new Error('Money amount must be an integer number of minor units');
  }

  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new Error('Currency must be a three-letter uppercase ISO 4217 code');
  }

  return { amount: amount as MinorUnitAmount, currency };
}

export type PaymentStatus = 'pending' | 'authorized' | 'paid' | 'failed' | 'refunded';
export type FulfillmentStatus = 'unfulfilled' | 'processing' | 'fulfilled' | 'cancelled';
export type OrderStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed';

export interface CartItem {
  id: string;
  sku: string;
  teaId: string;
  quantity: number;
  unitPrice: Money;
}

export interface Cart {
  id: string;
  customerId?: string;
  sessionId?: string;
  items: CartItem[];
  subtotal: Money;
  discounts: Money;
  total: Money;
}

export interface OrderItemSnapshot {
  sku: string;
  teaId: string;
  teaName: string;
  quantity: number;
  unitPrice: Money;
  lineTotal: Money;
}

export interface Order {
  id: string;
  customerId?: string;
  items: OrderItemSnapshot[];
  pricingSnapshot: {
    subtotal: Money;
    discounts: Money;
    shipping: Money;
    total: Money;
  };
  shipping: Record<string, unknown>;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
}

/** Server-side commerce boundary: client input is never authoritative for price or totals. */
export interface CreateOrderRequest {
  cartId: string;
  shipping: Record<string, unknown>;
  idempotencyKey: string;
}
