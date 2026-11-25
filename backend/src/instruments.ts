import { Router } from "express";
import { query } from "./db";
import { CURRENCIES, handle, num, optionalEnum } from "./http";

export const instrumentsRouter = Router();

interface InstrumentRow {
  symbol: string;
  name: string;
  asset_class: string;
  currency: string;
  last_price: string;
  price_as_of: Date;
}

// GET /instruments[?currency=KES] -> { instruments: [...] }
instrumentsRouter.get(
  "/",
  handle(async (req, res) => {
    const currency = optionalEnum(req.query.currency, "currency", CURRENCIES) ?? null;

    const { rows } = await query<InstrumentRow>(
      `SELECT symbol, name, asset_class, currency, last_price, price_as_of
         FROM instruments
        WHERE ($1::currency_code IS NULL OR currency = $1::currency_code)
        ORDER BY symbol`,
      [currency],
    );

    res.json({
      instruments: rows.map((r) => ({
        symbol: r.symbol,
        name: r.name,
        assetClass: r.asset_class,
        currency: r.currency,
        lastPrice: num(r.last_price),
        priceAsOf: r.price_as_of,
      })),
    });
  }),
);