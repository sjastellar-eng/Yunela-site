CREATE TABLE payment_attempts (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  provider TEXT NOT NULL CHECK(provider = 'MONO'),
  provider_invoice_id TEXT,
  merchant_reference TEXT NOT NULL,
  requested_amount INTEGER NOT NULL CHECK(requested_amount >= 0),
  requested_currency TEXT NOT NULL CHECK(requested_currency = 'UAH'),
  state TEXT NOT NULL CHECK(state IN ('CREATED','INITIATED','REQUIRES_ACTION','SUCCEEDED','DECLINED','EXPIRED','FAILED','CANCELLED')),
  provider_status TEXT,
  provider_modified_at TEXT,
  provider_event_fingerprint TEXT,
  provider_event_reference TEXT,
  idempotency_key TEXT NOT NULL,
  payment_page_url TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  confirmed_at TEXT,
  UNIQUE(order_id, idempotency_key),
  UNIQUE(provider_invoice_id),
  UNIQUE(merchant_reference)
);

ALTER TABLE purchases ADD COLUMN payment_attempt_id TEXT REFERENCES payment_attempts(id) ON DELETE RESTRICT;
ALTER TABLE purchases ADD COLUMN provider TEXT CHECK(provider = 'MONO');
ALTER TABLE purchases ADD COLUMN provider_invoice_id TEXT;
ALTER TABLE purchases ADD COLUMN provider_reference TEXT;

CREATE UNIQUE INDEX idx_purchases_payment_attempt ON purchases(payment_attempt_id) WHERE payment_attempt_id IS NOT NULL;
CREATE UNIQUE INDEX idx_purchases_provider_invoice ON purchases(provider_invoice_id) WHERE provider_invoice_id IS NOT NULL;
CREATE INDEX idx_payment_attempts_customer ON payment_attempts(customer_id, created_at);
CREATE INDEX idx_payment_attempts_order ON payment_attempts(order_id, created_at);
