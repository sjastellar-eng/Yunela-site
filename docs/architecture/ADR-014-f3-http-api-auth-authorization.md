# ADR-014 — F3 HTTP/API Authentication and Authorization

## Status
Implementation stage; pending technical review and CEO merge authorization.

## Context
F2 provides Fulfillment domain/application semantics but intentionally has no public HTTP/API boundary or real actor authentication. The pre-F3 API used `X-Customer-Id`, which is an untrusted client value and cannot establish identity.

## Decisions
- F3 introduces a dedicated authenticated Fulfillment HTTP API while preserving the existing F0/F1/F2 contracts.
- Customer, operator and supplier identities authenticate with password-backed credentials and short-lived HMAC-signed bearer tokens. `SYSTEM` has no public HTTP authentication path.
- Actor identity is resolved only from the validated bearer token. `X-Customer-Id`, URL customer IDs and request-body customer IDs are never used as authentication identity.
- Customer ownership is checked against the server-resolved customer actor and the immutable `Fulfillment.customerId`.
- Operators may execute Fulfillment lifecycle operations and create Shipments.
- Suppliers have no F3 Fulfillment lifecycle or Shipment authority; no supplier operation is exposed until an explicit supplier contract exists.
- Customer Discovery Box approval uses the server-resolved customer actor. Client-supplied `actor`, `customerId` and timestamp values are ignored.
- Authentication failures return 401. Authenticated actors without the required permission return 403.
- Authentication persistence is additive in migration `0006_authentication`; F1 Fulfillment persistence is unchanged.
- Operator and supplier credentials are provisioned out-of-band through the application service and may be bootstrapped from deployment environment variables. They are not provisioned through public HTTP.

## Non-goals
No changes to Purchase, PaymentAttempt, Fulfillment state transitions, inventory semantics, Discovery Box commercial snapshots, carrier integration, payment provider, ORM, queue/event bus, frontend, or F4 concurrency hardening.
