-- ==============================================================
-- Cashlytics Demo Data Seed
-- Resets all user data and inserts a realistic demo dataset.
-- Run via demo-reset.sh or manually:
--   psql -h <host> -U cashlytics -d cashlytics -f seed-demo.sql
-- ==============================================================

BEGIN;

-- --------------------------------------------------------------
-- TRUNCATE (CASCADE handles all dependent tables automatically)
-- --------------------------------------------------------------
TRUNCATE TABLE
  messages,
  conversations,
  documents,
  daily_expenses,
  transfers,
  expenses,
  incomes,
  categories,
  accounts
CASCADE;


-- ==============================================================
-- ACCOUNTS
-- ==============================================================
INSERT INTO accounts (id, name, type, balance, currency, created_at) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Hauptkonto',        'checking',  3245.80,  'EUR', NOW() - INTERVAL '180 days'),
  ('a0000000-0000-0000-0000-000000000002', 'Notgroschen',       'savings',  12500.00,  'EUR', NOW() - INTERVAL '180 days'),
  ('a0000000-0000-0000-0000-000000000003', 'Weltportfolio ETF', 'etf',       8750.25,  'EUR', NOW() - INTERVAL '180 days');


-- ==============================================================
-- CATEGORIES
-- ==============================================================
INSERT INTO categories (id, name, icon, color, created_at) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'Wohnen',          '🏠', '#3b82f6', NOW() - INTERVAL '180 days'),
  ('c0000000-0000-0000-0000-000000000002', 'Lebensmittel',    '🛒', '#22c55e', NOW() - INTERVAL '180 days'),
  ('c0000000-0000-0000-0000-000000000003', 'Transport',       '🚗', '#f97316', NOW() - INTERVAL '180 days'),
  ('c0000000-0000-0000-0000-000000000004', 'Unterhaltung',    '🎬', '#a855f7', NOW() - INTERVAL '180 days'),
  ('c0000000-0000-0000-0000-000000000005', 'Gesundheit',      '💊', '#ef4444', NOW() - INTERVAL '180 days'),
  ('c0000000-0000-0000-0000-000000000006', 'Sport & Fitness', '🏋', '#eab308', NOW() - INTERVAL '180 days'),
  ('c0000000-0000-0000-0000-000000000007', 'Essen gehen',     '🍕', '#ec4899', NOW() - INTERVAL '180 days'),
  ('c0000000-0000-0000-0000-000000000008', 'Shopping',        '🛍', '#14b8a6', NOW() - INTERVAL '180 days'),
  ('c0000000-0000-0000-0000-000000000009', 'Reisen',          '✈', '#0ea5e9', NOW() - INTERVAL '180 days'),
  ('c0000000-0000-0000-0000-000000000010', 'Technik',         '💻', '#6b7280', NOW() - INTERVAL '180 days'),
  ('c0000000-0000-0000-0000-000000000011', 'Bildung',         '📚', '#6366f1', NOW() - INTERVAL '180 days'),
  ('c0000000-0000-0000-0000-000000000012', 'Sonstiges',       '💰', '#78716c', NOW() - INTERVAL '180 days');


-- ==============================================================
-- EXPENSES (recurring fixed costs)
-- ==============================================================
INSERT INTO expenses
  (id, account_id, category_id, name, amount, recurrence_type, start_date, is_subscription, created_at)
VALUES
  -- Wohnen
  ('e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Miete',                    850.00, 'monthly', NOW() - INTERVAL '180 days', false, NOW() - INTERVAL '180 days'),
  ('e0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Strom',                     65.00, 'monthly', NOW() - INTERVAL '180 days', false, NOW() - INTERVAL '180 days'),
  -- Technik
  ('e0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000010', 'Internet & Telefon',        44.99, 'monthly', NOW() - INTERVAL '180 days', false, NOW() - INTERVAL '180 days'),
  ('e0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000010', 'Handyvertrag',              19.99, 'monthly', NOW() - INTERVAL '180 days', false, NOW() - INTERVAL '180 days'),
  -- Subscriptions
  ('e0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000004', 'Spotify',                    9.99, 'monthly', NOW() - INTERVAL '180 days', true,  NOW() - INTERVAL '180 days'),
  ('e0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000004', 'Netflix',                   15.99, 'monthly', NOW() - INTERVAL '180 days', true,  NOW() - INTERVAL '180 days'),
  ('e0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000004', 'Amazon Prime',               8.99, 'monthly', NOW() - INTERVAL '180 days', true,  NOW() - INTERVAL '180 days'),
  -- Sport
  ('e0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000006', 'Fitnessstudio',             39.99, 'monthly', NOW() - INTERVAL '180 days', false, NOW() - INTERVAL '180 days'),
  -- Versicherungen / Sonstiges
  ('e0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000012', 'Haftpflichtversicherung',   12.50, 'monthly', NOW() - INTERVAL '180 days', false, NOW() - INTERVAL '180 days'),
  ('e0000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003', 'KFZ-Versicherung',          95.00, 'monthly', NOW() - INTERVAL '180 days', false, NOW() - INTERVAL '180 days');


