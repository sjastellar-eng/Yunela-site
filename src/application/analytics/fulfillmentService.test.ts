import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDatabase } from '../../database/client';
import { applyMigrations } from '../../database/migrate';
import { FulfillmentAnalyticsService } from './fulfillmentService';

const period = { from: '2026-10-01T00:00:00.000Z', to: '2026-11-01T00:00:00.000Z' };
const asOf = '2026-12-10T12:00:00.000Z';
describe('F6.2 created-cohort read-only analytics', () => {
  let db: ReturnType<typeof openDatabase>;
  let service: FulfillmentAnalyticsService;
  beforeEach(() => {
    db = openDatabase(); applyMigrations(db);
    db.pragma('foreign_keys = OFF'); // Isolated analytics fixtures; domain integrity is covered by F4/F5 suites.
    service = new FulfillmentAnalyticsService(db, () => new Date(asOf));
  });
  afterEach(() => db.close());
  function fulfillment(id: string, status: string, created = '2026-10-05T00:00:00.000Z') {
    db.prepare("INSERT INTO fulfillments(id,order_id,purchase_id,customer_id,status,shipping_snapshot_json,items_snapshot_json,created_at,updated_at) VALUES (?,?,?,?,?,'{}','[]',?,?)").run(id,'o'+id,'p'+id,'c'+id,status,created,created);
  }
  function shipment(id: string, status: string, created = '2026-10-05T10:00:00.000Z', shipped: string | null = null) {
    db.prepare("INSERT INTO shipments(id,fulfillment_id,status,created_at,updated_at,shipped_at) VALUES (?,?,?,?,?,?)").run('s'+id,id,status,created,shipped ?? created,shipped);
  }
  function event(id: string, key: string, type: string, from: string | null, to: string | null, at: string) {
    db.prepare('INSERT INTO fulfillment_events(id,fulfillment_id,event_type,from_status,to_status,actor,occurred_at,event_key,created_at) VALUES (?,?,?,?,?,?,?,?,?)').run(key,id,type,from,to,'SYSTEM',at,key,at);
  }

  it('selects fulfillments created in half-open interval, regardless of later shipment timestamps', () => {
    fulfillment('in','SHIPPED',period.from); shipment('in','SHIPPED',period.to,period.to);
    fulfillment('out','PENDING',period.to);
    expect(service.overview(period)).toMatchObject({ totalFulfillments: 1, shipmentsCreated: 1, processingBacklog: 0 });
    expect(service.timing(period).processing).toMatchObject({ sampleSize: 1, missingPairs: 0 });
  });

  it('counts completed SLA breaches strictly after 48 hours, never counting unfinished in completed average', () => {
    fulfillment('exact','SHIPPED','2026-10-01T00:00:00.000Z'); shipment('exact','SHIPPED','2026-10-02T00:00:00.000Z','2026-10-03T00:00:00.000Z');
    fulfillment('late','DELIVERED','2026-10-01T00:00:00.000Z'); shipment('late','DELIVERED','2026-10-02T00:00:00.000Z','2026-10-03T00:00:01.000Z');
    fulfillment('waiting','PENDING','2026-10-01T00:00:00.000Z');
    const overview = service.overview(period);
    expect(overview).toMatchObject({ completedSlaSampleSize: 2, completedSlaBreaches: 1, activeSlaOverdue: 1, processingBacklog: 1 });
    expect(service.timing(period).processing).toMatchObject({ sampleSize: 2, missingPairs: 1, averageSeconds: 172800.5, medianSeconds: 172800.5 });
  });

  it('excludes cancelled unfinished orders from backlog and overdue', () => {
    fulfillment('cancel','CANCELLED','2026-10-01T00:00:00.000Z');
    fulfillment('failed','FAILED','2026-10-01T00:00:00.000Z');
    fulfillment('active','PACKING','2026-10-01T00:00:00.000Z');
    expect(service.overview(period)).toMatchObject({ processingBacklog: 1, activeSlaOverdue: 1, cancelled: 1, fulfillmentFailed: 1 });
    expect(service.timing(period).processing.sampleSize).toBe(0);
  });

  it('pairs actual READY and PACKED transitions and reports missing pairs', () => {
    fulfillment('one','PACKED');
    event('one','r','STATE:PENDING->READY','PENDING','READY','2026-10-05T01:00:00.000Z');
    event('one','p','STATE:PACKING->PACKED','PACKING','PACKED','2026-10-05T03:00:00.000Z');
    expect(service.timing(period).readyToPacked).toMatchObject({ sampleSize: 1, averageSeconds: 7200, missingPairs: 0 });
    expect(service.timing(period).packedToShipped).toMatchObject({ sampleSize: 0, missingPairs: 1 });
  });

  it('counts only recorded shortage events and distinct affected fulfillments', () => {
    fulfillment('one','PENDING_CUSTOMER_APPROVAL'); fulfillment('two','PENDING');
    event('one','s1',JSON.stringify({type:'DISCOVERY_BOX_SHORTAGE_PROPOSED',originalTeaId:'tea1'}),'PENDING','PENDING_CUSTOMER_APPROVAL','2026-10-05T01:00:00.000Z');
    event('one','s2',JSON.stringify({type:'DISCOVERY_BOX_SHORTAGE_PROPOSED',originalTeaId:'tea2'}),'PENDING','PENDING_CUSTOMER_APPROVAL','2026-10-05T02:00:00.000Z');
    event('two','bad','{broken','PENDING','PENDING','2026-10-05T03:00:00.000Z');
    expect(service.shortages(period)).toMatchObject({ shortageEvents: 2, affectedFulfillments: 1, coverage: 'REGISTERED_EVENTS_ONLY' });
  });


  it('marks duplicate READY or PACKED history invalid rather than missing or completed', () => {
    fulfillment('one','PACKED');
    event('one','r1','STATE:PENDING->READY','PENDING','READY','2026-10-05T01:00:00.000Z');
    event('one','r2','STATE:PENDING->READY','PENDING','READY','2026-10-05T02:00:00.000Z');
    event('one','p','STATE:PACKING->PACKED','PACKING','PACKED','2026-10-05T03:00:00.000Z');
    expect(service.timing(period).readyToPacked).toMatchObject({ sampleSize: 0, invalidPairs: 1, missingPairs: 0 });
  });

  it('does not count conflicting active fulfillment with shipped timestamp as completed or overdue', () => {
    fulfillment('conflict','PACKING','2026-10-01T00:00:00.000Z');
    shipment('conflict','SHIPPED','2026-10-01T02:00:00.000Z','2026-10-02T00:00:00.000Z');
    expect(service.overview(period)).toMatchObject({ processingBacklog: 1, completedSlaSampleSize: 0, activeSlaOverdue: 0, inconsistentCompletion: 1 });
    expect(service.timing(period).processing).toMatchObject({ sampleSize: 0, invalidPairs: 1 });
  });

  it('rejects impossible future shipping timestamps without fabricating completion', () => {
    fulfillment('future','SHIPPED','2026-10-01T00:00:00.000Z');
    shipment('future','SHIPPED','2026-10-01T02:00:00.000Z','2027-01-01T00:00:00.000Z');
    expect(service.overview(period)).toMatchObject({ completedSlaSampleSize: 0, inconsistentCompletion: 1 });
    expect(service.timing(period).processing).toMatchObject({ sampleSize: 0, invalidPairs: 1 });
  });

  it('separates missing shipped_at on a shipped shipment from valid processing', () => {
    fulfillment('missing','SHIPPED');
    shipment('missing','SHIPPED');
    expect(service.overview(period)).toMatchObject({ completedSlaSampleSize: 0, inconsistentCompletion: 1 });
    expect(service.timing(period).processing).toMatchObject({ sampleSize: 0, invalidPairs: 1 });
  });

  it('does not accept reversed event chronology', () => {
    fulfillment('reverse','PACKED');
    event('reverse','r','STATE:PENDING->READY','PENDING','READY','2026-10-05T05:00:00.000Z');
    event('reverse','p','STATE:PACKING->PACKED','PACKING','PACKED','2026-10-05T03:00:00.000Z');
    expect(service.timing(period).readyToPacked).toMatchObject({ sampleSize: 0, invalidPairs: 1 });
  });

  it('reassesses prior cohorts after a later shipment and never modifies records', () => {
    fulfillment('one','PACKED');
    expect(service.timing(period).processing.sampleSize).toBe(0);
    shipment('one','SHIPPED','2026-10-05T10:00:00.000Z','2026-11-03T00:00:00.000Z');
    // F5 shipment transition atomically advances the associated Fulfillment to SHIPPED.
    db.prepare("UPDATE fulfillments SET status = 'SHIPPED', updated_at = ? WHERE id = ?").run('2026-11-03T00:00:00.000Z', 'one');
    expect(service.timing(period).processing.sampleSize).toBe(1);
    expect(service.overview(period)).toMatchObject({ totalFulfillments: 1, completedSlaSampleSize: 1, processingBacklog: 0, inconsistentCompletion: 0 });
    expect((db.prepare('SELECT COUNT(*) AS n FROM shipments').get() as {n:number}).n).toBe(1);
  });
});
