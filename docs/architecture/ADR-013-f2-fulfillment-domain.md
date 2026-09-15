# ADR-013 — F2 Fulfillment Domain and Application Services

## Status
Implementation stage; pending technical review and CEO merge authorization.

## Context
F0 is the frozen Fulfillment contract. F1 provides persistence only. F2 adds the domain state machine and application orchestration without introducing HTTP, carrier, payment, analytics or a second inventory authority.

## Decisions
- Purchase remains the authoritative commercial outcome; Fulfillment is execution truth; Shipment is physical movement truth.
- Fulfillment creation is sourced only from a valid Purchase whose Order is CONFIRMED and whose authoritative PaymentAttempt is SUCCEEDED. Creation is idempotent and copies immutable execution snapshots.
- Fulfillment transitions are explicit and validated inside SQLite transactions. The F2 application layer never writes SQL directly.
- READY performs atomic lot allocation/reservation against `tea_lots.inventory_quantity`; PACKED consumes those reserved allocation records without decrementing inventory a second time.
- Allocation and release use conditional database updates inside the same transaction as the corresponding lifecycle transition, preventing partial state changes and overselling under SQLite write serialization.
- Discovery Box composition is validated as the immutable six-component 3 MATCH / 2 STRETCH / 1 WILDCARD snapshot. Shortage moves the Fulfillment to `PENDING_CUSTOMER_APPROVAL`; the shortage event must contain a concrete operational replacement tea (and optional lot) before customer approval can be accepted.
- Customer approval changes only fulfillment execution resolution. The OrderItem/commercial snapshot is never rewritten. Rejected approval does not unblock readiness.
- MVP has one Shipment per Fulfillment. Shipment creation is restricted to YUNELA/SYSTEM. Shipment lifecycle changes are orchestrated transactionally with the corresponding Fulfillment transition so there is no independent authoritative Shipment lifecycle.
- FAILED, LOST, CANCELLED and RETURNED remain operational fulfillment states. No automatic refund, reversal, replacement, reshipment or store credit is performed.
- F2 uses no queue, event bus, workflow engine, ORM, carrier integration or public API.

## Concurrency and idempotency
All state-changing use cases read the current state within a repository transaction, validate it, perform dependent writes in that transaction, and commit the lifecycle/audit/inventory effects atomically. Operation keys are persisted through the existing F1 `fulfillment_events.event_key` uniqueness boundary. Duplicate event append returns the existing authoritative audit outcome rather than silently reporting a missing write.

The F2 tests do not claim that same-connection Promise scheduling is proof of multi-connection contention. F2 relies on transactional conditional updates and SQLite writer serialization; deeper multi-connection race/load proof is deferred to the stage that owns that concurrency hardening (F4) unless a practical F2 environment test is available.

## Non-goals
No F1 schema redesign, D2/D3.1 changes, payment changes, Purchase changes, recommendation changes, frontend/API, analytics, carrier integration, split shipment, multi-fulfillment or self-service returns.
