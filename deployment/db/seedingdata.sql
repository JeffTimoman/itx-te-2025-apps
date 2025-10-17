-- DUMMY DATA SEED SCRIPT
-- ------------------------------------------------------------
-- 1) 50 registrants with random-like names, unique gacha codes, sample bureaus
--    Uses only built-in functions (no extensions).

WITH
first_names AS (
  SELECT ARRAY[
    'Alya','Budi','Citra','Dewi','Eka','Fajar','Galih','Hasna','Indra','Joko',
    'Kirana','Lia','Mira','Nanda','Oka','Putu','Qori','Rafi','Sari','Tirta',
    'Utami','Vina','Wahyu','Yusuf','Zahra'
  ] AS a
),
last_names AS (
  SELECT ARRAY[
    'Adji','Baskara','Cahya','Darma','Erlangga','Firmansyah','Gunawan','Halim','Iskandar','Jatmiko',
    'Kusuma','Laksono','Mahendra','Nugraha','Pratama','Qadri','Ramadan','Saputra','Tanaka','Utomo',
    'Virat','Wijaya','Yudhistira','Zulkarnain','Kusnadi'
  ] AS a
),
bureaus AS (
  SELECT ARRAY[
    'Operations','Logistics','Marketing','Finance',
    'IT','HR','Public Relations','Support'
  ] AS a
)
INSERT INTO registrants (name, gacha_code, email, bureau)
SELECT
  -- deterministically vary picks so we don’t hit array index issues
  fn.a[1 + ((g-1) % array_length(fn.a,1))] || ' ' ||
  ln.a[1 + ((97*g) % array_length(ln.a,1))]         AS name,
  md5(g::text || clock_timestamp()::text || random()::text) AS gacha_code,   -- 32 hex chars
  lower(replace(
        fn.a[1 + ((g-1) % array_length(fn.a,1))] || '.' ||
        ln.a[1 + ((97*g) % array_length(ln.a,1))], ' ', ''
      )) || g::text || '@example.com'               AS email,
  bu.a[1 + ((31*g) % array_length(bu.a,1))]         AS bureau
FROM generate_series(1,50) AS g
CROSS JOIN first_names fn
CROSS JOIN last_names  ln
CROSS JOIN bureaus     bu;

-- ------------------------------------------------------------
-- 2) 20 gifts across categories with quantities 5 or 10.
--    Assumes gift_categories already has:
--    'Low Gift', 'Medium Gift', 'High Gift', 'Grand Prize'

INSERT INTO gift (name, description, quantity, gift_category_id)
SELECT v.name, v.description, v.quantity,
       (SELECT id FROM gift_categories WHERE name = v.category LIMIT 1)
FROM (
  VALUES
  -- Low Gift (qty 10 each)
  ('Sticker Pack',        'Branded sticker bundle',                 10, 'Low Gift'),
  ('Acrylic Keychain',    'Logo acrylic keychain',                  10, 'Low Gift'),
  ('Tote Bag',            'Light canvas tote',                      10, 'Low Gift'),
  ('Pen Set',             '2x gel pens',                            10, 'Low Gift'),
  ('Pocket Notepad',      'A6 notepad',                             10, 'Low Gift'),
  ('Basic Water Bottle',  '500ml plastic bottle',                   10, 'Low Gift'),

  -- Medium Gift (qty 10 each)
  ('Graphic T-Shirt',     'Event tee (assorted sizes)',             10, 'Medium Gift'),
  ('Baseball Cap',        'Adjustable cap',                         10, 'Medium Gift'),
  ('Power Bank 5,000mAh', 'Compact power bank',                     10, 'Medium Gift'),
  ('Mini BT Speaker',     'Portable Bluetooth speaker',             10, 'Medium Gift'),
  ('Ceramic Mug',         '350ml mug',                              10, 'Medium Gift'),
  ('Compact Umbrella',    'Automatic folding umbrella',             10, 'Medium Gift'),

  -- High Gift (qty 5 each)
  ('Mechanical Keyboard', 'TKL mechanical keyboard',                 5, 'High Gift'),
  ('Wireless Headphones', 'Over-ear wireless headphones',            5, 'High Gift'),
  ('Smartwatch Lite',     'Fitness-tracking smartwatch',             5, 'High Gift'),
  ('E-Reader Basic',      '6-inch e-reader',                         5, 'High Gift'),

  -- Grand Prize (qty 5 each)
  ('Gaming Console',      'Current-gen console',                     5, 'Grand Prize'),
  ('Action Camera',       '4K waterproof action cam',                5, 'Grand Prize'),
  ('Ultrabook Laptop',    '13-inch ultrabook',                       5, 'Grand Prize'),
  ('Premium Smartphone',  'Flagship-class phone',                    5, 'Grand Prize')
) AS v(name, description, quantity, category);
