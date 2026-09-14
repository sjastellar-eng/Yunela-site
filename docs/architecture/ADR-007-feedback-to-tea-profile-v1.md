# ADR-007 — Feedback → Tea Profile V1

## Status
Accepted for Stage C5.

## Context
C5 closes the discovery loop by converting stored structured tea feedback into persistent TastePreferences that can be supplied to the existing Recommendation V1 FinderProfileReference.

C5 does not change Recommendation V1 (C3), Discovery Box V1 (C4), recommendation weights, thresholds, classification, algorithm version, recommendation history semantics, or Discovery Box selection policy.

## Decision
Feedback remains the immutable source event. TastePreferences is derived state and is rebuilt deterministically from the customer's stored feedback history ordered by `createdAt` ascending and `id` ascending.

Only the following canonical tags are mapped:

| sensoryTag | target |
| --- | --- |
| floral | aroma: `floral` |
| fruity | aroma: `fruity` |
| mineral | aroma: `mineral` |
| earthy | aroma: `earthy` |
| woody | aroma: `woody` |
| creamy | aroma: `creamy` |
| fresh | freshness |
| sweet | sweetness |
| roasted | roastDepth |
| deep | roastDepth |

Tag normalization is trim + case-insensitive lowercase matching. Unknown tags remain unchanged in raw `Feedback.sensoryTags` and do not affect TastePreferences.

Numeric dimensions use 0–100. A missing numeric value starts at 50. Feedback signals are:

- `Loved it`: +10
- `Liked it`: +5
- `Not for me`: -10

Values are clamped to 0–100. If several mapped tags in one event target the same numeric dimension, their signal contributions are averaged before the single dimension update. Across separate events, updates are applied independently in deterministic order.

Aroma is categorical: positive feedback adds canonical mapped aroma tags; `Not for me` removes them if present. Aroma values are stored canonically and deterministically sorted.

No body, context, familiarity, discoveryTolerance, quality, free-text interpretation, synonym expansion, NLP, AI, ML, or additional dimensions are inferred.

Duplicate feedback IDs are rejected before persistence, so the same feedback event cannot mutate the derived profile twice. The profile can also be rebuilt from the complete stored feedback history, providing deterministic recovery of derived TastePreferences.

## Application boundary

The existing `POST /api/v1/feedback` endpoint persists the raw feedback and then rebuilds the customer's Tea Profile. Existing profile endpoints remain the C2 boundary; no duplicate routes are introduced.

The derived profile can be projected to the existing `FinderProfileReference` shape without changing its contract.

## Persistence

No database migration is required. Existing `tea_feedback` and `tea_profiles` tables already persist the raw source event and derived taste state. Referential integrity remains enforced by the existing foreign keys.

## Consequences

- Raw feedback remains auditable and is never overwritten by profile updates.
- Derived TastePreferences is reproducible from stored structured feedback.
- C3 consumes the resulting FinderProfileReference unchanged.
- C4 consumes C3 recommendations unchanged.
- Future semantic/NLP interpretation remains explicitly deferred.
