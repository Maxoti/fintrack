import { Router } from "express";
import { requireAuth, userId } from "./auth";
import { query } from "./db";
import { conflict, notFoundError, unprocessable } from "./errors";
import {
  TXN_TYPES,
  asDate,
  asEnum,
  asPositiveNumber,
  asText,
  bodyOf,
  handle,
  isPgError,
  num,
  optionalEnum,
  pathId,
} from "./http";
import { loadPortfolio } from "./portfolios";

/**
 * Mounted at the API root (see routes.ts), so paths are full:
 *   /portfolios/:id/transactions   and   /transactions/:id
 * Auth is applied per route.
 *
 * The "cannot sell more than held" and currency-match rules live in database
 * triggers; a violation surfaces as Postgres 23514 and http.ts maps it to 422
 * (409 when it is a delete that would strand a later SELL).
 */
export const transactionsRouter = Router();

const SORT_COLUMNS = {
  tradeDate: "t.trade_date",
  instrument: "i.symbol",
  type: "t.type",
  quantity: "t.quantity",
  unitPrice: "t.unit_price",
  amount: "(t.quantity * t.unit_price)",
} as const;
const SORT_KEYS = Object.keys(SORT_COLUMNS) as (keyof typeof SORT_COLUMNS)[];
const ORDERS = ["asc", "desc"] as const;

interface TxnRow {
  id: string;
  symbol: string;
  instrument_name: string;
  type: string;
  quantity: string;
  unit_price: string;
  amount: string;
  trade_date: string;
  created_at: Date;
}

const toTxn = (r: TxnRow) => ({
  id: r.id,
  instrument: r.symbol,
  instrumentName: r.instrument_name,
  type: r.type,
  quantity: num(r.quantity),
  unitPrice: num(r.unit_price),
  amount: num(r.amount),
  tradeDate: r.trade_date,
  createdAt: r.created_at,
});

// GET /portfolios/:id/transactions?instrument=SCOM&type=BUY&sort=tradeDate&order=desc
transactionsRouter.get(
  "/portfolios/:id/transactions",
  requireAuth,
  handle(async (req, res) => {
    const portfolio = await loadPortfolio(pathId(req.params.id), userId(req));

    const instrument =
      req.query.instrument === undefined
        ? null
        : asText(req.query.instrument, "instrument", 30).toUpperCase();
    const type = optionalEnum(req.query.type, "type", TXN_TYPES) ?? null;
    const sort = optionalEnum(req.query.sort, "sort", SORT_KEYS) ?? "tradeDate";
    const order = optionalEnum(req.query.order, "order", ORDERS) ?? "desc";

    // Column and direction come from fixed whitelists, never from raw input.
    const { rows } = await query<TxnRow>(
      `SELECT t.id, i.symbol, i.name AS instrument_name, t.type, t.quantity, t.unit_price,
              round(t.quantity * t.unit_price, 2) AS amount,
              t.trade_date::text AS trade_date, t.created_at
         FROM transactions t
         JOIN instruments i ON i.id = t.instrument_id
        WHERE t.portfolio_id = $1
          AND ($2::text IS NULL OR i.symbol = $2::text)
          AND ($3::txn_type IS NULL OR t.type = $3::txn_type)
        ORDER BY ${SORT_COLUMNS[sort]} ${order === "asc" ? "ASC" : "DESC"}, t.created_at DESC, t.id`,
      [portfolio.id, instrument, type],
    );

    res.json({ transactions: rows.map(toTxn) });
  }),
);

// POST /portfolios/:id/transactions -> 201 { transaction }
// Body: { instrument (symbol), type, quantity, unitPrice, tradeDate }
transactionsRouter.post(
  "/portfolios/:id/transactions",
  requireAuth,
  handle(async (req, res) => {
    const portfolio = await loadPortfolio(pathId(req.params.id), userId(req));

    const body = bodyOf(req);
    const symbol = asText(body.instrument, "instrument", 30).toUpperCase();
    const type = asEnum(body.type, "type", TXN_TYPES);
    const quantity = asPositiveNumber(body.quantity, "quantity");
    const unitPrice = asPositiveNumber(body.unitPrice, "unitPrice");
    const tradeDate = asDate(body.tradeDate, "tradeDate");

    const found = await query<{ id: string }>(`SELECT id FROM instruments WHERE symbol = $1`, [symbol]);
    if (!found.rows[0]) throw unprocessable(`Unknown instrument ${symbol}`);

    const { rows } = await query<TxnRow>(
      `WITH ins AS (
         INSERT INTO transactions (portfolio_id, instrument_id, type, quantity, unit_price, trade_date)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, instrument_id, type, quantity, unit_price, trade_date, created_at
       )
       SELECT ins.id, i.symbol, i.name AS instrument_name, ins.type, ins.quantity, ins.unit_price,
              round(ins.quantity * ins.unit_price, 2) AS amount,
              ins.trade_date::text AS trade_date, ins.created_at
         FROM ins
         JOIN instruments i ON i.id = ins.instrument_id`,
      [portfolio.id, found.rows[0].id, type, quantity, unitPrice, tradeDate],
    );

    res.status(201).json({ transaction: toTxn(rows[0]!) });
  }),
);

// DELETE /transactions/:id -> 204
// 409 if removing a BUY would leave a later SELL uncovered (database trigger).
transactionsRouter.delete(
  "/transactions/:id",
  requireAuth,
  handle(async (req, res) => {
    try {
      const { rowCount } = await query(
        `DELETE FROM transactions t
          USING portfolios p
          WHERE t.id = $1 AND p.id = t.portfolio_id AND p.user_id = $2`,
        [pathId(req.params.id), userId(req)],
      );
      if (!rowCount) throw notFoundError("Transaction not found");
      res.status(204).end();
    } catch (err) {
      if (isPgError(err, "23514")) {
        throw conflict("Cannot delete: this purchase is needed to cover a later sale");
      }
      throw err;
    }
  }),
);