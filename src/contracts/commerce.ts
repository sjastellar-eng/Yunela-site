export type PaymentStatus = 'pending' | 'authorized' | 'paid' | 'failed' | 'refunded';
export type FulfillmentStatus = 'unfulfilled' | 'processing' | 'fulfilled' | 'cancelled';
export type OrderStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed';

export interface CartItem {
  id: string;
  sku: string;
  teaId: string;
  quantity: number;
  unitPrice: number;
}

export interface Cart {
  id: string;
  customerId?: string;
  sessionId?: string;
  items: CartItem[];
  subtotal: number;
  discounts: number;
  total: number;
}

export interface OrderItemSnapshot {
  sku: string;
  teaId: string;
  teaName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface Order {
  id: string;
  customerId?: string;
  items: OrderItemSnapshot[];
  pricingSnapshot: {
    subtotal: number;
    discounts: number;
    shipping: number;
    total: number;
    currency: string;
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
