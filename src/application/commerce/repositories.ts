import type { Cart, CartItem, Order, OrderItemSnapshot, Purchase } from '../../contracts/commerce';

export interface CartRepository {
  create(cart: Cart): void;
  getById(id: string): Cart | undefined;
  getByCustomerId(customerId: string): Cart | undefined;
  save(cart: Cart): void;
}

export interface OrderRepository {
  create(order: Order): void;
  getById(id: string): Order | undefined;
  getByIdempotency(customerId: string, idempotencyKey: string): Order | undefined;
  getItems(orderId: string): OrderItemSnapshot[];
}

export interface PurchaseRepository {
  create(purchase: Purchase): void;
  getByOrderId(orderId: string): Purchase | undefined;
}
