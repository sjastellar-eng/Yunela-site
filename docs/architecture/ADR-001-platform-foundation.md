# ADR-001 — YUNELA Platform Foundation

- Status: Proposed
- Scope: Architecture + contract stage
- Source of truth: YUNELA Development Department Implementation Prompt V1, Product Strategy, UX/UI Specification, Technical Audit

## Context

YUNELA is a Tea Discovery Platform where commerce is one domain layer. The approved product loop is Discover → Finder → Recommendation → Purchase → Feedback → Tea Profile → Next Recommendation → Second Purchase.

The repository currently contains the UI/UX foundation on `feat/yunela-ui-foundation` and no production backend/domain implementation on `main`. This ADR establishes a deliberately simple foundation before domain and integration work.

## Decisions

### Frontend
Use the existing Vite + React + TypeScript foundation from PR #1. Do not replace the UI foundation unless a concrete technical blocker appears.

### Backend
Introduce a single production backend/API application with explicit domain boundaries rather than microservices. The initial boundaries are Tea, Finder/Recommendations, Cart, Orders, Profile/Feedback, Analytics, and supporting Auth/Payments.

### Database
Use a relational SQL database with migrations. Domain contracts remain independent from database implementation details. The exact provider is a deployment decision and must not leak into frontend contracts.

### API
Use typed, explicit, versionable request/response contracts. Frontend calls domain APIs and never depends on database schemas. Exact route naming can evolve while preserving contract semantics.

### Recommendation engine
Implement a deterministic, isolated V1 service. Store `algorithm_version` with each recommendation so later algorithms can coexist and be evaluated. No ML/AI recommender in this stage.

Weights:
- Taste fit: 50%
- Body: 15%
- Roast/depth: 10%
- Familiarity/accessibility: 10%
- Context: 5%
- Discovery tolerance: 10%

Bands:
- MATCH: >= 80
- STRETCH: 65–79
- WILDCARD: 50–64

These are UX matching categories, not tea-quality ratings.

### Analytics
Create one provider-neutral `track(event, payload)` abstraction. Components and domain services must not contain provider-specific analytics calls. Production events must represent real user actions; no fake analytics.

### Authentication
Implement secure registration/session or token handling only after domain contracts are stable. Authorization is enforced server-side for customer-owned resources.

### Commerce and payments
The server is authoritative for product availability, price, quantity and totals. Orders store commercial snapshots. Payment state is persisted and changed only through verified server-side payment flows/webhooks with idempotency.

### Environment and secrets
Secrets exist only in deployment/runtime secret storage. `.env.example` may contain variable names but never credentials. Frontend-exposed configuration must contain no secrets.

### Testing
Critical domain logic gets unit/service/API/integration coverage. Recommendation tests cover classification boundaries and `algorithm_version`. Commerce tests prove client price cannot override server truth. Auth and payment/webhook paths are tested before production use.

## Consequences

This approach keeps the first implementation understandable and replaceable. It intentionally avoids microservices, advanced AI, native apps, subscriptions, Club, Reserve, complex loyalty, and other deferred capabilities.

The main technical risk is that the frontend currently uses local mock state. Phase A contracts therefore become the boundary that later replaces mock data without redesigning the approved UX.

## Next stage

Create and validate canonical domain contracts, then implement domain/database foundations, followed by services/API and integrations. PR #1 remains open and draft until explicitly approved by the owner.