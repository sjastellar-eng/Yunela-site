PRAGMA foreign_keys = ON;

CREATE TABLE fulfillments (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL UNIQUE REFERENCES orders(id) ON DELETE RESTRICT,
  purchase_id TEXT NOT NULL UNIQUE REFERENCES purchases(id) ON DELETE RESTRICT,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK(status IN ('PENDING','READY','PENDING_CUSTOMER_APPROVAL','PACKING','PACKED','SHIPPED','DELIVERED','FAILED','LOST','RETURNED','CANCELLED')),
  shipping_snapshot_json TEXT NOT NULL,
  items_snapshot_json TEXT NOT NULL,
  failure_code TEXT,
  failure_reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE fulfillment_items (
  id TEXT PRIMARY KEY,
  fulfillment_id TEXT NOT NULL REFERENCES fulfillments(id) ON DELETE CASCADE,
  order_item_id TEXT NOT NULL REFERENCES order_items(id) ON DELETE RESTRICT,
  sku TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK(quantity > 0),
  product_snapshot_json TEXT NOT NULL,
  provenance_reference TEXT,
  allocation_status TEXT NOT NULL CHECK(allocation_status IN ('PENDING','ALLOCATED','CONSUMED','RELEASED')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE inventory_allocations (
  id TEXT PRIMARY KEY,
  fulfillment_item_id TEXT NOT NULL REFERENCES fulfillment_items(id) ON DELETE CASCADE,
  tea_lot_id TEXT NOT NULL REFERENCES tea_lots(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK(quantity > 0),
  status TEXT NOT NULL CHECK(status IN ('RESERVED','CONSUMED','RELEASED')),
  allocated_at TEXT,
  consumed_at TEXT,
  released_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(fulfillment_item_id, tea_lot_id)
);

CREATE TABLE shipments (
  id TEXT PRIMARY KEY,
  fulfillment_id TEXT NOT NULL UNIQUE REFERENCES fulfillments(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  carrier TEXT,
  tracking_number TEXT,
  tracking_url TEXT,
  shipped_at TEXT,
  delivered_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE fulfillment_events (
  id TEXT PRIMARY KEY,
  fulfillment_id TEXT NOT NULL REFERENCES fulfillments(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  actor TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  event_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_fulfillments_order ON fulfillments(order_id);
CREATE INDEX idx_fulfillments_purchase ON fulfillments(purchase_id);
CREATE INDEX idx_fulfillments_customer ON fulfillments(customer_id, created_at);
CREATE INDEX idx_fulfillment_items_fulfillment ON fulfillment_items(fulfillment_id);
CREATE INDEX idx_fulfillment_items_order_item ON fulfillment_items(order_item_id);
CREATE INDEX idx_inventory_allocations_item ON inventory_allocations(fulfillment_item_id);
CREATE INDEX idx_inventory_allocations_lot ON inventory_allocations(tea_lot_id);
CREATE INDEX idx_shipments_fulfillment ON shipments(fulfillment_id);
CREATE INDEX idx_fulfillment_events_fulfillment ON fulfillment_events(fulfillment_id, occurred_at);
CREATE INDEX idx_fulfillment_events_event_key ON fulfillment_events(event_key);
