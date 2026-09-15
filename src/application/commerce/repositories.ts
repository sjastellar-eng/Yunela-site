import type { Cart, Order, OrderItemSnapshot, Purchase } from '../../contracts/commerce';
import type { PaymentAttempt } from '../../contracts/payment';

export interface CartRepository { create(cart: Cart): void; getById(id: string): Cart | undefined; getByCustomerId(customerId: string): Cart | undefined; save(cart: Cart): void; }
export interface OrderRepository { create(order: Order, idempotencyKey: string): void; getById(id: string): Order | undefined; getByIdempotency(customerId: string, idempotencyKey: string): Order | undefined; getItems(orderId: string): OrderItemSnapshot[]; }
export interface PurchaseRepository { create(purchase: Purchase): void; getByOrderId(orderId: string): Purchase | undefined; }

export interface PaymentAttemptRepository {
  create(attempt: PaymentAttempt): void;
  getById(id: string): PaymentAttempt | undefined;
  getByOrderAndIdempotency(orderId: string, idempotencyKey: string): PaymentAttempt | undefined;
  getByProviderInvoiceId(providerInvoiceId: string): PaymentAttempt | undefined;
  save(attempt: PaymentAttempt): void;
  recordTerminalOrProviderState(input: { id: string; state: PaymentAttempt['state']; providerStatus: string; providerModifiedAt: string; eventFingerprint: string; providerReference?: string }): void;
  confirmSuccess(input: { attemptId: string; providerStatus: string; providerModifiedAt: string; eventFingerprint: string; providerReference: string; confirmedAt: string; purchase: Purchase }): 'created' | 'duplicate';
}
