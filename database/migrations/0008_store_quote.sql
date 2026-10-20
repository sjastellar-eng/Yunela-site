CREATE TABLE store_quotes(id TEXT PRIMARY KEY, customer_id TEXT NOT NULL REFERENCES customers(id), fingerprint TEXT NOT NULL, snapshot_json TEXT NOT NULL, expires_at TEXT NOT NULL);
CREATE INDEX idx_store_quotes_customer ON store_quotes(customer_id);
