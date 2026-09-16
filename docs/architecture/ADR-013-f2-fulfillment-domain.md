# ADR-013 — F2 Fulfillment Domain and Application Services

## Status
Implementation stage; pending technical review and CEO merge authorization.

## Context
F0 is the frozen Fulfillment contract. F1 provides persistence only. F2 adds the domain state machine and application orchestration without introducing HTTP, carrier, payment, analytics or a second inventory authority.

## Decisions
- Purchase remains the authoritative commercial outcome; Fulfillment is execution truth; Shipment is physical movement truth.
- Fulfillment creation is sourced only from a valid Purchase whose Order is CONFIRMED and whose authoritative PaymentAttempt is SUCCEEDED. Creation is idempotent and copies immutable execution snapshots.
- Fulfillment transitions are explicit and validated inside SQLite transactions. The F2 application layer never writes SQL directly.
- `tea_lots.inventory_quantity` is the physical on-hand inventory truth. READY does **not** decrement it. READY atomically reserves concrete TeaLots by creating `inventory_allocations` with `RESERVED` status and validating `inventory_quantity - SUM(RESERVED allocations)` for the lot. The allocation rows are an execution/audit reservation ledger, not a second inventory quantity truth.
- PACKED is the physical consumption boundary. It atomically decrements `tea_lots.inventory_quantity` by the quantity of each RESERVED allocation and changes that allocation to `CONSUMED` in the same transaction. A repeated PACKED operation cannot consume again because the fulfillment lifecycle is already terminal for that transition and the allocation is no longer RESERVED.
- Explicit release changes RESERVED allocations to RELEASED but does not increment `tea_lots.inventory_quantity`, because READY never decremented physical stock. Release therefore only removes a reservation claim against available-to-reserve quantity.
- F2 uses SQLite `BEGIN IMMEDIATE` transactions for all mutation orchestration. SQLite permits only one simultaneous write transaction, so READY reservation checks and their allocation writes are serialized at the database boundary. The conditional reservation calculation prevents allocation beyond physical on-hand quantity without introducing a second stock counter.
- Discovery Box composition is validated as the immutable six-component 3 MATCH / 2 STRETCH / 1 WILDCARD snapshot. Shortage moves the Fulfillment to `PENDING_CUSTOMER_APPROVAL`; the shortage event must contain a concrete operational replacement tea (and optional lot) before customer approval can be accepted.
- Customer approval changes only fulfillment execution resolution. The OrderItem/commercial snapshot is never rewritten. Rejected approval does not unblock readiness. F2 records the supplied actor as audit metadata; authentication/authorization of a real customer identity belongs to F3 and must not be confused with operator lifecycle authority.
- MVP has one Shipment per Fulfillment. Shipment creation is restricted to YUNELA/SYSTEM. Shipment lifecycle changes are orchestrated transactionally with the corresponding Fulfillment transition so there is no independent authoritative Shipment lifecycle.
- FAILED, LOST, CANCELLED and RETURNED remain operational fulfillment states. No automatic refund, reversal, replacement, reshipment or store credit is performed.
- F2 uses no queue, event bus, workflow engine, ORM, carrier integration or public API.

## Concurrency and idempotency
All state-changing use cases read the current state within a repository transaction, validate it, perform dependent writes in that transaction, and commit the lifecycle/audit/inventory effects atomically. Operation keys are persisted through the existing F1 `fulfillment_events.event_key` uniqueness boundary. Duplicate event append returns the existing authoritative audit outcome rather than silently reporting a missing write.

F2 uses database transaction serialization and conditional inventory updates as its correctness mechanism. The tests do not claim that same-connection Promise scheduling is proof of multi-connection contention. A deeper multi-connection race/load proof is deferred to F4, the stage that owns deeper concurrency hardening, unless the environment makes a practical isolated multi-process test appropriate without expanding F2 scope.

## Non-goals
No F1 schema redesign, D2/D3.1 changes, payment changes, Purchase changes, recommendation changes, frontend/API, analytics, carrier integration, split shipment, multi-fulfillment or self-service returns.
