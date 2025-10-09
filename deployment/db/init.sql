-- SQL DDL for registrants table (fast-tap app)
-- Run during DB initialization or manually with psql

CREATE TABLE IF NOT EXISTS registrants (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  gacha_code CHAR(12) UNIQUE,
  email TEXT NULL,
  is_win CHAR(1) NOT NULL DEFAULT 'N',
  is_verified CHAR(1) NOT NULL DEFAULT 'N',
  is_send_email CHAR(1) NOT NULL DEFAULT 'N',
  bureau TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
