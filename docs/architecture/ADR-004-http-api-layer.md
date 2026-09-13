# ADR-004 — HTTP / API Layer

## Status
Proposed for Stage C2.

## Starting point
Stage C2 starts from merge commit `f8698d7204cefe72f8b6c9509e4c5285dc5ae1e6`, the completed C1 application/service layer.

## Context
YUNELA needs a transport boundary that can expose existing application capabilities over HTTP without moving business logic into controllers or coupling the application to SQLite.

## Decision
C2 introduces a small Node HTTP server with an explicit `/api/v1` version boundary. Request parsing and structural validation happen at the HTTP boundary; application services remain responsible for business/domain validation. HTTP handlers map request DTOs to application service inputs and application outputs to explicit JSON responses.

The API depends on application services, never directly on repository ports or SQLite adapters. The default server composition may wire SQLite repositories at the application composition root, but route handlers do not access the database.

## API surface

- `GET /health`
- `GET /api/v1/teas`
- `GET /api/v1/teas/:id`
- `POST /api/v1/teas`
- `PATCH /api/v1/teas/:id`
- `GET /api/v1/customers/:id`
- `GET /api/v1/customers/:id/profile`
- `POST /api/v1/customers/:id/profile`
- `PATCH /api/v1/customers/:id/profile`
- `POST /api/v1/feedback`
- `POST /api/v1/recommendations`

Tea lists use deterministic `page` and `pageSize` parameters with a maximum page size of 50.

## DTO and validation boundary

HTTP validates JSON shape, content type, body size, path identifiers, pagination and URL/body identity consistency. Domain validation remains in application services. API DTOs are separate from persistence concerns. Tea create/update requests explicitly reject `inventory`; inventory remains derived/read-only according to C1.

Taxonomy references are passed through to the application service, which remains authoritative for family/subfamily/style consistency.

## Error mapping

Application errors are mapped as follows:

- `VALIDATION_ERROR` → HTTP 400
- `NOT_FOUND` → HTTP 404
- `CONFLICT` → HTTP 409
- `DOMAIN_RULE_VIOLATION` → HTTP 422
- `PERSISTENCE_ERROR` → HTTP 500
- `UNEXPECTED_ERROR` → HTTP 500
- `NOT_IMPLEMENTED` → HTTP 501

Responses use a stable machine-readable shape containing `code`, `message`, and `requestId`. Internal SQL errors, stack traces and infrastructure details are not returned.

## Request ID

The API accepts a bounded `x-request-id` value or generates a UUID. The identifier is returned in the response header and error body to correlate an HTTP request without introducing distributed tracing.

## Authentication boundary

C2 does not authenticate requests. Explicit customer IDs are accepted where the existing application services require them. These IDs are not treated as proof of identity. The architecture remains compatible with replacing them with the C1 `CurrentCustomerContext` once authentication is implemented in a later stage.

## Recommendation boundary

C2 exposes the existing `RecommendationApplicationService` only. No scoring, weighting, MATCH/STRETCH/WILDCARD calculation or recommendation selection is implemented in HTTP. The not-configured C1 engine returns `NOT_IMPLEMENTED` / HTTP 501 until C3 supplies the recommendation engine.

## Pagination and payload limits

Tea list pagination is deterministic and limited to 50 records per page. JSON request bodies are capped at 1 MiB. These limits are transport-level safeguards, not domain rules.

## Consequences

- HTTP can evolve independently from application and persistence implementations.
- C2 can be tested through real HTTP requests against isolated in-memory SQLite databases.
- Controllers/handlers remain thin transport adapters.
- Authentication, authorization, payments and recommendation intelligence can be added later without changing the transport architecture.

## Explicit exclusions

C2 does not implement authentication, authorization enforcement, payments, production commerce, AI/ML, embeddings, vector databases, recommendation algorithms, external integrations, UI redesign, microservices, event buses or cloud infrastructure migration.

## Known limitations / follow-up

- No authenticated identity enforcement exists yet by design.
- Tea list pagination currently slices the application service's list result; database-level pagination can be introduced with a future application/repository capability if catalog scale requires it.
- Customer creation is not exposed because the requested C2 minimum surface only requires customer retrieval; registration remains outside C2.
- Recommendation history persistence is not connected to the HTTP recommendation boundary because C3 has not implemented recommendation generation yet.
