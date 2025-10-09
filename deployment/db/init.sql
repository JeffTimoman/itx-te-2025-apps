
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

-- Verification codes table used by QR flows and single-use verification links
CREATE TABLE verification_codes (
  id SERIAL PRIMARY KEY,
  code VARCHAR(64) NOT NULL UNIQUE,
  registrant_id INTEGER REFERENCES registrants(id) ON DELETE CASCADE,
  date_created TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_used CHAR(1) NOT NULL DEFAULT 'N'
);
