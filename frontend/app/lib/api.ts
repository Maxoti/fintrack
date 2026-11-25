// Typed client for the FinTrack API. Adds the bearer token, turns error bodies
// ({ error: { code, message, details } }) into ApiError, and sends the user back
// to /login when the token is missing or expired.
const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const TOKEN_KEY = "token";

export type Currency = "KES" | "USD";
export type TxnType = "BUY" | "SELL";
export type SortKey = "tradeDate" | "instrument" | "type" | "quantity" | "unitPrice" | "amount";

export interface Portfolio {
  id: string;
  name: string;
  clientName: string;
  baseCurrency: Currency;
  createdAt: string;
  transactionCount: number;
  totalValue: number;
}
export interface PortfolioInput {
  name: string;
  clientName: string;
  baseCurrency: Currency;
}
export interface Holding {
  instrument: string;
  instrumentName: string;
  assetClass: string;
  netQuantity: number;
  averageCost: number;
  totalInvested: number;
  lastPrice: number;
  totalValue: number;
  unrealisedPnl: number;
  allocationPct: number;
}
export interface Summary {
  portfolioId: string;
  baseCurrency: Currency;
  holdings: Holding[];
  totals: { totalInvested: number; totalValue: number; unrealisedPnl: number; unrealisedPnlPct: number };
}
export interface Txn {
  id: string;
  instrument: string;
  instrumentName: string;
  type: TxnType;
  quantity: number;
  unitPrice: number;
  amount: number;
  tradeDate: string;
}
export interface TxnInput {
  instrument: string;
  type: TxnType;
  quantity: number;
  unitPrice: number;
  tradeDate: string;
}
export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
export interface Instrument {
  symbol: string;
  name: string;
  assetClass: string;
  currency: Currency;
  lastPrice: number | null;
}
export interface TxnQuery {
  page?: number;
  pageSize?: number;
  sort?: SortKey;
  order?: "asc" | "desc";
  instrument?: string;
  type?: TxnType | "";
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details: { field?: string; message: string }[] = [],
  ) {
    super(message);
  }
  /** Message for one field of a 422 response, if the server named it. */
  field(name: string): string | undefined {
    return this.details.find((d) => d.field === name)?.message;
  }
}

export const getToken = (): string | null => (typeof window === "undefined" ? null : localStorage.getItem(TOKEN_KEY));
export const clearToken = (): void => localStorage.removeItem(TOKEN_KEY);

type Params = Record<string, string | number | undefined>;

function buildUrl(path: string, params?: Params): string {
  const url = new URL(`/api${path}`, API);
  for (const [k, v] of Object.entries(params ?? {})) {
    if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
  }
  return url.toString();
}

async function request(path: string, init: RequestInit = {}, params?: Params): Promise<Response> {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(buildUrl(path, params), {
      ...init,
      headers: {
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  } catch {
    throw new ApiError(0, "NETWORK", "Cannot reach the server. Check your connection and try again.");
  }
  if (res.status === 401) {
    clearToken();
    // Full reload on purpose: it also clears any in-memory page state after the session ends.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/login";
    throw new ApiError(401, "UNAUTHORIZED", "Your session has expired. Please log in again.");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const e = body?.error;
    throw new ApiError(res.status, e?.code ?? "ERROR", e?.message ?? `Request failed (${res.status})`, e?.details ?? []);
  }
  return res;
}

async function json<T>(path: string, init?: RequestInit, params?: Params): Promise<T> {
  const res = await request(path, init, params);
  return (res.status === 204 ? undefined : await res.json()) as T;
}

const body = (method: string, data: unknown): RequestInit => ({ method, body: JSON.stringify(data) });
const txnParams = (q: TxnQuery): Params => ({ ...q });

export const api = {
  portfolios: () => json<{ portfolios: Portfolio[] }>("/portfolios").then((r) => r.portfolios),
  portfolio: (id: string) => json<{ portfolio: Portfolio }>(`/portfolios/${id}`).then((r) => r.portfolio),
  createPortfolio: (data: PortfolioInput) => json<{ portfolio: Portfolio }>("/portfolios", body("POST", data)),
  updatePortfolio: (id: string, data: PortfolioInput) => json<{ portfolio: Portfolio }>(`/portfolios/${id}`, body("PUT", data)),
  deletePortfolio: (id: string) => json<void>(`/portfolios/${id}`, { method: "DELETE" }),
  summary: (id: string) => json<Summary>(`/portfolios/${id}/summary`),
  instruments: (currency: Currency) =>
    json<{ instruments: Instrument[] }>("/instruments", undefined, { currency }).then((r) => r.instruments),
  transactions: (id: string, q: TxnQuery) =>
    json<{ transactions: Txn[]; pagination: Pagination }>(`/portfolios/${id}/transactions`, undefined, txnParams(q)),
  createTransaction: (id: string, data: TxnInput) =>
    json<{ transaction: Txn }>(`/portfolios/${id}/transactions`, body("POST", data)),
  deleteTransaction: (id: string) => json<void>(`/transactions/${id}`, { method: "DELETE" }),

  /** Downloads every transaction matching the filters (all pages) as a CSV file. */
  async exportTransactionsCsv(id: string, q: TxnQuery, filename: string): Promise<void> {
    const { sort, order, instrument, type } = q;
    const res = await request(`/portfolios/${id}/transactions/export`, undefined, { sort, order, instrument, type });
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.append(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};
