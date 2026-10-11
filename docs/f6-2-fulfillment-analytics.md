# YUNELA F6.2 — Fulfillment Analytics Implementation Contract

Status: implementation in feature branch; **merge not authorized**. F6.3–F6.4 excluded.

## Reporting semantics

All queries use Fulfillment **created cohort**: `fulfillments.created_at >= from AND < to`. UTC ISO timestamps and a maximum window of 366 days reuse F6.1 validation. Later status changes, shipment completion and shortage events **restate historical cohorts**. These are current assessments, **not immutable historical snapshots**. The API returns a request-time `asOf`.

**Processing completion = SHIPPED**, not PACKED. The authoritative stored shipment transition timestamp is `shipments.shipped_at`, set by both shipment paths in the F5 service. This includes shipments now DELIVERED/FAILED/LOST/RETURNED if they were previously shipped. Missing timestamps are never inferred from `updated_at` or current status. Only valid nonnegative intervals enter averages and medians. The duration response reports `sampleSize`, `missingPairs`, `invalidPairs`.

Completed processing time is `shipped_at - fulfillments.created_at`. READY→PACKED is based on unique matching `STATE:*->READY` and `STATE:*->PACKED` events. PACKED→SHIPPED uses PACKED event and shipment shipped timestamp. Shipment preparation uses `shipments.created_at` to `shipped_at`. Duration results use seconds, null for empty samples.

**SLA = 48 hours (172800 seconds)**. `completedSlaBreaches` counts completed shipments strictly above SLA. `activeSlaOverdue` counts only PENDING, PENDING_CUSTOMER_APPROVAL, READY, PACKING, PACKED with `asOf - created_at > SLA`. Never mix active backlog with completed durations. CANCELLED, FAILED, LOST, RETURNED are excluded from active overdue but retained in status counts; cancelled before shipping has no completed duration. A cancellation after a verifiable shipping timestamp does not erase the completed shipping fact.

Registered shortages are recognized only from existing persisted `fulfillment_events.event_type` JSON with `type=DISCOVERY_BOX_SHORTAGE_PROPOSED`. `shortageEvents` counts stored events and `affectedFulfillments` counts unique fulfillments. These metrics do **not** capture all failed inventory reservations or imply shortage causation. No shortage impact comparison.

## Operator-only HTTP endpoints

- `GET /api/v1/analytics/fulfillment/overview?from=<UTC>&to=<UTC>`: totalFulfillments, processingBacklog, inTransit, fulfillmentStatuses, failure/loss/cancellation/return counts, shipmentsCreated, shipmentStatuses, shipmentFailed/Lost, completedSlaSampleSize, completedSlaBreaches, activeSlaOverdue, slaHours=48.
- `GET /api/v1/analytics/fulfillment/timing?from=<UTC>&to=<UTC>`: processing, readyToPacked, packedToShipped, shipmentPreparation; each includes sampleSize, missingPairs, invalidPairs, averageSeconds, medianSeconds.
- `GET /api/v1/analytics/fulfillment/shortages?from=<UTC>&to=<UTC>`: shortageEvents, affectedFulfillments, coverage=REGISTERED_EVENTS_ONLY.

All responses include `period`, `cohort=FULFILLMENT_CREATED`, `asOf`, `historicalSnapshot=false`. Only OPERATOR is authorized. Unauthenticated: 401; CUSTOMER/SUPPLIER: 403; invalid period: 400. No PII or raw event JSON returned.

## Constraints and verification

Read-only parameterized SELECT only. No new migrations, event stores or event emission. No F4 Inventory, F5 Shipment, Fulfillment, Purchase or Payment lifecycle changes. F6.1 service and routes remain unchanged.

Before review run typecheck, lint, full tests including F4/F5 concurrency and rollback, and production build on exact PR HEAD. Do not claim PASS without actual runtime evidence. Evaluate query plans for production-scale created cohorts; existing `idx_fulfillments_customer` is not optimized for global created_at filtering.
