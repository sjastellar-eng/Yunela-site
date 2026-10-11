import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { openDatabase } from '../../database/client';
import { applyMigrations } from '../../database/migrate';
import { CommerceAnalyticsService } from './commerceService';

describe('F6.1 authoritative commerce analytics', () => {
  let db: ReturnType<typeof openDatabase>;
  let service: CommerceAnalyticsService;
  const period = { from: '2026-10-01T00:00:00.000Z', to: '2026-11-01T00:00:00.000Z' };

  beforeEach(() => {
    db = openDatabase();
    applyMigrations(db);
    service = new CommerceAnalyticsService(db);
    db.prepare("INSERT INTO customers(id,email,created_at) VALUES ('c1','test@example.com',?)").run(period.from);
  });
  afterEach(() => db.close());

  function order(id: string, status: 'created' | 'confirmed' | 'cancelled' = 'confirmed', createdAt = '2026-10-05T00:00:00.000Z') {
    db.prepare(`INSERT INTO orders(id,customer_id,status,currency,subtotal_amount,discount_amount,shipping_amount,total_amount,shipping_snapshot_json,idempotency_key,created_at,updated_at) VALUES (?, 'c1', ?, 'UAH',1000,0,0,1000,'{}',?,?,?)`).run(id,status,id,createdAt,createdAt);
  }
  function attempt(id: string, orderId: string, state: string = 'SUCCEEDED') {
    db.prepare(`INSERT INTO payment_attempts(id,order_id,customer_id,provider,merchant_reference,requested_amount,requested_currency,state,idempotency_key,created_at,updated_at,confirmed_at) VALUES (?,?,'c1','MONO',?,1000,'UAH',?,?,'2026-10-05T00:00:00.000Z','2026-10-05T00:00:00.000Z',?)`).run(id,orderId,id,state,id,state === 'SUCCEEDED' ? '2026-10-05T00:00:00.000Z' : null);
  }
  function purchase(id: string, orderId: string, attemptId: string | null = null, confirmedAt = '2026-10-05T00:00:00.000Z') {
    db.prepare(`INSERT INTO purchases(id,order_id,customer_id,amount,currency,confirmed_at,payment_attempt_id) VALUES (?,?,'c1',1000,'UAH',?,?)`).run(id,orderId,confirmedAt,attemptId);
  }

  it('counts only successful linked purchases, not unverified legacy or failed attempts', () => {
    order('o1'); attempt('a1','o1'); purchase('p1','o1','a1');
    order('o2'); purchase('p2','o2');
    order('o3'); attempt('a3','o3','FAILED'); purchase('p3','o3','a3');
    expect(service.overview(period)).toMatchObject({ ordersCreated: 3, confirmedPurchases: 1, grossConfirmedRevenueMinor: 1000, averageConfirmedOrderValueMinor: 1000 });
  });

  it('does not double count multiple attempts or multiple order items', () => {
    order('o1'); attempt('a1','o1'); attempt('a2','o1','FAILED'); purchase('p1','o1','a1');
    db.prepare(`INSERT INTO order_items(id,order_id,sku,tea_name_snapshot,quantity,unit_price_amount,unit_price_currency,line_total_amount) VALUES ('i1','o1','TEA-1','Tea',2,200,'UAH',400),('i2','o1','TEA-2','Tea',3,200,'UAH',600)`).run();
    expect(service.overview(period).grossConfirmedRevenueMinor).toBe(1000);
    expect(service.commerce(period).topPurchasedSKUs).toEqual([{ sku:'TEA-2', unitsSold:3, orderCount:1 },{ sku:'TEA-1', unitsSold:2, orderCount:1 }]);
  });

  it('recalculates past revenue after current order cancellation', () => {
    order('o1'); attempt('a1','o1'); purchase('p1','o1','a1');
    expect(service.overview(period).grossConfirmedRevenueMinor).toBe(1000);
    db.prepare("UPDATE orders SET status='cancelled' WHERE id='o1'").run();
    expect(service.overview(period)).toMatchObject({ confirmedPurchases: 0, grossConfirmedRevenueMinor: 0, cancelledOrders: 1 });
  });

  it('uses half-open UTC intervals for purchases and order creation', () => {
    order('o1','confirmed',period.from); attempt('a1','o1'); purchase('p1','o1','a1',period.from);
    order('o2','confirmed',period.to); attempt('a2','o2'); purchase('p2','o2','a2',period.to);
    expect(service.overview(period)).toMatchObject({ ordersCreated: 1, confirmedPurchases: 1, grossConfirmedRevenueMinor: 1000 });
  });

  it('rejects invalid or overlong ranges and limits', () => {
    expect(() => CommerceAnalyticsService.parsePeriod('2025-01-01T00:00:00Z','2026-10-01T00:00:00Z')).toThrow();
    expect(() => CommerceAnalyticsService.parsePeriod('bad',period.to)).toThrow();
    expect(() => CommerceAnalyticsService.parsePeriod(period.to,period.from)).toThrow();
    expect(() => service.commerce(period,51)).toThrow();
    expect(() => service.commerce(period,0)).toThrow();
  });

  it('returns zero and null AOV on empty data and never mutates business tables', () => {
    const before = db.prepare('SELECT COUNT(*) AS n FROM orders').get();
    expect(service.overview(period)).toMatchObject({ ordersCreated: 0, confirmedPurchases: 0, grossConfirmedRevenueMinor: 0, averageConfirmedOrderValueMinor: null });
    expect(service.commerce(period).ordersByStatus).toEqual({ created:0, confirmed:0, cancelled:0 });
    expect(db.prepare('SELECT COUNT(*) AS n FROM orders').get()).toEqual(before);
  });
});
