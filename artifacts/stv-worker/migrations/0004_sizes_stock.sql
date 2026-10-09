-- STV SHOP — sizes + stock columns
-- Apply with: wrangler d1 migrations apply stv-shop --remote

ALTER TABLE products ADD COLUMN sizes_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE products ADD COLUMN stock INTEGER NOT NULL DEFAULT 10;
