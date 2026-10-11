import type Database from 'better-sqlite3';
import { ApplicationError } from '../errors';

export type AnalyticsPeriod = { from: string; to: string };
export type Overview = AnalyticsPeriod & { currency: 'UAH'; ordersCreated: number; cancelledOrders: number; confirmedPurchases: number; grossConfirmedRevenueMinor: number; averageConfirmedOrderValueMinor: number | null };
export type Commerce = AnalyticsPeriod & { currency: 'UAH'; ordersByStatus: Record<'created' | 'confirmed' | 'cancelled', number>; topPurchasedSKUs: Array<{ sku: string; unitsSold: number; orderCount: number }> };

/** Gross confirmed revenue is a CURRENT assessment: subsequent cancellations restate past periods. */
export class CommerceAnalyticsService {
  constructor(private readonly db: Database.Database) {}

  static parsePeriod(from: string | null, to: string | null): AnalyticsPeriod {
    const iso = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
    if (!from || !to || !iso.test(from) || !iso.test(to)) throw new ApplicationError('VALIDATION_ERROR', 'from and to must be UTC ISO-8601 timestamps');
    const start = Date.parse(from), end = Date.parse(to);
    if (!Number.isFinite(start) || !Number.isFinite(end) || new Date(start).toISOString() !== new Date(from).toISOString() || new Date(end).toISOString() !== new Date(to).toISOString() || start >= end || end - start > 366 * 86400000) {
      throw new ApplicationError('VALIDATION_ERROR', 'Period must be valid, ordered and at most 366 days');
    }
    return { from: new Date(start).toISOString(), to: new Date(end).toISOString() };
  }

  /** Only linked, successful Mono attempts qualify; legacy boundary purchases have no independently verifiable payment evidence. */
  private static readonly eligible = `FROM purchases p
    JOIN orders o ON o.id = p.order_id
    JOIN payment_attempts a ON a.id = p.payment_attempt_id
    WHERE o.status = 'confirmed'
      AND o.customer_id = p.customer_id
      AND p.currency = 'UAH'
      AND a.state = 'SUCCEEDED'
      AND a.order_id = p.order_id
      AND a.customer_id = p.customer_id
      AND a.requested_currency = 'UAH'
      AND a.requested_amount = p.amount
      AND a.confirmed_at IS NOT NULL
      AND p.confirmed_at >= ? AND p.confirmed_at < ?`;

  overview(period: AnalyticsPeriod): Overview {
    const orders = this.db.prepare(`SELECT COUNT(*) AS total, COALESCE(SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END), 0) AS cancelled FROM orders WHERE created_at >= ? AND created_at < ?`).get(period.from, period.to) as { total: number; cancelled: number };
    const finance = this.db.prepare(`SELECT COUNT(*) AS count, COALESCE(SUM(p.amount),0) AS amount ${CommerceAnalyticsService.eligible}`).get(period.from, period.to) as { count: number; amount: number };
    return { ...period, currency: 'UAH', ordersCreated: orders.total, cancelledOrders: orders.cancelled, confirmedPurchases: finance.count, grossConfirmedRevenueMinor: finance.amount, averageConfirmedOrderValueMinor: finance.count ? Math.round(finance.amount / finance.count) : null };
  }

  commerce(period: AnalyticsPeriod, limit = 10): Commerce {
    if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new ApplicationError('VALIDATION_ERROR', 'limit must be an integer between 1 and 50');
    const rows = this.db.prepare(`SELECT status, COUNT(*) AS count FROM orders WHERE created_at >= ? AND created_at < ? GROUP BY status`).all(period.from, period.to) as Array<{ status: 'created' | 'confirmed' | 'cancelled'; count: number }>;
    const ordersByStatus = { created: 0, confirmed: 0, cancelled: 0 };
    for (const row of rows) ordersByStatus[row.status] = row.count;
    const topPurchasedSKUs = this.db.prepare(`SELECT oi.sku AS sku, SUM(oi.quantity) AS unitsSold, COUNT(DISTINCT oi.order_id) AS orderCount
      FROM order_items oi JOIN (SELECT p.order_id ${CommerceAnalyticsService.eligible}) eligible ON eligible.order_id = oi.order_id
      GROUP BY oi.sku ORDER BY unitsSold DESC, oi.sku ASC LIMIT ?`).all(period.from, period.to, limit) as Commerce['topPurchasedSKUs'];
    return { ...period, currency: 'UAH', ordersByStatus, topPurchasedSKUs };
  }
}
