import { createHash, randomUUID } from 'node:crypto';
import type { AnalyticsTracker } from '../../contracts/analytics';
import { createMoney } from '../../contracts/commerce';
import type { Order, Purchase } from '../../contracts/commerce';
import type { MonoInvoiceEvent, MonoPaymentAdapter, PaymentAttempt, PaymentAttemptState } from '../../contracts/payment';
import type { CustomerRepository } from '../repositories';
import type { OrderRepository, PaymentAttemptRepository } from '../commerce/repositories';
import { ApplicationError } from '../errors';

const UAH = 'UAH';
const MONO_CCY = 980;
const TERMINAL = new Set<PaymentAttemptState>(['SUCCEEDED', 'DECLINED', 'EXPIRED', 'FAILED', 'CANCELLED']);

export class PaymentService {
  constructor(private readonly attempts: PaymentAttemptRepository, private readonly orders: OrderRepository, private readonly customers: CustomerRepository, private readonly mono: MonoPaymentAdapter, private readonly analytics: AnalyticsTracker, private readonly webhookUrl: string, private readonly redirectUrl?: string) {}

  async createPaymentAttempt(customerId: string, orderId: string, idempotencyKey: string): Promise<PaymentAttempt> {
    this.assertCustomer(customerId);
    if (!idempotencyKey.trim() || idempotencyKey.length > 128) throw new ApplicationError('VALIDATION_ERROR', 'Idempotency-Key is required and must be at most 128 characters');
    const order = this.getOwnedOrder(customerId, orderId);
    if (order.status !== 'created') throw new ApplicationError('CONFLICT', 'Only CREATED orders can start a payment attempt');
    const existing = this.attempts.getByOrderAndIdempotency(orderId, idempotencyKey);
    if (existing) return existing;
    const now = new Date().toISOString();
    const attempt: PaymentAttempt = { id: randomUUID(), orderId, customerId, provider: 'MONO', merchantReference: randomUUID(), requestedAmount: createMoney(order.pricingSnapshot.total.amount, UAH), requestedCurrency: UAH, state: 'CREATED', idempotencyKey, createdAt: now, updatedAt: now };
    this.attempts.create(attempt);
    try {
      const invoice = await this.mono.createInvoice({ amount: attempt.requestedAmount.amount, currency: MONO_CCY, merchantReference: attempt.merchantReference, redirectUrl: this.redirectUrl, webHookUrl: this.webhookUrl });
      const current = this.attempts.getById(attempt.id);
      if (!current || TERMINAL.has(current.state)) return current ?? attempt;
      const updated = { ...current, providerInvoiceId: invoice.providerInvoiceId, paymentPageUrl: invoice.paymentPageUrl, state: 'REQUIRES_ACTION' as const, updatedAt: new Date().toISOString() };
      this.attempts.save(updated);
      return updated;
    } catch (error) {
      const current = this.attempts.getById(attempt.id);
      if (current && !TERMINAL.has(current.state)) this.attempts.recordTerminalOrProviderState({ id: attempt.id, state: 'FAILED', providerStatus: 'integration_failure', providerModifiedAt: new Date().toISOString(), eventFingerprint: createHash('sha256').update(`${attempt.id}:integration_failure`).digest('hex') });
      throw new ApplicationError('PERSISTENCE_ERROR', 'Mono invoice creation failed', { cause: error });
    }
  }

  getPaymentAttempt(customerId: string, id: string): PaymentAttempt { this.assertCustomer(customerId); const attempt = this.attempts.getById(id); if (!attempt) throw new ApplicationError('NOT_FOUND', `Payment attempt ${id} was not found`); if (attempt.customerId !== customerId) throw new ApplicationError('PURCHASE_NOT_AUTHORIZED', 'Payment attempt is not owned by the customer'); return attempt; }

