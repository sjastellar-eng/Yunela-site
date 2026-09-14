# ADR-006 — Discovery Box Orchestration V1

## Status
Accepted for Stage C4 implementation.

## Context
C3 provides the single deterministic `recommendation-v1` engine and answers how well each eligible tea fits the customer's Finder profile. YUNELA's Discovery Box needs to operationalize those recommendations as a guided discovery product without creating a second recommendation system.

## Decision
C4 is an orchestration and deterministic selection layer over C3 output.

The flow is:

`Finder Profile → recommendation-v1 → eligible recommendations → role pools → Discovery Box Selection Policy → Discovery Box`

C4 does not recalculate scores, reclassify teas, alter C3 eligibility, duplicate C3 scoring, or generate new explanations when C3 reasons are available.

### Box composition
A successful V1 box contains exactly six unique teas:

- 3 MATCH
- 2 STRETCH
- 1 WILDCARD

Classification and score are inherited from C3.

### Deterministic selection
For each required classification, C4 takes the corresponding C3 candidates, deduplicates tea IDs, sorts by `score DESC` and then `tea.id ASC`, and selects the required count.

Selection must not depend on random values, timestamps, UUIDs, hash iteration order, or incidental database order. Persistence UUIDs may identify stored boxes but cannot influence selection.

### Insufficient candidates
If any required role cannot be filled, C4 fails explicitly with `DISCOVERY_BOX_INSUFFICIENT_CANDIDATES` and exposes controlled role/count details as the error cause. No role substitution, duplicate fallback, invented SKU, threshold change, or reclassification is allowed.

### Versioning
The C3 algorithm version is inherited from recommendation results. C4 uses the canonical selection version `discovery-box-v1`.

### Persistence and auditability
C4 persists the box identity, optional customer reference, C3 algorithm version, C4 selection version, exact profile reference, creation timestamp, and every selected item's tea ID, classification, position, score, and reasons. SQLite remains the persistence implementation; no ORM is introduced.

## Architectural boundaries
The application boundary is:

`HTTP/API → DiscoveryBoxApplicationService → RecommendationApplicationService → Selection Policy → Repository Port → SQLite`

HTTP does not calculate scores, select teas, or access SQLite. The selection policy is transport- and persistence-independent. C3 remains the only recommendation engine.

## Deferred functionality
The following remain outside C4: AI/LLM/ML, embeddings/vector DB, adaptive recommendation, new recommendation weights or thresholds, feedback intelligence, purchase-history scoring, payments/checkout, subscriptions, Club/loyalty, CRM, native app, microservices, fulfillment, assortment expansion, packaging/gram logic, and unrelated frontend redesign.

## Consequences
C4 provides a reproducible and auditable guided-discovery box while preserving the C3 recommendation contract. If the eligible C3 candidate pools cannot satisfy the fixed 3/2/1 composition, the system fails transparently rather than weakening the product contract.
