# ADR-009 — D2 Commerce / Cart / Order / Purchase Boundary

## Status
Accepted for D2 implementation.

## Decision
YUNELA D2 keeps commerce server-authoritative and deliberately small:

`Customer → Cart → immutable Order snapshot → Payment Boundary → authoritative Purchase`.

Commerce consumes canonical SKU and price from a Catalog / Commercial Product boundary. It does not generate SKUs, own tea taxonomy, recalculate C3/C4/C5 logic, reserve or decrement inventory, or implement a payment provider.

## Anonymous customer ownership context
All customer-scoped D2 HTTP operations receive the anonymous ownership context through the `X-Customer-Id` request header. This value is an ownership reference, not authentication, authorization, a session, JWT, OAuth identity, password, or security token.

The external D2 API does not accept customer ownership through the request body, query string, path parameters, cookies, sessions, or alternative headers. The server compares the header value with the resource owner for existing Cart and Order resources. Missing or unknown customer IDs use the existing application validation/customer error semantics and never trigger implicit customer creation.

## Runtime rules
- UAH only; money is integer minor units.
- D2 discounts are zero.
- D2 shipping charge is zero UAH; destination is stored as an Order snapshot.
- Inventory authority remains `tea_lots.inventory_quantity` through the existing Tea repository.
- Cart mutations validate availability but do not reserve stock.
- Order creation re-resolves price and availability and snapshots all commercial values.
- Discovery Box is one commercial SKU / one CartItem / one OrderItem; its six-tea C4 composition is copied into an immutable OrderItem snapshot.
- Order state is `created | confirmed | cancelled` and never means paid, purchased, or fulfilled.
- Purchase has no public client endpoint and can only be recorded through the internal authoritative payment boundary.
- Provider-neutral analytics emits `add_to_cart`, `order_created`, and authoritative `purchase` only after successful state transitions.

## Persistence
SQLite remains the persistence adapter. D2 adds carts, cart_items, orders, order_items, purchases, and a minimal `commercial_products` consumption boundary. Order creation is protected by `(customer_id, idempotency_key)`, cart SKU uniqueness by `(cart_id, sku)`, and purchase uniqueness by `order_id`.

## Non-goals
No Stripe/LiqPay/Mono, webhooks, refunds, shipping provider, fulfillment, taxes, discounts, authentication, reservation engine, inventory decrement, AI, recommendation changes, frontend redesign, event bus, CQRS, or microservices.
