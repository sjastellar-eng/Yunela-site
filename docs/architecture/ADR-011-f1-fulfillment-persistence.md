# ADR-011 — F1 Fulfillment Persistence Foundation

## Status
Implementation stage; pending CEO / technical review.

## Context
F0 froze the YUNELA fulfillment contract. F1 adds only the SQLite persistence foundation required to execute that contract later.

## Decisions
- Preserve SQLite, better-sqlite3, explicit SQL migrations and the existing migration runner.
- Add exactly five persistence entities: `fulfillments`, `fulfillment_items`, `inventory_allocations`, `shipments`, and `fulfillment_events`.
- A Fulfillment references the authoritative Order, Purchase and Customer and is unique per Order and Purchase at database level.
- A FulfillmentItem references an immutable OrderItem source and stores execution snapshots without changing the commercial Order snapshot.
- InventoryAllocation references `tea_lots`; `tea_lots.inventory_quantity` remains the only persisted inventory truth. F1 performs no reserve, consume, release or inventory quantity mutation.
- A Shipment references one Fulfillment and is unique per Fulfillment. No split-shipment structure is introduced.
- FulfillmentEvent is append-oriented audit persistence with a unique `event_key`; it is not an event bus and no event processing is implemented.
- JSON snapshot fields use the repository's existing plain-text JSON storage convention.
- All uniqueness, foreign-key and positive-quantity protections are database constraints, not application-only rules.
- Migration `0005_fulfillment_persistence.sql` is additive and is applied after the existing `0001`–`0004` chain.

## Non-goals
No fulfillment services, state transition logic, API, carrier integration, customer approval workflow, returns workflow, analytics implementation, payment changes, Purchase changes, D2/D3.1 changes, inventory business mutation, ORM or database-engine change.
