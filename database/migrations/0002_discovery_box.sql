CREATE TABLE discovery_boxes (
  id TEXT PRIMARY KEY,
  customer_id TEXT REFERENCES customers(id) ON DELETE CASCADE,
  algorithm_version TEXT NOT NULL,
  selection_version TEXT NOT NULL,
  profile_reference_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE discovery_box_items (
  box_id TEXT NOT NULL REFERENCES discovery_boxes(id) ON DELETE CASCADE,
  tea_id TEXT NOT NULL REFERENCES teas(id) ON DELETE RESTRICT,
  classification TEXT NOT NULL CHECK(classification IN ('MATCH','STRETCH','WILDCARD')),
  position INTEGER NOT NULL CHECK(position BETWEEN 1 AND 6),
  score REAL NOT NULL CHECK(score >= 0 AND score <= 100),
  reasons_json TEXT NOT NULL,
  PRIMARY KEY(box_id, position),
  UNIQUE(box_id, tea_id),
  UNIQUE(box_id, classification, position)
);

CREATE INDEX idx_discovery_boxes_customer ON discovery_boxes(customer_id, created_at);
CREATE INDEX idx_discovery_box_items_tea ON discovery_box_items(tea_id);
