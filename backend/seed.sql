-- =====================================================================
-- FinTrack seed data (fictional). Run after schema.sql.
-- Demo login:  demo@fintrack.test  /  Demo@1234
-- The password is a pre-generated bcrypt hash (no pgcrypto needed).
-- It verifies with bcrypt / bcryptjs in Node.
-- Change or delete the demo user before exposing a real deployment.
-- =====================================================================

BEGIN;

INSERT INTO users (id, email, password_hash, full_name) VALUES
  ('00000000-0000-0000-0000-000000000001', 'demo@fintrack.test',
   '$2b$10$ZpVit1ieAG3kv25TwBlrSOMJ1Qw.xxFem5IzNUh58oOih0eRQsYgy', 'Demo Analyst');

-- Fictional prices, not market data.
INSERT INTO instruments (symbol, name, asset_class, currency, last_price) VALUES
  ('SCOM',          'Safaricom PLC',                     'EQUITY',       'KES', 29.7500),
  ('KCB',           'KCB Group PLC',                     'EQUITY',       'KES', 41.2000),
  ('EQTY',          'Equity Group Holdings',             'EQUITY',       'KES', 47.5000),
  ('T-BILL-91',     '91-Day Treasury Bill',              'FIXED_INCOME', 'KES', 99.2000),
  ('KEN-EURO-2034', 'Kenya Eurobond 2034 (fictional)',   'FIXED_INCOME', 'USD', 96.4000),
  ('USD-MMF',       'USD Money Market Fund (fictional)', 'FUND',         'USD', 1.0150);

INSERT INTO portfolios (id, user_id, name, client_name, base_currency) VALUES
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001',
   'Growth Equity Mandate', 'Wanjiku Family Trust', 'KES'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001',
   'USD Income Portfolio', 'Kilimani Capital Partners', 'USD'),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001',
   'Empty Portfolio (demo empty state)', 'Test Client Ltd', 'KES');

INSERT INTO transactions (portfolio_id, instrument_id, type, quantity, unit_price, trade_date)
SELECT p.id, i.id, v.type::txn_type, v.qty, v.price, v.trade_date::date
FROM (VALUES
  ('10000000-0000-0000-0000-000000000001', 'SCOM',          'BUY',  5000,  28.5000, '2026-01-12'),
  ('10000000-0000-0000-0000-000000000001', 'KCB',           'BUY',  2000,  38.0000, '2026-02-03'),
  ('10000000-0000-0000-0000-000000000001', 'EQTY',          'BUY',  3000,  45.2500, '2026-02-17'),
  ('10000000-0000-0000-0000-000000000001', 'SCOM',          'SELL', 1000,  31.0000, '2026-04-08'),
  ('10000000-0000-0000-0000-000000000001', 'KCB',           'BUY',  1000,  40.5000, '2026-05-21'),
  ('10000000-0000-0000-0000-000000000001', 'T-BILL-91',     'BUY',  50000, 98.4000, '2026-06-02'),
  ('10000000-0000-0000-0000-000000000001', 'EQTY',          'SELL', 500,   46.8000, '2026-09-14'),
  ('10000000-0000-0000-0000-000000000002', 'KEN-EURO-2034', 'BUY',  10000, 94.2500, '2026-03-10'),
  ('10000000-0000-0000-0000-000000000002', 'USD-MMF',       'BUY',  25000, 1.0050,  '2026-03-15'),
  ('10000000-0000-0000-0000-000000000002', 'USD-MMF',       'SELL', 5000,  1.0120,  '2026-08-19')
) AS v(portfolio_id, symbol, type, qty, price, trade_date)
JOIN portfolios  p ON p.id = v.portfolio_id::uuid
JOIN instruments i ON i.symbol = v.symbol;

COMMIT;