  async handleMonoWebhook(rawBody: Buffer, signature: string): Promise<{ status: 'accepted' | 'ignored' }> {
    if (!(await this.mono.verifyWebhookSignature(rawBody, signature))) throw new ApplicationError('PURCHASE_NOT_AUTHORIZED', 'Invalid Mono webhook signature');
    let event: MonoInvoiceEvent;
    try { event = JSON.parse(rawBody.toString('utf8')) as MonoInvoiceEvent; } catch { throw new ApplicationError('VALIDATION_ERROR', 'Malformed Mono webhook JSON'); }
    this.validateEventShape(event);
    const attempt = this.attempts.getByProviderInvoiceId(event.invoiceId);
    if (!attempt) throw new ApplicationError('NOT_FOUND', 'Unknown Mono invoice');
    if (event.reference !== attempt.merchantReference) throw new ApplicationError('PURCHASE_NOT_AUTHORIZED', 'Mono reference mismatch');
    if (event.amount !== attempt.requestedAmount.amount || event.ccy !== MONO_CCY) throw new ApplicationError('PURCHASE_NOT_AUTHORIZED', 'Mono amount or currency mismatch');
    const modifiedAt = event.modifiedDate as string;
    if (attempt.providerModifiedAt && new Date(modifiedAt).getTime() <= new Date(attempt.providerModifiedAt).getTime()) return { status: 'ignored' };
    if (attempt.state === 'SUCCEEDED' || TERMINAL.has(attempt.state)) return { status: 'ignored' };
    const fingerprint = createHash('sha256').update(rawBody).digest('hex');
    const order = this.orders.getById(attempt.orderId);
    if (!order || order.customerId !== attempt.customerId) throw new ApplicationError('PURCHASE_NOT_AUTHORIZED', 'Order is not available for payment confirmation');
    if (order.status === 'cancelled') throw new ApplicationError('PURCHASE_NOT_AUTHORIZED', 'Cancelled Order cannot be purchased');
    if (event.status === 'failure') { this.attempts.recordTerminalOrProviderState({ id: attempt.id, state: 'DECLINED', providerStatus: event.status, providerModifiedAt: modifiedAt, eventFingerprint: fingerprint, providerReference: event.reference }); return { status: 'accepted' }; }
    if (event.status !== 'success') { const state: PaymentAttemptState = event.status === 'created' || event.status === 'processing' ? 'REQUIRES_ACTION' : 'INITIATED'; this.attempts.recordTerminalOrProviderState({ id: attempt.id, state, providerStatus: event.status, providerModifiedAt: modifiedAt, eventFingerprint: fingerprint, providerReference: event.reference }); return { status: 'accepted' }; }
    const purchase: Purchase = { id: randomUUID(), orderId: order.id, customerId: order.customerId, amount: createMoney(order.pricingSnapshot.total.amount, UAH), confirmedAt: modifiedAt, paymentAttemptId: attempt.id, provider: 'MONO', providerInvoiceId: attempt.providerInvoiceId!, providerReference: event.reference! };
    const result = this.attempts.confirmSuccess({ attemptId: attempt.id, providerStatus: event.status, providerModifiedAt: modifiedAt, eventFingerprint: fingerprint, providerReference: event.reference!, confirmedAt: modifiedAt, purchase });
    if (result === 'created') { this.analytics.track('purchase', { customerId: purchase.customerId, orderId: purchase.orderId, amount: purchase.amount.amount }); if (order.items.some((item) => Boolean(item.discoveryBoxSnapshot))) this.analytics.track('box_purchase', { customerId: purchase.customerId, orderId: purchase.orderId }); }
    return { status: result === 'created' ? 'accepted' : 'ignored' };
  }

  private getOwnedOrder(customerId: string, orderId: string): Order { const order = this.orders.getById(orderId); if (!order) throw new ApplicationError('ORDER_NOT_FOUND', `Order ${orderId} was not found`); if (order.customerId !== customerId) throw new ApplicationError('ORDER_NOT_OWNED', `Order ${orderId} is not owned by customer ${customerId}`); return order; }
  private assertCustomer(customerId: string): void { if (!this.customers.getById(customerId)) throw new ApplicationError('NOT_FOUND', `Customer ${customerId} was not found`); }
  private validateEventShape(event: MonoInvoiceEvent): void { if (!event.invoiceId || !event.status || !Number.isInteger(event.amount) || !Number.isInteger(event.ccy) || !event.modifiedDate || !event.reference) throw new ApplicationError('VALIDATION_ERROR', 'Mono webhook is missing required fields'); if (event.ccy !== MONO_CCY) throw new ApplicationError('PURCHASE_NOT_AUTHORIZED', 'Mono currency must be UAH / ccy 980'); }
}
