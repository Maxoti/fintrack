import { Router, type Request } from "express";
import { userId } from "./auth";
import { query } from "./db";
import { conflict, notFoundError } from "./errors";
import { CURRENCIES, asEnum, asText, bodyOf, handle, isPgError, pathId, round2 } from "./http";

export const portfoliosRouter = Router();

interface PortfolioRow {
  id: string;
  name: string;
  client_name: string;
  base_currency: string;
  created_at: Date;
  transaction_count: number;
  total_value: string;
}

const SELECT_PORTFOLIO = `
  SELECT p.id, p.name, p.client_name, p.base_currency, p.created_at,
         (SELECT COUNT(*)::int FROM transactions t WHERE t.portfolio_id = p.id) AS transaction_count,
         COALESCE((SELECT SUM(h.total_value) FROM holdings h WHERE h.portfolio_id = p.id), 0) AS total_value
    FROM portfolios p`;

const toPortfolio = (r: PortfolioRow) => ({
  id: r.id,
  name: r.name,
  clientName: r.client_name,
  baseCurrency: r.base_currency,
  createdAt: r.created_at,
  transactionCount: r.transaction_count,
  totalValue: Number(r.total_value),
});

/**
 * Loads a portfolio only if it belongs to the user. Others get 404 (not 403)
 * so portfolio ids can't be probed.
 */
export async function loadPortfolio(portfolioId: string, owner: string): Promise<PortfolioRow> {
  const { rows } = await query<PortfolioRow>(
    `${SELECT_PORTFOLIO} WHERE p.id = $1 AND p.user_id = $2`,
    [portfolioId, owner],
  );
  if (!rows[0]) throw notFoundError("Portfolio not found");
  return rows[0];
}

const duplicateName = () => conflict("You already have a portfolio with this name");

function portfolioInput(req: Request) {
  const body = bodyOf(req);
  return {
    name: asText(body.name, "name", 120),
    clientName: asText(body.clientName, "clientName", 120),
    baseCurrency: asEnum(body.baseCurrency, "baseCurrency", CURRENCIES),
  };
}

// GET /portfolios -> { portfolios: [...] }
portfoliosRouter.get(
  "/",
  handle(async (req, res) => {
    const { rows } = await query<PortfolioRow>(
      `${SELECT_PORTFOLIO} WHERE p.user_id = $1 ORDER BY p.created_at DESC, p.name`,
      [userId(req)],
    );
    res.json({ portfolios: rows.map(toPortfolio) });
  }),
);

// POST /portfolios -> 201 { portfolio }
portfoliosRouter.post(
  "/",
  handle(async (req, res) => {
    const input = portfolioInput(req);
    try {
      const { rows } = await query<{ id: string }>(
        `INSERT INTO portfolios (user_id, name, client_name, base_currency)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [userId(req), input.name, input.clientName, input.baseCurrency],
      );
      const portfolio = await loadPortfolio(rows[0]!.id, userId(req));
      res.status(201).json({ portfolio: toPortfolio(portfolio) });
    } catch (err) {
      if (isPgError(err, "23505")) throw duplicateName();
      throw err;
    }
  }),
);

interface HoldingRow {
  symbol: string;
  name: string;
  asset_class: string;
  net_quantity: string;
  average_cost: string;
  total_invested: string;
  last_price: string;
  total_value: string;
  unrealised_pnl: string;
}

// GET /portfolios/:id/summary (backed by the holdings view)
portfoliosRouter.get(
  "/:id/summary",
  handle(async (req, res) => {
    const portfolio = await loadPortfolio(pathId(req.params.id), userId(req));

    const { rows } = await query<HoldingRow>(
      `SELECT symbol, name, asset_class, net_quantity, average_cost, total_invested,
              last_price, total_value, unrealised_pnl
         FROM holdings
        WHERE portfolio_id = $1
        ORDER BY symbol`,
      [portfolio.id],
    );

    const totalInvested = round2(rows.reduce((s, h) => s + Number(h.total_invested), 0));
    const totalValue = round2(rows.reduce((s, h) => s + Number(h.total_value), 0));
    const unrealisedPnl = round2(totalValue - totalInvested);

    res.json({
      portfolioId: portfolio.id,
      baseCurrency: portfolio.base_currency,
      holdings: rows.map((h) => ({
        instrument: h.symbol,
        instrumentName: h.name,
        assetClass: h.asset_class,
        netQuantity: Number(h.net_quantity),
        averageCost: Number(h.average_cost),
        totalInvested: Number(h.total_invested),
        lastPrice: Number(h.last_price),
        totalValue: Number(h.total_value),
        unrealisedPnl: Number(h.unrealised_pnl),
        allocationPct: totalValue > 0 ? round2((Number(h.total_value) / totalValue) * 100) : 0,
      })),
      totals: {
        totalInvested,
        totalValue,
        unrealisedPnl,
        unrealisedPnlPct: totalInvested > 0 ? round2((unrealisedPnl / totalInvested) * 100) : 0,
      },
    });
  }),
);

// GET /portfolios/:id -> { portfolio }
portfoliosRouter.get(
  "/:id",
  handle(async (req, res) => {
    const portfolio = await loadPortfolio(pathId(req.params.id), userId(req));
    res.json({ portfolio: toPortfolio(portfolio) });
  }),
);

// PUT /portfolios/:id -> { portfolio }
// Base currency can only change while the portfolio has no transactions.
portfoliosRouter.put(
  "/:id",
  handle(async (req, res) => {
    const id = pathId(req.params.id);
    const input = portfolioInput(req);
    await loadPortfolio(id, userId(req)); // 404 if missing or not yours

    try {
      const { rowCount } = await query(
        `UPDATE portfolios
            SET name = $3, client_name = $4, base_currency = $5::currency_code
          WHERE id = $1 AND user_id = $2
            AND (base_currency = $5::currency_code
                 OR NOT EXISTS (SELECT 1 FROM transactions t WHERE t.portfolio_id = portfolios.id))`,
        [id, userId(req), input.name, input.clientName, input.baseCurrency],
      );
      if (!rowCount) {
        throw conflict("Base currency cannot be changed once the portfolio has transactions");
      }
    } catch (err) {
      if (isPgError(err, "23505")) throw duplicateName();
      throw err;
    }

    res.json({ portfolio: toPortfolio(await loadPortfolio(id, userId(req))) });
  }),
);

// DELETE /portfolios/:id -> 204 (cascades to its transactions)
portfoliosRouter.delete(
  "/:id",
  handle(async (req, res) => {
    const { rowCount } = await query(`DELETE FROM portfolios WHERE id = $1 AND user_id = $2`, [
      pathId(req.params.id),
      userId(req),
    ]);
    if (!rowCount) throw notFoundError("Portfolio not found");
    res.status(204).end();
  }),
);