import { describe, expect, it } from 'vitest';
import { createMoney } from '../../contracts/commerce';
import type { CustomerRepository } from '../repositories';
import type { OrderRepository, PaymentAttemptRepository } from '../commerce/repositories';
import type { AnalyticsTracker } from '../../contracts/analytics';
import type { Order, Purchase } from '../../contracts/commerce';
import type { MonoInvoiceEvent, MonoPaymentAdapter, PaymentAttempt } from '../../contracts/payment';
import { PaymentService } from './service';

class FakeCustomers implements CustomerRepository {
  constructor(private readonly ids = new Set(['customer-1'])) {}
  create(): void {} update() { return undefined; }
  getById(id: string) { return this.ids.has(id) ? ({ id, email: `${id}@example.test`, createdAt: new Date().toISOString() }) : undefined; }
}

class FakeOrders implements OrderRepository {
  constructor(public readonly order: Order) {}
  create(): void {} getById(id: string) { return id === this.order.id ? this.order : undefined; }
  getByIdempotency() { return undefined; } getItems() { return this.order.items; }
}

class FakeAttempts implements PaymentAttemptRepository {
  attempts = new Map<string, PaymentAttempt>();
  purchase?: Purchase;
  constructor(private readonly orders: FakeOrders) {}
  create(attempt: PaymentAttempt) { this.attempts.set(attempt.id, { ...attempt }); }
  getById(id: string) { const value = this.attempts.get(id); return value ? { ...value } : undefined; }
  getByOrderAndIdempotency(orderId: string, key: string) { return [...this.attempts.values()].find((a) => a.orderId === orderId && a.idempotencyKey === key); }
  getByProviderInvoiceId(invoiceId: string) { return [...this.attempts.values()].find((a) => a.providerInvoiceId === invoiceId); }
  save(attempt: PaymentAttempt) { this.attempts.set(attempt.id, { ...attempt }); }
  recordTerminalOrProviderState(input: { id: string; state: PaymentAttempt['state']; providerStatus: string; providerModifiedAt: string; eventFingerprint: string; providerReference?: string }) { const current = this.attempts.get(input.id)!; this.save({ ...current, state: input.state, providerStatus: input.providerStatus, providerModifiedAt: input.providerModifiedAt, providerEventFingerprint: input.eventFingerprint, providerEventReference: input.providerReference, updatedAt: new Date().toISOString() }); }
  confirmSuccess(input: { attemptId: string; providerStatus: string; providerModifiedAt: string; eventFingerprint: string; providerReference: string; confirmedAt: string; purchase: Purchase }) {
    if (this.purchase) return 'duplicate' as const;
    const attempt = this.attempts.get(input.attemptId)!;
    this.save({ ...attempt, state: 'SUCCEEDED', providerStatus: input.providerStatus, providerModifiedAt: input.providerModifiedAt, providerEventFingerprint: input.eventFingerprint, providerEventReference: input.providerReference, confirmedAt: input.confirmedAt, updatedAt: input.confirmedAt });
    this.purchase = input.purchase; this.orders.order.status = 'confirmed'; return 'created' as const;
  }
}

class FakeMono implements MonoPaymentAdapter {
  invoiceCalls = 0;
  async createInvoice() { this.invoiceCalls += 1; return { providerInvoiceId: 'mono-invoice-1', paymentPageUrl: 'https://pay.example/mono-invoice-1' }; }
  async verifyWebhookSignature() { return true; }
}

function makeOrder(): Order { return { id: 'order-1', customerId: 'customer-1', status: 'created', items: [], pricingSnapshot: { subtotal: createMoney(12500, 'UAH'), discounts: createMoney(0, 'UAH'), shipping: createMoney(0, 'UAH'), total: createMoney(12500, 'UAH') }, shipping: { recipientName: 'Test', addressLine1: 'Street 1', city: 'Kyiv', postalCode: '01001', countryCode: 'UA' }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }; }
function makeEvent(status: MonoInvoiceEvent['status'], modifiedDate: string): string { return JSON.stringify({ invoiceId: 'mono-invoice-1', status, amount: 12500, ccy: 980, modifiedDate, reference: 'merchant-reference', createdDate: modifiedDate }); }

