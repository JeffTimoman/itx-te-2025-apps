
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

-- Categories for gifts (Grand / Great)
CREATE TABLE IF NOT EXISTS gift_categories(
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Insert the two initial gift categories (Grand / Great)
INSERT INTO gift_categories (name) VALUES
  ('Grand Gift'),
  ('Great Gift');

-- Gifts table used by admin CRUD
CREATE TABLE IF NOT EXISTS gift(
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  gift_category_id INTEGER REFERENCES gift_categories(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Gift winners: link registrant -> gift
CREATE TABLE IF NOT EXISTS gift_winners(
  id SERIAL PRIMARY KEY,
  registrant_id INTEGER REFERENCES registrants(id) ON DELETE CASCADE,
  gift_id INTEGER REFERENCES gift(id) ON DELETE CASCADE,
  date_awarded TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (registrant_id, gift_id)
);
