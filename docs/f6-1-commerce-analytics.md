# YUNELA F6.1 — Commerce Read-only Analytics

Status: implementation PR; **no merge authorized**.

## Financial contract

Gross Confirmed Revenue is the sum of `purchases.amount` in minor UAH units for a selected UTC confirmation interval, **only** when:
- The linked Order is **currently** `confirmed`.
- Purchase, Order and PaymentAttempt have the same order/customer identifiers.
- The linked PaymentAttempt has `state = 'SUCCEEDED'`, `confirmed_at` present, and matching requested amount/currency.
- The Purchase has a non-null `payment_attempt_id`.

Legacy `PurchaseBoundaryService.recordAuthoritativePurchase` can create Purchase without a payment attempt reference. Its input `AuthoritativePaymentConfirmation` is asserted by the caller, but neither the original Commerce schema nor the resulting Purchase row stores independent verifiable payment evidence. **Such rows are excluded**, even if Order is confirmed. Do not infer payment from Purchase existence alone.

The current Order status is evaluated at query time: a later cancellation removes the Purchase from prior reporting periods. The metric is **current assessed gross confirmed revenue**, not a historical financial snapshot or net revenue. Refunds are not subtracted; refund ledger is out of scope.

A single Purchase is counted once, even when an Order has multiple items or payment attempts. Top SKU quantities use only eligible purchases. `ordersCreated` and `ordersByStatus` use `orders.created_at`; Purchase metrics and top SKUs use `purchases.confirmed_at`.

## API

All routes require an existing authenticated **OPERATOR** bearer token.

- `GET /api/v1/analytics/overview?from=<UTC>&to=<UTC>`
  Returns `from`, `to`, `currency`, `ordersCreated`, `cancelledOrders`, `confirmedPurchases`, `grossConfirmedRevenueMinor`, `averageConfirmedOrderValueMinor`.
- `GET /api/v1/analytics/commerce?from=<UTC>&to=<UTC>&limit=10`
  Returns `from`, `to`, `currency`, `ordersByStatus`, `topPurchasedSKUs` with `sku`, `unitsSold`, `orderCount`.

All timestamps are UTC ISO-8601. Intervals are half-open [from, to), maximum 366 days. `limit` must be an integer from 1 to 50 (default 10). Invalid arguments: HTTP 400. Missing auth: 401. Non-operator: 403.

No event ingestion, schema migration, analytics sink, inventory mutation, Shipment mutation, or payment lifecycle changes.

## Verification gates

Run `npm ci`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` on exact PR HEAD. Verify F4 inventory concurrency/rollback and F5 Shipment concurrency/rollback in the same test run. Do not claim PASS without runtime logs.
