CREATE TABLE partner_catalog (
 sku TEXT PRIMARY KEY,
 name TEXT NOT NULL,
 family TEXT NOT NULL DEFAULT 'UNKNOWN',
 image_path TEXT,
 retail_amount INTEGER CHECK(retail_amount > 0),
 procurement_amount INTEGER CHECK(procurement_amount >= 0),
 procurement_note TEXT,
 stock INTEGER CHECK(stock >= 0),
 reserved INTEGER NOT NULL DEFAULT 0 CHECK(reserved >= 0),
 availability TEXT NOT NULL CHECK(availability IN ('IN_STOCK','PREORDER','REQUEST','UNAVAILABLE')),
 confirmed INTEGER NOT NULL DEFAULT 0 CHECK(confirmed IN (0,1)),
 test_fixture INTEGER NOT NULL DEFAULT 0 CHECK(test_fixture IN (0,1)),
 packaging TEXT NOT NULL DEFAULT 'UNKNOWN',
 terms_note TEXT,
 updated_at TEXT NOT NULL,
 CHECK(availability != 'IN_STOCK' OR (confirmed = 1 AND retail_amount IS NOT NULL AND stock IS NOT NULL)),
 CHECK(availability != 'PREORDER' OR (confirmed = 1 AND retail_amount IS NOT NULL AND terms_note IS NOT NULL)),
 CHECK(stock IS NULL OR reserved <= stock)
);
CREATE TABLE store_sessions (
 token_hash TEXT PRIMARY KEY,
 customer_id TEXT NOT NULL REFERENCES customers(id),
 expires_at TEXT NOT NULL
);
CREATE TABLE partner_tasks (
 order_id TEXT PRIMARY KEY REFERENCES orders(id),
 status TEXT NOT NULL CHECK(status IN ('NEW','QUEUED_TEST','PACKING','SHIPPED','DELIVERED','CANCELLED')),
 branding_requested INTEGER NOT NULL CHECK(branding_requested IN (0,1)),
 branding_confirmed INTEGER NOT NULL DEFAULT 0 CHECK(branding_confirmed IN (0,1)),
 tracking TEXT,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE TABLE partner_task_events (
 id TEXT PRIMARY KEY,
 order_id TEXT NOT NULL REFERENCES partner_tasks(order_id),
 actor TEXT NOT NULL,
 status TEXT NOT NULL,
 created_at TEXT NOT NULL
);
