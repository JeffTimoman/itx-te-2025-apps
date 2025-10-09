
CREATE TABLE IF NOT EXISTS registrants (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  gacha_code VARCHAR(32) UNIQUE,
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

CREATE TABLE prize_categories(
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO gift_categories (name) VALUES
('Grand Gift'),
('Great Gift');

CREATE TABLE gift(
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
)

CREATE TABLE gift_winners(
    id SERIAL PRIMARY KEY,
    registrant_id INTEGER REFERENCES registrants(id) ON DELETE CASCADE,
    prize_id INTEGER REFERENCES prizes(id) ON DELETE CASCADE,
    date_awarded TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (registrant_id, prize_id)
);