function setup() {
  const orders = new FakeOrders(makeOrder()); const attempts = new FakeAttempts(orders); const mono = new FakeMono(); const events: Array<{ name: string }> = []; const analytics: AnalyticsTracker = { track(name) { events.push({ name }); } };
  const service = new PaymentService(attempts, orders, new FakeCustomers(), mono, analytics, 'https://example.test/api/v1/payments/mono/webhook');
  return { service, orders, attempts, mono, events };
}

describe('D3.1 Mono payment service', () => {
  it('uses authoritative Order total and initiation idempotency', async () => {
    const { service, attempts, mono } = setup();
    const first = await service.createPaymentAttempt('customer-1', 'order-1', 'pay-key-1');
    const second = await service.createPaymentAttempt('customer-1', 'order-1', 'pay-key-1');
    expect(first.requestedAmount.amount).toBe(12500);
    expect(first.requestedAmount.currency).toBe('UAH');
    expect(first.state).toBe('REQUIRES_ACTION');
    expect(first.providerInvoiceId).toBe('mono-invoice-1');
    expect(second.id).toBe(first.id);
    expect(mono.invoiceCalls).toBe(1);
    expect(attempts.getById(first.id)?.merchantReference).toBe(first.merchantReference);
  });

  it('rejects invalid signature before commercial mutation', async () => {
    const { service, attempts } = setup();
    const attempt = await service.createPaymentAttempt('customer-1', 'order-1', 'pay-key-1');
    const mono = (service as unknown as { mono: FakeMono }).mono;
    mono.verifyWebhookSignature = async () => false;
    await expect(service.handleMonoWebhook(Buffer.from(makeEvent('success', '2026-09-15T10:00:00Z')), 'bad')).rejects.toThrow('Invalid Mono webhook signature');
    expect(attempts.getById(attempt.id)?.state).toBe('REQUIRES_ACTION');
  });

  it('accepts one authoritative success and atomically confirms Order with one Purchase', async () => {
    const { service, attempts, orders, events } = setup();
    const attempt = await service.createPaymentAttempt('customer-1', 'order-1', 'pay-key-1');
    const event = makeEvent('success', '2026-09-15T10:01:00Z').replace('merchant-reference', attempt.merchantReference);
    const result = await service.handleMonoWebhook(Buffer.from(event), 'valid');
    expect(result.status).toBe('accepted');
    expect(attempts.getById(attempt.id)?.state).toBe('SUCCEEDED');
    expect(orders.order.status).toBe('confirmed');
    expect(attempts.purchase?.amount.amount).toBe(12500);
    expect(attempts.purchase?.paymentAttemptId).toBe(attempt.id);
    expect(events.filter((event) => event.name === 'purchase')).toHaveLength(1);
  });

  it('ignores stale webhook events and duplicate success', async () => {
    const { service, attempts, events } = setup();
    const attempt = await service.createPaymentAttempt('customer-1', 'order-1', 'pay-key-1');
    const newer = makeEvent('success', '2026-09-15T10:02:00Z').replace('merchant-reference', attempt.merchantReference);
    await service.handleMonoWebhook(Buffer.from(newer), 'valid');
    const stale = makeEvent('processing', '2026-09-15T10:01:00Z').replace('merchant-reference', attempt.merchantReference);
    expect((await service.handleMonoWebhook(Buffer.from(stale), 'valid')).status).toBe('ignored');
    const duplicate = makeEvent('success', '2026-09-15T10:02:00Z').replace('merchant-reference', attempt.merchantReference);
    expect((await service.handleMonoWebhook(Buffer.from(duplicate), 'valid')).status).toBe('ignored');
    expect(events.filter((event) => event.name === 'purchase')).toHaveLength(1);
    expect(attempts.purchase?.orderId).toBe('order-1');
  });

  it('maps provider failure to DECLINED without creating Purchase or confirming Order', async () => {
    const { service, attempts, orders } = setup();
    const attempt = await service.createPaymentAttempt('customer-1', 'order-1', 'pay-key-1');
    const event = makeEvent('failure', '2026-09-15T10:03:00Z').replace('merchant-reference', attempt.merchantReference);
    await service.handleMonoWebhook(Buffer.from(event), 'valid');
    expect(attempts.getById(attempt.id)?.state).toBe('DECLINED');
    expect(attempts.purchase).toBeUndefined();
    expect(orders.order.status).toBe('created');
  });
});
