# YUNELA F6.2 — Fulfillment Analytics Implementation Contract

Status: implementation in feature branch; **merge not authorized**. F6.3–F6.4 excluded.

## Reporting semantics

All queries use Fulfillment **created cohort**: `fulfillments.created_at >= from AND < to`. UTC ISO timestamps and a maximum window of 366 days reuse F6.1 validation. Later status changes, shipment completion and shortage events **restate historical cohorts**. These are current assessments, **not immutable historical snapshots**. The API returns a request-time `asOf`.

**Processing completion = SHIPPED**, not PACKED. The authoritative stored shipment transition timestamp is `shipments.shipped_at`, set by both shipment paths in the F5 service. This includes shipments now DELIVERED/FAILED/LOST/RETURNED if they were previously shipped. Missing timestamps are never inferred from `updated_at` or current status. Only valid nonnegative intervals enter averages and medians. Ambiguous READY/PACKED histories are classified as invalid pairs, not missing timestamps; missing events are missing pairs. Shipment timestamps after asOf, reversed intervals, and conflicting Shipment/Fulfillment current states are invalid, not silently accepted. The duration response reports `sampleSize`, `missingPairs`, `invalidPairs`.

Completed processing time is `shipped_at - fulfillments.created_at`. READY→PACKED is based on unique matching `STATE:*->READY` and `STATE:*->PACKED` events. PACKED→SHIPPED uses PACKED event and shipment shipped timestamp. Shipment preparation uses `shipments.created_at` to `shipped_at`. Duration results use seconds, null for empty samples.

**SLA = 48 hours (172800 seconds)**. `completedSlaBreaches` counts completed shipments strictly above SLA. `activeSlaOverdue` counts only PENDING, PENDING_CUSTOMER_APPROVAL, READY, PACKING, PACKED with `asOf - created_at > SLA`. Never mix active backlog with completed durations. CANCELLED, FAILED, LOST, RETURNED are excluded from active overdue but retained in status counts; cancelled before shipping has no completed duration. A cancellation after a verifiable shipping timestamp does not erase the completed shipping fact.

Registered shortages are recognized only from existing persisted `fulfillment_events.event_type` JSON with `type=DISCOVERY_BOX_SHORTAGE_PROPOSED`. `shortageEvents` counts stored events and `affectedFulfillments` counts unique fulfillments. These metrics do **not** capture all failed inventory reservations or imply shortage causation. No shortage impact comparison.

## Operator-only HTTP endpoints

- `GET /api/v1/analytics/fulfillment/overview?from=<UTC>&to=<UTC>`: totalFulfillments, processingBacklog, inTransit, fulfillmentStatuses, failure/loss/cancellation/return counts, shipmentsCreated, shipmentStatuses, shipmentFailed/Lost, completedSlaSampleSize, completedSlaBreaches, activeSlaOverdue, inconsistentCompletion, slaHours=48.
- `GET /api/v1/analytics/fulfillment/timing?from=<UTC>&to=<UTC>`: processing, readyToPacked, packedToShipped, shipmentPreparation; each includes sampleSize, missingPairs, invalidPairs, averageSeconds, medianSeconds.
- `GET /api/v1/analytics/fulfillment/shortages?from=<UTC>&to=<UTC>`: shortageEvents, affectedFulfillments, coverage=REGISTERED_EVENTS_ONLY.

All responses include `period`, `cohort=FULFILLMENT_CREATED`, `asOf`, `historicalSnapshot=false`. Only OPERATOR is authorized. Unauthenticated: 401; CUSTOMER/SUPPLIER: 403; invalid period: 400. No PII or raw event JSON returned.

## Constraints and verification

Read-only parameterized SELECT only. No new migrations, event stores or event emission. No F4 Inventory, F5 Shipment, Fulfillment, Purchase or Payment lifecycle changes. F6.1 service and routes remain unchanged.

Before review run typecheck, lint, full tests including F4/F5 concurrency and rollback, and production build on exact PR HEAD. Do not claim PASS without actual runtime evidence. Evaluate query plans for production-scale created cohorts; existing `idx_fulfillments_customer` is not optimized for global created_at filtering.

## F6.2 independent remediation: data quality

A completion requires a shipment with a persisted `shipped_at` timestamp not after request `asOf`, nonnegative elapsed time since Fulfillment creation, a Shipment state other than CREATED, and a Fulfillment state outside the active backlog. A contradictory active Fulfillment with a shipped timestamp is retained in the **current status** backlog, but is excluded from both completed SLA and active SLA overdue; `inconsistentCompletion` reports the number of such invalid shipment/completion observations. This prevents counting one contradictory record as both completed and overdue. A missing shipment is not evidence of completion. A Shipment marked SHIPPED/DELIVERED/RETURNED/LOST with no shipped timestamp is classified as inconsistent, never assigned an inferred timestamp. Failed shipments without a recorded shipping timestamp are not assumed to have shipped.

Timing results classify ambiguous repeated READY or PACKED transition events under `invalidPairs`, never as a valid duration. Missing event pairs remain `missingPairs`. Negative durations and future transitions are invalid. The `asOf` timestamp is sampled once per request, not persisted.

## F6.2 performance assessment — SQLite query benchmark

Environment: isolated Linux x86_64 container, Python 3.13.5 `sqlite3` linked to SQLite 3.46.1, five visible logical CPUs, in-memory SQLite database. Synthetic dataset: **100,000 Fulfillment**, **33,334 Shipment**, **50,000 transition events**, 500 synthetic customer IDs, 365-day spread of created timestamps. No customer PII. Five repetitions per query window, reported median wall time; this is an **SQL workload benchmark, not a Node.js end-to-end API latency test**.

Measured workload: select created cohort, load associated shipments in 400-ID batches, load matching transition events in 400-ID batches. It models the existing query strategy, with event filtering `event_type LIKE 'STATE:%'`. Timings include Python-side batch dispatch and SQLite result materialization, but exclude Node.js processing, JSON response serialization and network latency.

| Created period | Matching rows | Without created_at index median | With experimental created_at,id index median |
| --- | ---: | ---: | ---: |
| 4 days | 1,096 | 11.3 ms | 2.9 ms |
| 31 days | 8,494 | 26.7 ms | 20.8 ms |
| 365 days | 100,000 | 214.0 ms | 258.9 ms |

`EXPLAIN QUERY PLAN` for `SELECT id,status,created_at FROM fulfillments WHERE created_at >= ? AND created_at < ? ORDER BY id`:

- Current indexes: `SCAN fulfillments USING INDEX sqlite_autoindex_fulfillments_1` (primary-key index scan; filters date after scan).
- Experimental `CREATE INDEX idx_fulfillments_created_at_id ON fulfillments(created_at,id)`: `SEARCH fulfillments USING INDEX idx_fulfillments_created_at_id (created_at>? AND created_at<?)`, plus `USE TEMP B-TREE FOR ORDER BY`.
- Existing `idx_shipments_fulfillment` and `idx_fulfillment_events_fulfillment` support per-fulfillment lookups.

**Decision:** no index migration in F6.2 remediation. The experimental index improves selective date windows but degrades the full-year 100k cohort in this workload, and increases persistence overhead. A separate index decision requires representative production data and an end-to-end Node benchmark. The API still materializes the full cohort and has no row-count cap; 100k-row response latency and memory under Node are **NOT VERIFIED**. This is an explicitly retained scalability risk, not a claim of performance PASS.
