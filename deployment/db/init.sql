
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
  ('Low Gift'),
  ('Medium Gift'),
  ('High Gift'),
  ('Grand Prize');

-- Foods table for claimable foods
CREATE TABLE IF NOT EXISTS food(
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Teams table for grouping registrants or admin purposes
CREATE TABLE IF NOT EXISTS teams(
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Team scores: records points awarded to teams per game
CREATE TABLE IF NOT EXISTS team_scores(
  id SERIAL PRIMARY KEY,
  team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
  game_name TEXT NOT NULL,
  point INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Registrant food claims: one claim per registrant (unique constraint)
CREATE TABLE IF NOT EXISTS registrant_claim_foods(
  id SERIAL PRIMARY KEY,
  registrant_id INTEGER REFERENCES registrants(id) ON DELETE CASCADE UNIQUE,
  food_id INTEGER REFERENCES food(id) ON DELETE CASCADE,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

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
  is_assigned CHAR(1) NOT NULL DEFAULT 'N'
);

-- Email send logs for verification/gacha emails. Records both successes and failures so
-- the operator can inspect delivery attempts and errors.
CREATE TABLE IF NOT EXISTS email_logs(
  id SERIAL PRIMARY KEY,
  registrant_id INTEGER REFERENCES registrants(id) ON DELETE CASCADE,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  success CHAR(1) NOT NULL DEFAULT 'N',
  error TEXT NULL
);

-- Admin users table: stores users who can log into the /admin UI and admin API.
-- Passwords are stored as a bcrypt hash in `password_hash`.
-- Note: create users manually (no registration endpoint). Example script is provided in the backend repo to create a user with a hashed password.
CREATE TABLE IF NOT EXISTS users(
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  email TEXT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NULL,
  role TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
