-- Halal Rizq Khidmaat LLP : database schema (SQLite). Runs automatically on server start.
-- A MySQL version is in schema-mysql.sql

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  phone         TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS applications (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL REFERENCES users(id),
  business_name TEXT NOT NULL,
  owner_name    TEXT NOT NULL,
  phone         TEXT NOT NULL,
  email         TEXT NOT NULL,
  address       TEXT NOT NULL,
  city          TEXT NOT NULL,
  state         TEXT NOT NULL,
  pincode       TEXT NOT NULL,
  reg_number    TEXT NOT NULL DEFAULT '',      -- GST / FSSAI (optional)
  scheme        TEXT NOT NULL,
  products      TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','under_review','approved','rejected')),
  remarks       TEXT NOT NULL DEFAULT '',
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_app_user   ON applications(user_id);
CREATE INDEX IF NOT EXISTS idx_app_status ON applications(status);

CREATE TABLE IF NOT EXISTS certificates (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  sr_no          INTEGER NOT NULL UNIQUE,       -- serial number: 1, 2, 3 ...
  cert_no        TEXT NOT NULL UNIQUE,          -- e.g. HRK-2026-00001
  application_id INTEGER NOT NULL UNIQUE REFERENCES applications(id),
  issue_date     TEXT NOT NULL,
  expiry_date    TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Fee structure shown on the Pricing page. Admin can edit these in the admin panel.
CREATE TABLE IF NOT EXISTS fees (
  key    TEXT PRIMARY KEY,
  label  TEXT NOT NULL,
  amount REAL NOT NULL
);
INSERT OR IGNORE INTO fees (key,label,amount) VALUES
  ('registration_fee','Registration fee per year',10000),
  ('per_product_fee','Fee per product',500),
  ('audit_fee_per_day','Audit fee per auditor per day',1000),
  ('logo_fee','Halal logo licence per year (optional)',20000),
  ('gst_percent','GST percent',18);
