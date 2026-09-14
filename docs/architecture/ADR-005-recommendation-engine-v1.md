# ADR-005 — Deterministic Recommendation Engine V1

## Status

Accepted for Stage C3 implementation.

## Context

YUNELA's primary product loop depends on matching a customer taste profile to curated Chinese tea inventory. Stage C3 introduces the first real recommendation implementation while deliberately avoiding AI/ML infrastructure.

The canonical recommendation contract from Stage A defines six weighted signals and three UX classification bands. The current Tea and Finder contracts do not expose every conceptual signal with production-grade structure; C3 therefore uses only signals that are actually present and makes unavailable signals explicit.

## Decision

Implement a pure deterministic scoring engine under `src/domain/recommendation/engine.ts`.

The engine:

- accepts a structured Finder/Taste profile and Tea records;
- filters clearly ineligible customer-facing teas before scoring;
- calculates bounded component scores from available structured data;
- aggregates available components using the approved initial weights;
- renormalizes by the sum of weights for available components rather than silently inventing neutral values;
- classifies scores as MATCH (>=80), STRETCH (65–79), WILDCARD (50–64), and excludes scores below 50;
- sorts by score descending and Tea ID ascending as the deterministic tie-breaker;
- produces deterministic explanation strings from score bands;
- emits the canonical algorithm version `recommendation-v1`.

### Approved weights

| Component | Weight |
| --- | ---: |
| Taste fit | 0.50 |
| Body | 0.15 |
| Roast / depth | 0.10 |
| Familiarity / accessibility | 0.10 |
| Context / role | 0.05 |
| Discovery tolerance | 0.10 |

These are an initial matching hypothesis, not a scientific quality model. They must remain versioned and can be changed only through a future product/technical decision and a new algorithm version.

### Current signal mapping

- Taste fit uses available sweetness, freshness, and exact normalized aroma overlap.
- Body uses profile body versus Tea sensory body.
- Roast/depth uses profile roastDepth versus the mean of Tea roast and depth.
- Familiarity/accessibility uses the existing Tea discovery distance and explicit familiarity bands.
- Discovery tolerance uses the existing Tea discovery distance and explicit tolerance bands.
- Context is unavailable because the current Tea contract has no structured context/role attribute. It is not treated as neutral.

### Missing-data policy

A component with insufficient structured input is `null`/unavailable. Unavailable components contribute neither score nor weight to the aggregate. The aggregate is divided by the total weight of available components. If no component is available, the Tea is not recommended.

This avoids random, hidden, or implicit neutral values and keeps ranking deterministic.

### Eligibility

Customer-facing recommendations require `publishingState === 'published'`, positive derived inventory, and a supply status other than `unavailable` or `discontinued`. Inventory remains derived from `tea_lots`; C3 does not introduce a second inventory authority.

### History

`RecommendationApplicationService` remains the application boundary. It obtains candidate Teas through the existing repository port, delegates scoring to the deterministic engine, stamps the canonical algorithm version and request timestamp, and persists results through the existing `RecommendationHistoryRepository`. No second history store or migration is introduced.

The optional `customerId` on `RecommendationRequest` is the minimal backward-compatible addition required to associate a recommendation run with an existing customer for history persistence. Anonymous requests may still be calculated but are not persisted to customer history.

Each persisted history entry now receives a UUID-backed persistence identifier independent of customer, timestamp, and result index. This prevents primary-key collisions when repeated runs occur for the same customer at the same timestamp. UUID generation is used only for persistence identity; it is not part of scoring or ranking.

The persisted `profile_reference_json` now contains the exact `RecommendationRequest.profileReference` used for the engine invocation. The existing `RecommendationHistoryEntry` contract is extended only with this canonical profile reference so historical recommendations remain auditable and reproducible. No second profile model or schema migration is required because the existing database column already stores JSON.

### Explanations

Explanations are deterministic templates based only on calculated component scores. They do not introduce cultural, origin, quality, or sensory claims that are absent from the Tea record, and they do not use an LLM.

## Consequences

Positive:

- same structured inputs produce the same scoring and ranking;
- the scoring logic is isolated from HTTP and persistence;
- recommendations are explainable and versioned;
- history records cannot collide merely because two runs share customer/timestamp/index values;
- the exact profile reference used by a recommendation is retained for auditability;
- existing C2 endpoint can execute the real engine without a transport redesign;
- C4 can consume MATCH/STRETCH/WILDCARD ordering for Discovery Box selection.

Limitations:

- current contracts do not provide structured Tea context/role, so the 5% context component is unavailable and its weight is redistributed among available components;
- familiarity and discovery tolerance currently rely on the existing discovery-distance field plus explicit string bands;
- customer purchase history is not yet represented as a recommendation input beyond existing profile data;
- the algorithm has not been validated against real customer outcomes.

## Non-goals

C3 does not introduce AI, ML, LLMs, embeddings, vector search, adaptive weighting, probabilistic ranking, recommendation infrastructure, payments, subscriptions, Club, loyalty, checkout redesign, frontend redesign, or a Discovery Box orchestration service.

## Future validation

Recommendation-v1 must eventually be evaluated against real customer outcomes such as feedback, purchase, second purchase, and repeat recommendation behavior. A validated change to scoring semantics must use a new algorithm version so historical recommendations retain their original meaning.
