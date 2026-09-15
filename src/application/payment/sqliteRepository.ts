import Database from 'better-sqlite3';
import { createMoney } from '../../contracts/commerce';
import type { PaymentAttempt } from '../../contracts/payment';
import type { Purchase } from '../../contracts/commerce';
import type { PaymentAttemptRepository } from '../commerce/repositories';
import { ApplicationError, toPersistenceError } from '../errors';

function withPersistence<T>(operation: () => T): T {
  try { return operation(); } catch (error) { throw toPersistenceError(error); }
}

function mapAttempt(row: Record<string, unknown>): PaymentAttempt {
  return {
    id: String(row.id), orderId: String(row.order_id), customerId: String(row.customer_id), provider: 'MONO',
    ...(row.provider_invoice_id ? { providerInvoiceId: String(row.provider_invoice_id) } : {}),
    merchantReference: String(row.merchant_reference), requestedAmount: createMoney(Number(row.requested_amount), 'UAH'), requestedCurrency: 'UAH',
    state: row.state as PaymentAttempt['state'], ...(row.provider_status ? { providerStatus: String(row.provider_status) } : {}),
    ...(row.provider_modified_at ? { providerModifiedAt: String(row.provider_modified_at) } : {}),
    ...(row.provider_event_fingerprint ? { providerEventFingerprint: String(row.provider_event_fingerprint) } : {}),
    ...(row.provider_event_reference ? { providerEventReference: String(row.provider_event_reference) } : {}),
    idempotencyKey: String(row.idempotency_key), ...(row.payment_page_url ? { paymentPageUrl: String(row.payment_page_url) } : {}),
    createdAt: String(row.created_at), updatedAt: String(row.updated_at), ...(row.confirmed_at ? { confirmedAt: String(row.confirmed_at) } : {}),
  };
}

export class SqlitePaymentAttemptRepository implements PaymentAttemptRepository {
  constructor(private readonly db: Database.Database) {}

