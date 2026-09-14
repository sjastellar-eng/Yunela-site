CREATE TABLE commercial_products (
  sku TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK(kind IN ('TEA','DISCOVERY_BOX')),
  name TEXT NOT NULL,
  price_amount INTEGER NOT NULL CHECK(price_amount >= 0),
  price_currency TEXT NOT NULL CHECK(price_currency = 'UAH'),
  tea_id TEXT REFERENCES teas(id) ON DELETE RESTRICT,
  discovery_box_id TEXT REFERENCES discovery_boxes(id) ON DELETE RESTRICT,
  available INTEGER NOT NULL CHECK(available IN (0,1)),
  CHECK ((kind = 'TEA' AND tea_id IS NOT NULL AND discovery_box_id IS NULL) OR (kind = 'DISCOVERY_BOX' AND tea_id IS NULL AND discovery_box_id IS NOT NULL))
);

CREATE TABLE carts (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  currency TEXT NOT NULL CHECK(currency = 'UAH'),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE cart_items (
  id TEXT PRIMARY KEY,
  cart_id TEXT NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  sku TEXT NOT NULL REFERENCES commercial_products(sku) ON DELETE RESTRICT,
  tea_id TEXT REFERENCES teas(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK(quantity > 0),
  unit_price_amount INTEGER NOT NULL CHECK(unit_price_amount >= 0),
  unit_price_currency TEXT NOT NULL CHECK(unit_price_currency = 'UAH'),
  recommendation_history_id TEXT,
  discovery_box_id TEXT REFERENCES discovery_boxes(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(cart_id, sku)
);

CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK(status IN ('created','confirmed','cancelled')),
  currency TEXT NOT NULL CHECK(currency = 'UAH'),
  subtotal_amount INTEGER NOT NULL CHECK(subtotal_amount >= 0),
  discount_amount INTEGER NOT NULL CHECK(discount_amount = 0),
  shipping_amount INTEGER NOT NULL CHECK(shipping_amount = 0),
  total_amount INTEGER NOT NULL CHECK(total_amount = subtotal_amount),
  shipping_snapshot_json TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(customer_id, idempotency_key)
);

CREATE TABLE order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  sku TEXT NOT NULL,
  tea_id TEXT REFERENCES teas(id) ON DELETE RESTRICT,
  tea_name_snapshot TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK(quantity > 0),
  unit_price_amount INTEGER NOT NULL CHECK(unit_price_amount >= 0),
  unit_price_currency TEXT NOT NULL CHECK(unit_price_currency = 'UAH'),
  line_total_amount INTEGER NOT NULL CHECK(line_total_amount >= 0),
  recommendation_history_id TEXT,
  discovery_box_snapshot_json TEXT,
  UNIQUE(order_id, sku)
);

CREATE TABLE purchases (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL UNIQUE REFERENCES orders(id) ON DELETE RESTRICT,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  amount INTEGER NOT NULL CHECK(amount >= 0),
  currency TEXT NOT NULL CHECK(currency = 'UAH'),
  confirmed_at TEXT NOT NULL
);

CREATE INDEX idx_carts_customer ON carts(customer_id, updated_at);
CREATE INDEX idx_cart_items_cart ON cart_items(cart_id);
CREATE INDEX idx_orders_customer ON orders(customer_id, created_at);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_purchases_customer ON purchases(customer_id, confirmed_at);
