# ADR-001 — YUNELA Platform Foundation

- Status: Proposed
- Scope: Architecture + contract stage
- Source of truth: YUNELA Development Department Implementation Prompt V1, Product Strategy, UX/UI Specification, Technical Audit

## Context

YUNELA is a Tea Discovery Platform where commerce is one domain layer. The approved product loop is Discover → Finder → Recommendation → Purchase → Feedback → Tea Profile → Next Recommendation → Second Purchase.

The repository contains the approved UI/UX foundation on `feat/yunela-ui-foundation`. This ADR establishes a deliberately simple, contract-first foundation before domain, database, API, and integration work.

## Decisions

### Product architecture
YUNELA is a Tea Discovery Platform. Commerce is a supporting domain layer, not the core product identity. The approved discovery loop remains the product boundary for this stage.

### Frontend
Use the existing Vite + React + TypeScript foundation from PR #1. Do not replace the UI foundation unless a concrete technical blocker appears.

### Backend
Use a single production backend/API application with explicit domain boundaries rather than premature microservices. Initial boundaries are Tea, Finder/Recommendations, Cart, Orders, Profile/Feedback, Analytics, and supporting Auth/Payments.

### Database
Use a relational SQL database with migrations. Domain contracts remain independent from database implementation details. The exact provider is a later deployment decision and must not leak into frontend contracts.

### API
Use typed, explicit, versionable request/response contracts. Frontend calls domain APIs and never depends on database schemas. Exact route naming can evolve while preserving contract semantics.

### Recommendation engine
Recommendation V1 is deterministic and isolated. The algorithm version is service-owned/configured rather than client-controlled, and the version actually used is stored with recommendation results/history. No ML/AI recommender is implemented in this stage.

Approved weights:
- Taste fit: 50%
- Body: 15%
- Roast/depth: 10%
- Familiarity/accessibility: 10%
- Context: 5%
- Discovery tolerance: 10%

Approved classification bands:
- MATCH: >= 80
- STRETCH: >= 65 and < 80
- WILDCARD: >= 50 and < 65
- Below 50: no recommendation classification

These are UX matching categories, not tea-quality ratings. The exact mathematical scoring formula is intentionally not defined here because it is not specified by the approved Product Strategy.

### Commerce and money
The server is authoritative for product availability, price, quantity, discounts, and totals. Orders store commercial snapshots. Payment state is changed only through verified server-side payment flows/webhooks with idempotency when payment is implemented.

Canonical monetary values use integer minor units plus a three-letter uppercase ISO 4217 currency code. Floating-point decimal values are not the canonical commerce representation.

Payment implementation is explicitly deferred.

### Tea data and provenance
Production tea facts and discovery placeholders are distinct. Placeholder records cannot be presented as validated production tea facts. No real SKU, provenance, or sensory data is introduced by this architecture stage.

### Customer / Tea Profile
The MVP Tea Profile supports purchased teas, liked/disliked teas, taste preferences, feedback, recommendation history, and subsequent recommendations. Taste preferences are typed to the approved Finder profile dimensions; no additional preference system is introduced here.

Approved feedback values remain: `Loved it`, `Liked it`, `Not for me`.

### Analytics
Use a provider-neutral `track(event, payload)` abstraction. Application code must not depend directly on a specific analytics provider. Approved core product events remain unchanged; supporting technical events may be added only when they do not redefine the product analytics model.

### Testing
Contract-level automated tests are a required quality gate for this stage. CI must run typecheck, lint, tests, and production build. Recommendation tests cover approved classification boundaries and weights; money tests cover integer minor-unit validation; analytics tests cover provider-neutral event forwarding.

### Authentication and authorization
Auth is deferred until domain contracts are stable. Customer-owned resources will be authorized server-side when implemented.

### Environment and secrets
Secrets exist only in deployment/runtime secret storage. `.env.example` may contain variable names but never credentials. Frontend-exposed configuration must contain no secrets.

## Deferred capabilities

The following are intentionally outside this stage:

- Database implementation and migrations
- Backend runtime/API implementation
- Authentication implementation
- Payment/Stripe implementation
- Infrastructure/deployment integrations
- ML/AI recommendation
- Advanced personalization
- AI Tea Concierge
- Club
- Subscription
- Reserve
- Complex loyalty
- Native app
- Premature microservices

## Consequences

This approach keeps the first implementation understandable and replaceable. The contract layer can later back the approved frontend without redesigning the UX. The exact recommendation scoring formula remains an explicit architectural/product question until the approved strategy defines it.

## Next stage

After this contract foundation is validated, the next implementation stage is domain/database foundation. PR #1 remains separate and is not merged by this stage.