  create(attempt: PaymentAttempt): void {
    withPersistence(() => this.db.prepare(`INSERT INTO payment_attempts
      (id, order_id, customer_id, provider, provider_invoice_id, merchant_reference, requested_amount, requested_currency, state, provider_status, provider_modified_at, provider_event_fingerprint, provider_event_reference, idempotency_key, payment_page_url, created_at, updated_at, confirmed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      attempt.id, attempt.orderId, attempt.customerId, attempt.provider, attempt.providerInvoiceId ?? null, attempt.merchantReference,
      attempt.requestedAmount.amount, attempt.requestedCurrency, attempt.state, attempt.providerStatus ?? null, attempt.providerModifiedAt ?? null,
      attempt.providerEventFingerprint ?? null, attempt.providerEventReference ?? null, attempt.idempotencyKey, attempt.paymentPageUrl ?? null,
      attempt.createdAt, attempt.updatedAt, attempt.confirmedAt ?? null));
  }

  getById(id: string): PaymentAttempt | undefined { return withPersistence(() => { const row = this.db.prepare('SELECT * FROM payment_attempts WHERE id = ?').get(id) as Record<string, unknown> | undefined; return row ? mapAttempt(row) : undefined; }); }
  getByOrderAndIdempotency(orderId: string, idempotencyKey: string): PaymentAttempt | undefined { return withPersistence(() => { const row = this.db.prepare('SELECT * FROM payment_attempts WHERE order_id = ? AND idempotency_key = ?').get(orderId, idempotencyKey) as Record<string, unknown> | undefined; return row ? mapAttempt(row) : undefined; }); }
  getByProviderInvoiceId(providerInvoiceId: string): PaymentAttempt | undefined { return withPersistence(() => { const row = this.db.prepare('SELECT * FROM payment_attempts WHERE provider_invoice_id = ?').get(providerInvoiceId) as Record<string, unknown> | undefined; return row ? mapAttempt(row) : undefined; }); }

  save(attempt: PaymentAttempt): void {
    withPersistence(() => this.db.prepare(`UPDATE payment_attempts SET provider_invoice_id = ?, state = ?, provider_status = ?, provider_modified_at = ?, provider_event_fingerprint = ?, provider_event_reference = ?, payment_page_url = ?, updated_at = ?, confirmed_at = ? WHERE id = ?`).run(
      attempt.providerInvoiceId ?? null, attempt.state, attempt.providerStatus ?? null, attempt.providerModifiedAt ?? null, attempt.providerEventFingerprint ?? null,
      attempt.providerEventReference ?? null, attempt.paymentPageUrl ?? null, attempt.updatedAt, attempt.confirmedAt ?? null, attempt.id));
  }

  recordTerminalOrProviderState(input: { id: string; state: PaymentAttempt['state']; providerStatus: string; providerModifiedAt: string; eventFingerprint: string; providerReference?: string }): 'updated' | 'ignored' {
    return withPersistence(() => {
      const transaction = this.db.transaction(() => {
        const current = this.db.prepare('SELECT state, provider_modified_at FROM payment_attempts WHERE id = ?').get(input.id) as { state: PaymentAttempt['state']; provider_modified_at: string | null } | undefined;
        if (!current) throw new ApplicationError('NOT_FOUND', `Payment attempt ${input.id} was not found`);
        if (current.state === 'SUCCEEDED' || current.state === 'DECLINED' || current.state === 'EXPIRED' || current.state === 'FAILED' || current.state === 'CANCELLED') return 'ignored' as const;
        if (current.provider_modified_at && new Date(input.providerModifiedAt).getTime() <= new Date(current.provider_modified_at).getTime()) return 'ignored' as const;
        const result = this.db.prepare(`UPDATE payment_attempts SET state = ?, provider_status = ?, provider_modified_at = ?, provider_event_fingerprint = ?, provider_event_reference = ?, updated_at = ? WHERE id = ? AND state NOT IN ('SUCCEEDED','DECLINED','EXPIRED','FAILED','CANCELLED') AND (provider_modified_at IS NULL OR provider_modified_at < ?)`).run(
          input.state, input.providerStatus, input.providerModifiedAt, input.eventFingerprint, input.providerReference ?? null, new Date().toISOString(), input.id, input.providerModifiedAt);
        return result.changes === 1 ? 'updated' as const : 'ignored' as const;
      });
      return transaction();
    });
  }

  confirmSuccess(input: { attemptId: string; expectedState: PaymentAttempt['state']; expectedProviderModifiedAt?: string; providerStatus: string; providerModifiedAt: string; eventFingerprint: string; providerReference: string; confirmedAt: string; purchase: Purchase }): 'created' | 'duplicate' | 'ignored' {
    return withPersistence(() => {
      const transaction = this.db.transaction(() => {
        const existing = this.db.prepare('SELECT id FROM purchases WHERE order_id = ?').get(input.purchase.orderId) as { id: string } | undefined;
        if (existing) return 'duplicate' as const;
        const attempt = this.db.prepare('SELECT order_id, state, provider_modified_at FROM payment_attempts WHERE id = ?').get(input.attemptId) as { order_id: string; state: PaymentAttempt['state']; provider_modified_at: string | null } | undefined;
        if (!attempt) throw new ApplicationError('NOT_FOUND', `Payment attempt ${input.attemptId} was not found`);
        if (attempt.order_id !== input.purchase.orderId) throw new ApplicationError('PURCHASE_NOT_AUTHORIZED', 'Payment attempt does not belong to Order');
        if (attempt.state !== input.expectedState) return 'ignored' as const;
        if (attempt.state !== 'CREATED' && attempt.state !== 'INITIATED' && attempt.state !== 'REQUIRES_ACTION') return 'ignored' as const;
        if (attempt.provider_modified_at !== (input.expectedProviderModifiedAt ?? null)) return 'ignored' as const;
        if (attempt.provider_modified_at && new Date(input.providerModifiedAt).getTime() <= new Date(attempt.provider_modified_at).getTime()) return 'ignored' as const;
        const now = new Date().toISOString();
        const attemptUpdate = this.db.prepare(`UPDATE payment_attempts SET state = 'SUCCEEDED', provider_status = ?, provider_modified_at = ?, provider_event_fingerprint = ?, provider_event_reference = ?, updated_at = ?, confirmed_at = ? WHERE id = ? AND state = ? AND (provider_modified_at IS ? OR provider_modified_at = ?) AND (provider_modified_at IS NULL OR provider_modified_at < ?)` ).run(
          input.providerStatus, input.providerModifiedAt, input.eventFingerprint, input.providerReference, now, input.confirmedAt, input.attemptId, input.expectedState, input.expectedProviderModifiedAt ?? null, input.expectedProviderModifiedAt ?? null, input.providerModifiedAt);
        if (attemptUpdate.changes !== 1) return 'ignored' as const;
        const orderUpdate = this.db.prepare(`UPDATE orders SET status = 'confirmed', updated_at = ? WHERE id = ? AND status = 'created'`).run(now, input.purchase.orderId);
        if (orderUpdate.changes !== 1) throw new ApplicationError('PURCHASE_NOT_AUTHORIZED', 'Order is not eligible for confirmation');
        this.db.prepare(`INSERT INTO purchases (id, order_id, customer_id, amount, currency, confirmed_at, payment_attempt_id, provider, provider_invoice_id, provider_reference) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
          input.purchase.id, input.purchase.orderId, input.purchase.customerId, input.purchase.amount.amount, input.purchase.amount.currency, input.purchase.confirmedAt,
          input.purchase.paymentAttemptId, input.purchase.provider, input.purchase.providerInvoiceId, input.purchase.providerReference);
        return 'created' as const;
      });
      return transaction();
    });
  }
}
