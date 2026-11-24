-- =====================================================================
-- FinTrack by Finnet Technologies: Portfolio & Transactions Tracker
-- PostgreSQL 14+   |   Run: psql "$DATABASE_URL" -f schema.sql -f seed.sql
--
-- Design rules
--  * Holdings are DERIVED from transactions (view), never stored, so
--    they cannot drift out of sync.
--  * "Cannot sell more than held" is enforced in the database (trigger),
--    so it holds even if a second code path or a race bypasses the API.
--  * A portfolio only holds instruments quoted in its base currency
--    (no FX conversion in this scope).
-- =====================================================================

BEGIN;

-- CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- gen_random_uuid(), crypt() for seeding
--CREATE EXTENSION IF NOT EXISTS citext;    -- case-insensitive email

-- ---------- Types ----------
CREATE TYPE currency_code AS ENUM ('KES', 'USD');
CREATE TYPE txn_type      AS ENUM ('BUY', 'SELL');
CREATE TYPE asset_class   AS ENUM ('EQUITY', 'FIXED_INCOME', 'FUND');

CREATE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------- Users (analysts) ----------
CREATE TABLE users (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email          TEXT NOT NULL CHECK (email = lower(email)),
  password_hash  TEXT   NOT NULL,                 -- bcrypt; never plaintext
  full_name      TEXT   NOT NULL CHECK (length(trim(full_name)) > 0),   -- API field: "name"
  phone          TEXT   CHECK (phone ~ '^\+[1-9][0-9]{7,14}$'),         -- optional, stored as E.164 (+2547XXXXXXXX)
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_users_email ON users (email);
CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------- Instruments (reference data + latest price) ----------
-- last_price is what makes "total value" computable. In production this
-- would be fed by a market-data job; here it is seeded / updated manually.
CREATE TABLE instruments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol          TEXT NOT NULL UNIQUE CHECK (symbol = upper(symbol)),  -- SCOM, KCB, T-BILL-91
  name            TEXT NOT NULL,
  asset_class     asset_class   NOT NULL,
  currency        currency_code NOT NULL DEFAULT 'KES',
  last_price      NUMERIC(18,4) NOT NULL CHECK (last_price >= 0),
  price_as_of     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- ---------- Portfolios ----------
CREATE TABLE portfolios (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name           TEXT NOT NULL CHECK (length(trim(name)) > 0),
  client_name    TEXT NOT NULL CHECK (length(trim(client_name)) > 0),
  base_currency  currency_code NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),   -- the "created date" field
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);
CREATE INDEX idx_portfolios_user ON portfolios(user_id);
CREATE TRIGGER trg_portfolios_updated BEFORE UPDATE ON portfolios
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------- Transactions ----------
CREATE TABLE transactions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id   UUID NOT NULL REFERENCES portfolios(id)  ON DELETE CASCADE,
  instrument_id  UUID NOT NULL REFERENCES instruments(id) ON DELETE RESTRICT,
  type           txn_type NOT NULL,
  quantity       NUMERIC(18,4) NOT NULL CHECK (quantity   > 0),
  unit_price     NUMERIC(18,4) NOT NULL CHECK (unit_price > 0),
  trade_date     DATE NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_txn_portfolio_date ON transactions(portfolio_id, trade_date DESC, created_at DESC);
CREATE INDEX idx_txn_portfolio_inst ON transactions(portfolio_id, instrument_id);

-- ---------- Rule 1: instrument currency must match portfolio currency ----------
CREATE FUNCTION check_txn_currency() RETURNS trigger AS $$
DECLARE
  p_cur currency_code;
  i_cur currency_code;
BEGIN
  SELECT base_currency INTO p_cur FROM portfolios  WHERE id = NEW.portfolio_id;
  SELECT currency      INTO i_cur FROM instruments WHERE id = NEW.instrument_id;
  IF p_cur IS DISTINCT FROM i_cur THEN
    RAISE EXCEPTION 'Instrument is quoted in % but portfolio base currency is %', i_cur, p_cur
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_txn_currency BEFORE INSERT ON transactions
  FOR EACH ROW EXECUTE FUNCTION check_txn_currency();

-- ---------- Rule 2: holdings may never go negative ----------
-- Fires after a SELL is inserted OR a BUY is deleted (deleting a BUY can
-- also strand a later SELL). The parent portfolio row is locked first so
-- two concurrent sells serialize instead of both passing the check.
-- Map the check_violation error to HTTP 422 (or 409) in the API.
CREATE FUNCTION enforce_non_negative_holding() RETURNS trigger AS $$
DECLARE
  r        transactions%ROWTYPE;
  net_qty  NUMERIC;
BEGIN
  r := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;

  -- Parent portfolio gone? We are inside a cascade delete: nothing to protect.
  PERFORM 1 FROM portfolios WHERE id = r.portfolio_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(SUM(CASE WHEN type = 'BUY' THEN quantity ELSE -quantity END), 0)
    INTO net_qty
    FROM transactions
   WHERE portfolio_id = r.portfolio_id AND instrument_id = r.instrument_id;

  IF net_qty < 0 THEN
    RAISE EXCEPTION 'Insufficient holdings: this change would leave a net quantity of % for the instrument', net_qty
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_txn_holdings_ins AFTER INSERT ON transactions
  FOR EACH ROW WHEN (NEW.type = 'SELL')
  EXECUTE FUNCTION enforce_non_negative_holding();

CREATE TRIGGER trg_txn_holdings_del AFTER DELETE ON transactions
  FOR EACH ROW WHEN (OLD.type = 'BUY')
  EXECUTE FUNCTION enforce_non_negative_holding();

-- ---------- Holdings summary (backs GET /api/portfolios/{id}/summary) ----------
-- net_quantity   = bought - sold
-- average_cost   = weighted average BUY price (total buy cost / total buy qty)
-- total_invested = net_quantity * average_cost   (cost basis of what is still held)
-- total_value    = net_quantity * instrument.last_price
-- unrealised_pnl = total_value - total_invested
CREATE VIEW holdings AS
WITH agg AS (
  SELECT
    t.portfolio_id,
    t.instrument_id,
    SUM(CASE WHEN t.type = 'BUY' THEN t.quantity ELSE -t.quantity END)             AS net_quantity,
    SUM(CASE WHEN t.type = 'BUY' THEN t.quantity * t.unit_price ELSE 0 END)        AS buy_cost,
    SUM(CASE WHEN t.type = 'BUY' THEN t.quantity ELSE 0 END)                       AS buy_quantity
  FROM transactions t
  GROUP BY t.portfolio_id, t.instrument_id
)
SELECT
  a.portfolio_id,
  i.id                                                            AS instrument_id,
  i.symbol,
  i.name,
  i.asset_class,
  i.currency,
  a.net_quantity,
  round(a.buy_cost / NULLIF(a.buy_quantity, 0), 4)                AS average_cost,
  round(a.net_quantity * a.buy_cost / NULLIF(a.buy_quantity, 0), 2) AS total_invested,
  i.last_price,
  round(a.net_quantity * i.last_price, 2)                         AS total_value,
  round(a.net_quantity * i.last_price
        - a.net_quantity * a.buy_cost / NULLIF(a.buy_quantity, 0), 2) AS unrealised_pnl
FROM agg a
JOIN instruments i ON i.id = a.instrument_id
WHERE a.net_quantity > 0;

COMMIT;