-- STV SHOP — Cloudflare D1 schema
-- Apply with: wrangler d1 migrations apply stv-shop --remote

CREATE TABLE IF NOT EXISTS settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS categories (
  id          TEXT PRIMARY KEY,
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  image       TEXT NOT NULL DEFAULT 'fabrics/hero.jpg',
  accent      TEXT NOT NULL DEFAULT '#a34163',
  sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS routes (
  id         TEXT PRIMARY KEY,
  label      TEXT NOT NULL,
  path       TEXT NOT NULL,
  header     INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS products (
  id               TEXT PRIMARY KEY,
  slug             TEXT NOT NULL UNIQUE,
  name             TEXT NOT NULL,
  type             TEXT NOT NULL DEFAULT 'قماش',
  category_id      TEXT NOT NULL DEFAULT 'plain',
  description      TEXT NOT NULL DEFAULT '',
  price            REAL NOT NULL DEFAULT 0,
  compare_at_price REAL,
  image            TEXT NOT NULL DEFAULT 'fabrics/hero.jpg',
  images_json      TEXT NOT NULL DEFAULT '[]',
  colors_json      TEXT NOT NULL DEFAULT '[]',
  specs_json       TEXT NOT NULL DEFAULT '{}',
  faqs_json        TEXT NOT NULL DEFAULT '[]',
  colors_enabled   INTEGER NOT NULL DEFAULT 1,
  is_new           INTEGER NOT NULL DEFAULT 0,
  is_featured      INTEGER NOT NULL DEFAULT 1,
  hidden           INTEGER NOT NULL DEFAULT 0,
  stock_meters     REAL NOT NULL DEFAULT 10,
  source_url       TEXT NOT NULL DEFAULT '',
  origin           TEXT NOT NULL DEFAULT 'seed',
  sort_order       INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL DEFAULT (date('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_sort ON products(sort_order, created_at DESC);

CREATE TABLE IF NOT EXISTS orders (
  id           TEXT PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  status       TEXT NOT NULL DEFAULT 'new',
  customer     TEXT NOT NULL DEFAULT '{}',
  items        TEXT NOT NULL DEFAULT '[]',
  totals       TEXT NOT NULL DEFAULT '{}',
  note         TEXT NOT NULL DEFAULT '',
  channel      TEXT NOT NULL DEFAULT 'web',
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS media (
  key        TEXT PRIMARY KEY,
  url        TEXT NOT NULL,
  bytes      INTEGER NOT NULL DEFAULT 0,
  product    TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
