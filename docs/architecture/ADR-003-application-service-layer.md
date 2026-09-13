# ADR-003 — Application / Service Layer

## Status
Proposed for Stage C1.

## Context
YUNELA needs a stable application boundary between future HTTP/API delivery and the relational persistence foundation introduced in Stage B. Application use cases must remain testable without SQLite and must not own SQL or HTTP concerns.

## Decision
Stage C1 introduces application services that depend on repository interfaces:

- `TeaService`
- `CustomerService`
- `TeaProfileService`
- `FeedbackService`
- `RecommendationApplicationService`

SQLite-specific persistence is isolated in repository adapters. Existing PR #2 contracts remain the canonical domain/application data types.

Application errors use a small stable code set: validation, not found, conflict, domain-rule violation, persistence, unexpected, and not implemented. Raw SQLite errors are normalized at the persistence adapter boundary.

Authentication and authorization are represented only as future boundaries (`CurrentCustomerContext`, `AuthenticationBoundary`, `AuthorizationBoundary`). No authentication mechanism is implemented in C1.

The recommendation service implements the existing PR #2 `RecommendationService` contract, validates requests/results, and delegates to a `RecommendationEngine`. The production C1 engine is intentionally not configured; deterministic recommendation logic is deferred to Stage C3.

## Tea write and taxonomy policy

The PR #2 `Tea` contract remains the canonical read/domain representation, including its `inventory` field. C1 does not modify that contract.

Application Tea writes use `CreateTeaInput` / `UpdateTeaInput`, both aliases of `TeaWriteInput = Omit<Tea, 'inventory'>`. Inventory is therefore not an authoritative application write field. The repository write boundary also excludes inventory. Tea inventory is derived from `tea_lots`; creating or updating a Tea cannot set it. Lot inventory remains the persistence source of truth.

`Tea.family`, `Tea.subfamily`, and `Tea.style` are canonical taxonomy IDs in the application Tea representation. `TeaTaxonomyReference` supplies the persistence taxonomy IDs. C1 requires the supplied IDs to be consistent: family must match, and when subfamily/style are supplied their corresponding Tea fields must match as well. A Tea cannot provide subfamily or style independently of the corresponding taxonomy reference. This prevents two competing taxonomy authorities without changing the PR #2 contract.

## Mapping policy

### Core Tea fields
The `Tea` contract is the application read model for core catalog data: identity, naming, taxonomy references, sensory profile, discovery distance, price, pack size, supply state, provenance confidence, and publishing state.

### Lot / traceability enrichment
`batchLot`, `supplierReference`, and `lotTraceability` are not reconstructed from the current `findTeaById()` row mapping. Stage B deliberately models lot, supplier, and provenance as first-class persistence records. C1 therefore does not silently flatten those records into the core Tea application model.

For C1 application reads, inventory remains derived from `tea_lots`. Supplier/provenance/lot details require an explicit enrichment/read-model use case when one is needed. No PR #2 contract was changed to force that enrichment prematurely.

### Profile derived fields
The current persistence schema has no purchase/order table. Therefore `TeaProfile.purchasedTeaIds` is returned as an empty derived collection until the commerce/purchase foundation exists. `feedbackIds` and `recommendationIds` are derived from their respective persistence tables. Liked/disliked tea IDs come from `customer_tea_preferences`.

This is an explicit read-model policy, not a new parallel schema.

## Consequences
- HTTP controllers can be added in C2 without moving business logic into controllers.
- SQLite can be replaced by another persistence implementation without rewriting application services, provided repository interfaces are preserved.
- Tea inventory cannot be changed through Tea application create/update commands; it must be managed through lot-level inventory use cases when that capability is introduced.
- C1 does not implement API, authentication, payments, AI/ML, or the recommendation algorithm.
