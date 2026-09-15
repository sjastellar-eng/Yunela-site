# ADR-010 — D3.1 Mono Payment & Purchase Boundary

## Status
Implemented on `dev/stage-d3-1-mono-payment`; pending CEO / technical review.

## Context
D2 deliberately stopped at the payment boundary. D3.1 introduces Mono / monobank Internet Acquiring while keeping Order, PaymentAttempt and Purchase semantics separate.

## Decisions
- Provider is Mono; payment type is `debit`; HOLD is excluded.
- Currency is UAH, ISO numeric code 980, with Money represented in minor units.
- Mono-specific HTTP and signature verification live behind `MonoPaymentAdapter` / `MonoAcquiringAdapter`.
- `PaymentAttempt` is server-owned and has its own state machine; its state never becomes Order state.
- Invoice creation uses the immutable Order pricing snapshot. Client amount, currency, paid state and redirect success are non-authoritative.
- Customer ownership continues to use the existing `X-Customer-Id` boundary. No second identity mechanism is introduced.
- Payment initiation uses `Idempotency-Key` and persists `(order_id, idempotency_key)` uniqueness.
- Mono webhooks are verified against the raw request body using the cached Mono ECDSA public key; on verification failure the adapter refreshes the key once and retries verification.
- Webhook ordering uses `modifiedDate`; stale events cannot overwrite newer provider state.
- A valid Mono success atomically creates Purchase, marks PaymentAttempt `SUCCEEDED`, and changes Order `created` → `confirmed` in one SQLite transaction. Purchase is unique per Order and per PaymentAttempt.
- `purchase` analytics is emitted only after the transaction commits successfully and is emitted once for the authoritative Purchase.
- Expired invoices are not handled by webhook because Mono does not send an expired webhook; expiration/reconciliation remains a future operational concern.
- Refunds/reversals, pРРО/fiscalization semantics, shipping, inventory reservation/decrement and subscriptions are outside D3.1.

## Mono integration evidence
The implementation follows Mono's current acquiring documentation: invoice creation is `POST /api/merchant/invoice/create`, debit is the default payment type, invoice validity defaults to 24 hours, status webhooks carry `x-sign`, and the public ECDSA key is obtained from `GET /api/merchant/pubkey` and may be cached. Webhook delivery is not guaranteed to be ordered, so `modifiedDate` is used for ordering.
