CREATE TABLE auth_identities (
  id TEXT PRIMARY KEY,
  actor_type TEXT NOT NULL CHECK(actor_type IN ('CUSTOMER','OPERATOR','SUPPLIER')),
  subject_id TEXT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  created_at TEXT NOT NULL,
  CHECK(actor_type <> 'CUSTOMER' OR subject_id IS NOT NULL)
);

CREATE UNIQUE INDEX idx_auth_customer_subject ON auth_identities(subject_id) WHERE actor_type = 'CUSTOMER';
CREATE INDEX idx_auth_actor_type ON auth_identities(actor_type);
