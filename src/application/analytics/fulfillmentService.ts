import type Database from 'better-sqlite3';
import type { AnalyticsPeriod } from './commerceService';

type FulfillmentRow = { id: string; status: string; created_at: string };
type ShipmentRow = { fulfillment_id: string; status: string; created_at: string; shipped_at: string | null };
type EventRow = { id: string; fulfillment_id: string; event_type: string; from_status: string | null; to_status: string | null; occurred_at: string };
type Duration = { sampleSize: number; missingPairs: number; invalidPairs: number; averageSeconds: number | null; medianSeconds: number | null };
const ACTIVE = new Set(['PENDING', 'PENDING_CUSTOMER_APPROVAL', 'READY', 'PACKING', 'PACKED']);
const SLA_SECONDS = 48 * 3600;
const seconds = (start: string, end: string) => (Date.parse(end) - Date.parse(start)) / 1000;
function summary(values: number[], missingPairs: number, invalidPairs: number): Duration {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  return { sampleSize: n, missingPairs, invalidPairs, averageSeconds: n ? values.reduce((a, b) => a + b, 0) / n : null, medianSeconds: n ? (sorted[Math.floor((n - 1) / 2)] + sorted[Math.floor(n / 2)]) / 2 : null };
}
function countBy(rows: Array<{status: string}>): Record<string, number> {
  const result: Record<string, number> = {};
  for (const row of rows) result[row.status] = (result[row.status] ?? 0) + 1;
  return result;
}
function shortage(event: EventRow): boolean {
  if (!event.event_type.startsWith('{')) return false;
  try { const payload: unknown = JSON.parse(event.event_type); return typeof payload === 'object' && payload !== null && !Array.isArray(payload) && (payload as {type?: unknown}).type === 'DISCOVERY_BOX_SHORTAGE_PROPOSED'; } catch { return false; }
}
function statusTime(events: EventRow[], to: string): string | null {
  const matching = events.filter(e => e.event_type.startsWith('STATE:') && e.to_status === to && e.event_type.endsWith('->' + to));
  return matching.length === 1 ? matching[0].occurred_at : null;
}
function validDuration(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  const value = seconds(start, end);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

/** Created-cohort, read-only operational analytics. Current statuses and later transitions restate earlier cohorts. */
export class FulfillmentAnalyticsService {
  constructor(private readonly db: Database.Database, private readonly clock: () => Date = () => new Date()) {}

  private load(period: AnalyticsPeriod) {
    const fulfillments = this.db.prepare('SELECT id,status,created_at FROM fulfillments WHERE created_at >= ? AND created_at < ? ORDER BY id').all(period.from, period.to) as FulfillmentRow[];
    if (!fulfillments.length) return { fulfillments, shipments: [] as ShipmentRow[], events: [] as EventRow[] };
    // SQL remains parameterized; the cohort is bounded by date but not by number of rows.
    const ids = fulfillments.map(f => f.id);
    const shipments: ShipmentRow[] = [];
    const events: EventRow[] = [];
    for (let i = 0; i < ids.length; i += 400) {
      const batch = ids.slice(i, i + 400);
      const placeholders = batch.map(() => '?').join(',');
      shipments.push(...this.db.prepare(`SELECT fulfillment_id,status,created_at,shipped_at FROM shipments WHERE fulfillment_id IN (${placeholders})`).all(...batch) as ShipmentRow[]);
      events.push(...this.db.prepare(`SELECT id,fulfillment_id,event_type,from_status,to_status,occurred_at FROM fulfillment_events WHERE fulfillment_id IN (${placeholders}) ORDER BY occurred_at,id`).all(...batch) as EventRow[]);
    }
    return { fulfillments, shipments, events };
  }

  overview(period: AnalyticsPeriod) {
    const asOf = this.clock().toISOString();
    const { fulfillments, shipments } = this.load(period);
    const statusCounts = countBy(fulfillments);
    const shipmentStatuses = countBy(shipments);
    const byShipment = new Map(shipments.map(s => [s.fulfillment_id, s]));
    let completedSlaBreaches = 0, activeSlaOverdue = 0, completedSlaSampleSize = 0;
    for (const f of fulfillments) {
      const shipped = byShipment.get(f.id)?.shipped_at ?? null;
      const elapsed = validDuration(f.created_at, shipped);
      if (elapsed !== null) {
        completedSlaSampleSize++;
        if (elapsed > SLA_SECONDS) completedSlaBreaches++;
      } else if (ACTIVE.has(f.status)) {
        const overdue = validDuration(f.created_at, asOf);
        if (overdue !== null && overdue > SLA_SECONDS) activeSlaOverdue++;
      }
    }
    return { period, cohort: 'FULFILLMENT_CREATED' as const, asOf, slaHours: 48, totalFulfillments: fulfillments.length, processingBacklog: fulfillments.filter(f => ACTIVE.has(f.status)).length, inTransit: statusCounts.SHIPPED ?? 0, fulfillmentStatuses: statusCounts, fulfillmentFailed: statusCounts.FAILED ?? 0, fulfillmentLost: statusCounts.LOST ?? 0, cancelled: statusCounts.CANCELLED ?? 0, returned: statusCounts.RETURNED ?? 0, shipmentsCreated: shipments.length, shipmentStatuses, shipmentFailed: shipmentStatuses.FAILED ?? 0, shipmentLost: shipmentStatuses.LOST ?? 0, completedSlaSampleSize, completedSlaBreaches, activeSlaOverdue, historicalSnapshot: false };
  }

  timing(period: AnalyticsPeriod) {
    const asOf = this.clock().toISOString();
    const { fulfillments, shipments, events } = this.load(period);
    const byShipment = new Map(shipments.map(s => [s.fulfillment_id, s]));
    const byEvents = new Map<string, EventRow[]>();
    for (const e of events) { const group = byEvents.get(e.fulfillment_id) ?? []; group.push(e); byEvents.set(e.fulfillment_id, group); }
    const buckets = [[], [], [], []] as number[][];
    const missing = [0,0,0,0], invalid = [0,0,0,0];
    for (const f of fulfillments) {
      const ev = byEvents.get(f.id) ?? [];
      const ship = byShipment.get(f.id);
      const ready = statusTime(ev,'READY'), packed = statusTime(ev,'PACKED');
      const shipped = ship?.shipped_at ?? null;
      const pairs: Array<[string | null,string | null]> = [[f.created_at,shipped],[ready,packed],[packed,shipped],[ship?.created_at ?? null,shipped]];
      pairs.forEach(([start,end],i) => {
        if (!start || !end) { missing[i]++; return; }
        const d = validDuration(start,end);
        if (d === null) invalid[i]++; else buckets[i].push(d);
      });
    }
    return { period, cohort: 'FULFILLMENT_CREATED' as const, asOf, processing: summary(buckets[0],missing[0],invalid[0]), readyToPacked: summary(buckets[1],missing[1],invalid[1]), packedToShipped: summary(buckets[2],missing[2],invalid[2]), shipmentPreparation: summary(buckets[3],missing[3],invalid[3]), historicalSnapshot: false };
  }

  shortages(period: AnalyticsPeriod) {
    const asOf = this.clock().toISOString();
    const { fulfillments, events } = this.load(period);
    const registered = events.filter(shortage);
    return { period, cohort: 'FULFILLMENT_CREATED' as const, asOf, totalFulfillments: fulfillments.length, shortageEvents: registered.length, affectedFulfillments: new Set(registered.map(e => e.fulfillment_id)).size, historicalSnapshot: false, coverage: 'REGISTERED_EVENTS_ONLY' as const };
  }
}
