# ADR-008: Minimal Anonymous Customer Identity

## Status

Proposed — pending Technical Review.

## Context

YUNELA frontend MVP needs a stable, server-created `customerId` so a visitor can retain a customer-scoped Tea Profile, feedback, and recommendation history without introducing authentication or server-side sessions.

The existing Customer domain and SQLite schema already require a non-null unique email. D1.1 is explicitly constrained to avoid a database migration and to avoid implementing authentication.

## Decision

Expose the following minimal identity lifecycle:

- `POST /api/v1/customers` creates an anonymous customer on the server.
- The request has no application payload. Any client-supplied identity fields are ignored; the server is the only authority that creates the ID.
- The server generates a UUID with Node `randomUUID()` and creates the existing `Customer` record.
- The internal required email field is populated with a reserved non-contact value in the `anonymous.yunela.local` domain: `anonymous+<customerId>@anonymous.yunela.local`.
- The POST response is intentionally reduced to `{ "customerId": "..." }`; the internal email is not part of the creation response.
- The frontend stores the returned `customerId` in its client-side storage mechanism.
- Returning visitors use `GET /api/v1/customers/:id` to validate and retrieve the server-side customer.
- If the stored ID no longer exists, the frontend may start a new anonymous lifecycle by calling POST again.
- No cookie/session table, JWT, OAuth, password, MFA, RBAC, or account-security mechanism is introduced by D1.1.
- No database migration is required.

## Consequences

Positive:

- The frontend receives a stable server-owned identity with minimal backend surface area.
- Existing Customer, Profile, and Feedback persistence can be reused without schema changes.
- Authentication remains explicitly out of scope.
- The contract is provider-neutral and can later sit beneath a real authenticated identity model.

Trade-off:

- The current Customer schema represents the anonymous identity's required email with a reserved internal synthetic value. A future authenticated-account model should replace or explicitly separate this representation rather than treating the synthetic address as a real contact address.

## Contract

### Create

`POST /api/v1/customers`

Request body: none.

Success: `201 Created`

```json
{
  "customerId": "550e8400-e29b-41d4-a716-446655440000"
}
```

### Retrieve

`GET /api/v1/customers/:customerId`

Success: `200 OK` with the existing canonical `Customer` representation.

Unknown ID: existing `NOT_FOUND` application error mapped to HTTP 404.

### Method boundaries

- `/api/v1/customers`: POST only.
- `/api/v1/customers/:customerId`: GET only.

## Scope Boundary

D1.1 does not modify C3 recommendation behavior, C4 Discovery Box behavior, or C5 feedback/profile behavior. It only supplies the missing anonymous customer creation path required by the frontend MVP.
