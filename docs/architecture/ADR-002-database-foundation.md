# ADR-002 — YUNELA Database Foundation

- Status: Proposed
- Scope: Stage B domain/database foundation
- Supersedes: none
- Related: ADR-001

## Decision

Use relational SQLite as the Stage B persistence foundation, accessed through the small synchronous `better-sqlite3` adapter and explicit SQL migrations.

The persistence boundary is intentionally SQL-first rather than ORM-first. Application/domain contracts remain independent from database row shapes, and repository functions perform the mapping between them.

SQLite is the local/CI database for this stage. A production database provider remains a later deployment decision; the schema avoids SQLite-specific domain concepts so the relational model can be migrated later if required.

## Migration strategy

Migrations are immutable, ordered SQL files under `database/migrations/`.

A small migration runner:

1. creates `schema_migrations` if it does not exist;
2. checks each known migration version;
3. applies unapplied SQL inside a transaction;
4. records the applied version and timestamp.

A fresh database therefore has a deterministic schema, while an existing database can receive later migrations incrementally.

## Domain mapping

The database is not a copy of every TypeScript interface.

- Tea taxonomy is normalized into family → subfamily → style → tea/SKU relationships.
- Supplier and provenance are separate records.
- Lot/batch is a first-class record attached to Tea and may reference supplier/provenance.
- Inventory quantity is lot-level and the Tea contract's aggregate inventory is derived from lots.
- Customer, Tea Profile, feedback and recommendation history are persisted as separate domain records.
- JSON is used only for structured value payloads whose internal shape is already owned by the application contract, such as sensory attributes and taste preferences.

## Money

Monetary persistence uses SQLite `INTEGER` for minor units and a three-character uppercase currency code. No floating-point monetary storage is introduced.

Recommendation scores are not monetary values and remain numeric scores in the recommendation history table.

## Identifiers

Stage B uses application-provided string identifiers consistently across domain records. The database does not introduce a second identifier system.

## State representation

Controlled domain states are enforced with SQL `CHECK` constraints for the current MVP states. This provides database-level protection without creating database-specific enum types that would make future evolution unnecessarily rigid.

## Constraints and indexes

The schema enforces required fields, uniqueness, foreign keys, non-negative inventory and monetary amounts, bounded discovery distance and recommendation score, and controlled state values. Foreign-key and query indexes are added only where they support established relationships or expected lookup paths.

## Security

No credentials or production connection strings are stored in the repository. Stage B does not connect to an external production database.

## Out of scope

This ADR does not introduce:

- API/runtime services
- authentication or authorization
- payments or checkout
- supplier integrations
- procurement automation
- production tea data
- recommendation scoring/ML
- caching/search/vector infrastructure
- microservices
