PRAGMA foreign_keys = ON;

CREATE TABLE schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE tea_families (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE tea_subfamilies (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES tea_families(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  UNIQUE(family_id, name),
  UNIQUE(id, family_id)
);

CREATE TABLE tea_styles (
  id TEXT PRIMARY KEY,
  subfamily_id TEXT REFERENCES tea_subfamilies(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  UNIQUE(subfamily_id, name),
  UNIQUE(id, subfamily_id)
);

CREATE TABLE suppliers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE provenance_records (
  id TEXT PRIMARY KEY,
  supplier_id TEXT REFERENCES suppliers(id) ON DELETE SET NULL,
  source_reference TEXT,
  province TEXT,
  area TEXT,
  region TEXT,
  cultivar TEXT,
  confidence TEXT NOT NULL CHECK(confidence IN ('unknown','low','medium','high','verified')),
  created_at TEXT NOT NULL
);

CREATE TABLE teas (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  chinese_name TEXT,
  transliteration TEXT,
  family_id TEXT NOT NULL REFERENCES tea_families(id) ON DELETE RESTRICT,
  subfamily_id TEXT,
  style_id TEXT,
  province TEXT,
  area TEXT,
  region TEXT,
  cultivar TEXT,
  harvest_season TEXT,
  harvest_year INTEGER,
  processing TEXT,
  oxidation_fermentation TEXT,
  production_date TEXT,
  sensory_json TEXT NOT NULL,
  discovery_distance INTEGER NOT NULL CHECK(discovery_distance BETWEEN 0 AND 100),
  price_amount INTEGER NOT NULL CHECK(price_amount >= 0),
  price_currency TEXT NOT NULL CHECK(length(price_currency)=3 AND price_currency = upper(price_currency)),
  pack_size_grams INTEGER NOT NULL CHECK(pack_size_grams > 0),
  supply_status TEXT NOT NULL CHECK(supply_status IN ('unknown','available','limited','unavailable','discontinued')),
  provenance_confidence TEXT NOT NULL CHECK(provenance_confidence IN ('unknown','low','medium','high','verified')),
  publishing_state TEXT NOT NULL CHECK(publishing_state IN ('draft','pending_qa','published','archived')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(subfamily_id, family_id) REFERENCES tea_subfamilies(id, family_id) ON DELETE RESTRICT,
  FOREIGN KEY(style_id, subfamily_id) REFERENCES tea_styles(id, subfamily_id) ON DELETE RESTRICT
);

CREATE TABLE tea_lots (
  id TEXT PRIMARY KEY,
  tea_id TEXT NOT NULL REFERENCES teas(id) ON DELETE RESTRICT,
  supplier_id TEXT REFERENCES suppliers(id) ON DELETE SET NULL,
  provenance_id TEXT REFERENCES provenance_records(id) ON DELETE SET NULL,
  lot_code TEXT NOT NULL UNIQUE,
  production_date TEXT,
  harvest_year INTEGER,
  inventory_quantity INTEGER NOT NULL DEFAULT 0 CHECK(inventory_quantity >= 0),
  supply_status TEXT NOT NULL CHECK(supply_status IN ('unknown','available','limited','unavailable','discontinued')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_teas_family ON teas(family_id);
CREATE INDEX idx_teas_subfamily ON teas(subfamily_id);
CREATE INDEX idx_teas_style ON teas(style_id);
CREATE INDEX idx_tea_lots_tea ON tea_lots(tea_id);
CREATE INDEX idx_tea_lots_supplier ON tea_lots(supplier_id);
CREATE INDEX idx_tea_lots_provenance ON tea_lots(provenance_id);

CREATE TABLE customers (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE tea_profiles (
  customer_id TEXT PRIMARY KEY REFERENCES customers(id) ON DELETE CASCADE,
  taste_preferences_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE customer_tea_preferences (
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  tea_id TEXT NOT NULL REFERENCES teas(id) ON DELETE RESTRICT,
  preference TEXT NOT NULL CHECK(preference IN ('liked','disliked')),
  PRIMARY KEY(customer_id, tea_id)
);

CREATE TABLE tea_feedback (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  tea_id TEXT NOT NULL REFERENCES teas(id) ON DELETE RESTRICT,
  value TEXT NOT NULL CHECK(value IN ('Loved it','Liked it','Not for me')),
  sensory_tags_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_feedback_customer ON tea_feedback(customer_id);
CREATE INDEX idx_feedback_tea ON tea_feedback(tea_id);

CREATE TABLE recommendation_history (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  tea_id TEXT NOT NULL REFERENCES teas(id) ON DELETE RESTRICT,
  algorithm_version TEXT NOT NULL,
  score REAL NOT NULL CHECK(score >= 0 AND score <= 100),
  classification TEXT NOT NULL CHECK(classification IN ('MATCH','STRETCH','WILDCARD')),
  reasons_json TEXT NOT NULL,
  context TEXT,
  profile_reference_json TEXT NOT NULL,
  outcome TEXT CHECK(outcome IN ('purchased','feedback_received','second_purchase','unknown')),
  created_at TEXT NOT NULL
);

CREATE INDEX idx_recommendations_customer ON recommendation_history(customer_id, created_at);
CREATE INDEX idx_recommendations_tea ON recommendation_history(tea_id);