-- ==============================================================
-- INCOMES
-- ==============================================================
INSERT INTO incomes
  (id, account_id, source, amount, recurrence_type, start_date, created_at)
VALUES
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Gehalt',             3500.00, 'monthly', NOW() - INTERVAL '180 days', NOW() - INTERVAL '180 days'),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Freelance Projekte',  650.00, 'monthly', NOW() - INTERVAL '180 days', NOW() - INTERVAL '180 days'),
  ('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000002', 'Zinsen Sparkonto',     18.75, 'yearly',  NOW() - INTERVAL '180 days', NOW() - INTERVAL '180 days');


-- ==============================================================
-- TRANSFERS (recurring)
-- ==============================================================
INSERT INTO transfers
  (id, source_account_id, target_account_id, amount, description, recurrence_type, start_date, created_at)
VALUES
  ('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 300.00, 'Monatliche Sparrate', 'monthly', NOW() - INTERVAL '180 days', NOW() - INTERVAL '180 days'),
  ('d0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003', 200.00, 'ETF Sparplan',        'monthly', NOW() - INTERVAL '180 days', NOW() - INTERVAL '180 days');


-- ==============================================================
-- DAILY EXPENSES (last 90 days, realistic spending patterns)
-- ==============================================================
INSERT INTO daily_expenses
  (id, account_id, category_id, description, amount, date, created_at)
VALUES
  -- Woche 1 (aktuellste Woche)
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'Rewe Wocheneinkauf',         67.45, NOW() - INTERVAL '2 days',  NOW() - INTERVAL '2 days'),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000007', 'Restaurant Bella Italia',    38.50, NOW() - INTERVAL '3 days',  NOW() - INTERVAL '3 days'),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003', 'Tankstelle Shell',           72.30, NOW() - INTERVAL '4 days',  NOW() - INTERVAL '4 days'),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'Aldi Einkauf',               23.80, NOW() - INTERVAL '5 days',  NOW() - INTERVAL '5 days'),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000004', 'Kino Ticket',                14.00, NOW() - INTERVAL '6 days',  NOW() - INTERVAL '6 days'),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'Lidl Einkauf',               31.20, NOW() - INTERVAL '7 days',  NOW() - INTERVAL '7 days'),

  -- Woche 2
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'Rewe Wocheneinkauf',         58.90, NOW() - INTERVAL '9 days',  NOW() - INTERVAL '9 days'),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000007', 'Sushi Bar',                  45.00, NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days'),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000008', 'H&M Kleidung',               89.99, NOW() - INTERVAL '11 days', NOW() - INTERVAL '11 days'),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003', 'Monatskarte ÖPNV',           28.40, NOW() - INTERVAL '12 days', NOW() - INTERVAL '12 days'),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'Bäcker',                      8.50, NOW() - INTERVAL '13 days', NOW() - INTERVAL '13 days'),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000005', 'Apotheke',                   22.80, NOW() - INTERVAL '14 days', NOW() - INTERVAL '14 days'),

  -- Woche 3
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'Edeka Wocheneinkauf',        74.30, NOW() - INTERVAL '16 days', NOW() - INTERVAL '16 days'),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000007', 'Burger King',                18.90, NOW() - INTERVAL '17 days', NOW() - INTERVAL '17 days'),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003', 'Tankstelle BP',              68.00, NOW() - INTERVAL '18 days', NOW() - INTERVAL '18 days'),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000010', 'Amazon Bestellung',          34.99, NOW() - INTERVAL '19 days', NOW() - INTERVAL '19 days'),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'DM Drogerie',                29.40, NOW() - INTERVAL '20 days', NOW() - INTERVAL '20 days'),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000004', 'Steam Spiel',                19.99, NOW() - INTERVAL '21 days', NOW() - INTERVAL '21 days'),

  -- Woche 4
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'Rewe Wocheneinkauf',         55.60, NOW() - INTERVAL '23 days', NOW() - INTERVAL '23 days'),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000007', 'Pizza Lieferung',            32.50, NOW() - INTERVAL '24 days', NOW() - INTERVAL '24 days'),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000006', 'Sportartikel Decathlon',     49.99, NOW() - INTERVAL '25 days', NOW() - INTERVAL '25 days'),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000005', 'Zahnarzt',                  150.00, NOW() - INTERVAL '26 days', NOW() - INTERVAL '26 days'),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'Aldi Einkauf',               19.70, NOW() - INTERVAL '27 days', NOW() - INTERVAL '27 days'),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003', 'Parken Innenstadt',          12.00, NOW() - INTERVAL '28 days', NOW() - INTERVAL '28 days'),

  -- Monat 2
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'Rewe Wocheneinkauf',         63.80, NOW() - INTERVAL '30 days', NOW() - INTERVAL '30 days'),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000009', 'Flug Wochenendtrip',        189.00, NOW() - INTERVAL '33 days', NOW() - INTERVAL '33 days'),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000009', 'Hotel Wochenendtrip',       124.00, NOW() - INTERVAL '34 days', NOW() - INTERVAL '34 days'),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000007', 'Café & Kuchen',              15.80, NOW() - INTERVAL '35 days', NOW() - INTERVAL '35 days'),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'Wochenmarkt',                42.50, NOW() - INTERVAL '37 days', NOW() - INTERVAL '37 days'),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003', 'Tankstelle Total',           75.60, NOW() - INTERVAL '39 days', NOW() - INTERVAL '39 days'),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000008', 'Zara Kleidung',              76.99, NOW() - INTERVAL '41 days', NOW() - INTERVAL '41 days'),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'Rewe Einkauf',               48.20, NOW() - INTERVAL '44 days', NOW() - INTERVAL '44 days'),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000004', 'Konzertticket',              65.00, NOW() - INTERVAL '46 days', NOW() - INTERVAL '46 days'),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000011', 'Fachbuch',                   29.99, NOW() - INTERVAL '48 days', NOW() - INTERVAL '48 days'),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'Aldi Wocheneinkauf',         52.30, NOW() - INTERVAL '51 days', NOW() - INTERVAL '51 days'),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000007', 'Thai Restaurant',            41.00, NOW() - INTERVAL '53 days', NOW() - INTERVAL '53 days'),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000005', 'Physiotherapie',             60.00, NOW() - INTERVAL '55 days', NOW() - INTERVAL '55 days'),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'Lidl Einkauf',               27.90, NOW() - INTERVAL '58 days', NOW() - INTERVAL '58 days'),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000010', 'Kopfhörer Sony',            119.00, NOW() - INTERVAL '60 days', NOW() - INTERVAL '60 days'),

  -- Monat 3
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'Rewe Wocheneinkauf',         61.50, NOW() - INTERVAL '63 days', NOW() - INTERVAL '63 days'),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003', 'Tankstelle Aral',            69.80, NOW() - INTERVAL '65 days', NOW() - INTERVAL '65 days'),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000007', 'Griechisches Restaurant',    36.00, NOW() - INTERVAL '67 days', NOW() - INTERVAL '67 days'),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'Wochenmarkt',                38.60, NOW() - INTERVAL '70 days', NOW() - INTERVAL '70 days'),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000008', 'IKEA Haushalt',             145.50, NOW() - INTERVAL '72 days', NOW() - INTERVAL '72 days'),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000004', 'Sky Ticket',                 10.00, NOW() - INTERVAL '75 days', NOW() - INTERVAL '75 days'),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'Aldi Einkauf',               44.30, NOW() - INTERVAL '77 days', NOW() - INTERVAL '77 days'),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000006', 'Laufschuhe',                 89.99, NOW() - INTERVAL '79 days', NOW() - INTERVAL '79 days'),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000005', 'Arztbesuch',                 25.00, NOW() - INTERVAL '82 days', NOW() - INTERVAL '82 days'),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000007', 'Ramen Bar',                  28.50, NOW() - INTERVAL '84 days', NOW() - INTERVAL '84 days'),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'Rewe Einkauf',               59.80, NOW() - INTERVAL '86 days', NOW() - INTERVAL '86 days'),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003', 'Autobahn Maut',              12.50, NOW() - INTERVAL '88 days', NOW() - INTERVAL '88 days'),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000011', 'Udemy Online-Kurs',          49.00, NOW() - INTERVAL '90 days', NOW() - INTERVAL '90 days');


COMMIT;
