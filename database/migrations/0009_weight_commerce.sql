CREATE TABLE commercial_records(source_sku TEXT PRIMARY KEY REFERENCES partner_catalog(sku), version TEXT NOT NULL, payload_json TEXT NOT NULL, digest TEXT NOT NULL, stock_grams INTEGER CHECK(stock_grams>=0), reserved_grams INTEGER NOT NULL DEFAULT 0 CHECK(reserved_grams>=0), CHECK(stock_grams IS NULL OR reserved_grams<=stock_grams));
CREATE TABLE commercial_policies(version TEXT PRIMARY KEY, payload_json TEXT NOT NULL, active INTEGER NOT NULL CHECK(active IN(0,1)));
CREATE TABLE commercial_imports(digest TEXT PRIMARY KEY, actor TEXT NOT NULL, created_at TEXT NOT NULL);
ALTER TABLE cart_items ADD COLUMN commercial_snapshot_json TEXT;
ALTER TABLE order_items ADD COLUMN commercial_snapshot_json TEXT;
CREATE TABLE order_commercial_snapshots(order_id TEXT PRIMARY KEY REFERENCES orders(id), quote_json TEXT NOT NULL);
CREATE TABLE partner_handoffs(order_id TEXT PRIMARY KEY REFERENCES orders(id), command_id TEXT NOT NULL UNIQUE, status TEXT NOT NULL, revision INTEGER NOT NULL, payload_json TEXT NOT NULL, acknowledgment_json TEXT, tracking TEXT, updated_at TEXT NOT NULL);
CREATE TABLE test_refunds(order_id TEXT PRIMARY KEY REFERENCES orders(id), status TEXT NOT NULL, amount INTEGER NOT NULL, reason TEXT NOT NULL, created_at TEXT NOT NULL);
