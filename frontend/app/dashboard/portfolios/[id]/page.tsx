"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, ChevronLeft, Download, Trash2 } from "lucide-react";
import { ApiError, api, type SortKey, type Txn, type TxnQuery } from "../../../lib/api";
import { dateLabel, money, pct, pnlClass, quantity, signedMoney, signedPct, slug } from "../../../lib/format";
import { useApi } from "../../../lib/useApi";
import Banner from "../../components-dashboard/Banner";
import ConfirmModal from "../../components-dashboard/ConfirmModal";
import Donut from "../../components-dashboard/Donut";
import TransactionForm from "../../components-dashboard/TransactionForm";

const COLUMNS: { key: SortKey; label: string; right?: boolean }[] = [
  { key: "tradeDate", label: "Date" },
  { key: "instrument", label: "Instrument" },
  { key: "type", label: "Type" },
  { key: "quantity", label: "Quantity", right: true },
  { key: "unitPrice", label: "Unit price", right: true },
  { key: "amount", label: "Amount", right: true },
];

export default function PortfolioPage() {
  const { id } = useParams<{ id: string }>();
  const [q, setQ] = useState<TxnQuery>({ page: 1, pageSize: 20, sort: "tradeDate", order: "desc", instrument: "", type: "" });
  const [flash, setFlash] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [toDelete, setToDelete] = useState<Txn | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);

  const portfolio = useApi(() => api.portfolio(id), [id]);
  const summary = useApi(() => api.summary(id), [id]);
  const txns = useApi(() => api.transactions(id, q), [id, q]);
  const currency = portfolio.data?.baseCurrency;
  const instruments = useApi(() => (currency ? api.instruments(currency) : Promise.resolve([])), [currency]);

  const p = portfolio.data;
  useEffect(() => {
    document.title = p ? `${p.name} | FinTrack by Finnet Technologies` : "Portfolio | FinTrack by Finnet Technologies";
  }, [p]);

  const refreshAll = () => {
    portfolio.reload();
    summary.reload();
    txns.reload();
  };
  const set = (patch: Partial<TxnQuery>) => setQ((prev) => ({ ...prev, page: 1, ...patch }));
  const sortBy = (key: SortKey) =>
    set({ sort: key, order: q.sort === key && q.order === "asc" ? "desc" : q.sort === key ? "asc" : key === "tradeDate" ? "desc" : "asc" });

  async function confirmDelete() {
    if (!toDelete) return;
    setBusy(true);
    setDeleteError("");
    try {
      await api.deleteTransaction(toDelete.id);
      setToDelete(null);
      setFlash({ kind: "success", text: "Transaction deleted." });
      // deleting the last row on a later page would leave that page empty
      if ((txns.data?.transactions.length ?? 0) === 1 && (q.page ?? 1) > 1) setQ((prev) => ({ ...prev, page: (prev.page ?? 2) - 1 }));
      refreshAll();
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : "Could not delete the transaction.");
    } finally {
      setBusy(false);
    }
  }

  async function exportCsv() {
    if (!p) return;
    setExporting(true);
    try {
      await api.exportTransactionsCsv(id, q, `fintrack-${slug(p.name)}-transactions.csv`);
      setFlash({ kind: "success", text: "CSV downloaded." });
    } catch (err) {
      setFlash({ kind: "error", text: err instanceof ApiError ? err.message : "Export failed." });
    } finally {
      setExporting(false);
    }
  }

  if (portfolio.error && !p) {
    return (
      <>
        <Link href="/dashboard" className="d-back">
          <ChevronLeft size={16} aria-hidden="true" /> All portfolios
        </Link>
        <Banner kind="error" onRetry={portfolio.reload}>
          {portfolio.error.status === 404 ? "This portfolio doesn't exist or isn't yours." : portfolio.error.message}
        </Banner>
      </>
    );
  }

  const s = summary.data;
  const pg = txns.data?.pagination;
  const rows = txns.data?.transactions ?? [];
  const cur = p?.baseCurrency ?? "KES";
  const from = pg && pg.total ? (pg.page - 1) * pg.pageSize + 1 : 0;
  const to = pg ? Math.min(pg.page * pg.pageSize, pg.total) : 0;

  return (
    <>
      <Link href="/dashboard" className="d-back">
        <ChevronLeft size={16} aria-hidden="true" /> All portfolios
      </Link>
      <section className="d-hero d-hero--row">
        <div>
          <h1>{p ? p.name : "Loading…"}</h1>
          <p>{p ? `${p.clientName} · ${p.baseCurrency}` : "Fetching your portfolio data…"}</p>
        </div>
      </section>

      {flash && (
        <Banner kind={flash.kind} onDismiss={() => setFlash(null)}>
          {flash.text}
        </Banner>
      )}
      {summary.error && (
        <Banner kind="error" onRetry={summary.reload}>
          Couldn&rsquo;t load the holdings summary: {summary.error.message}
        </Banner>
      )}

      <div className="d-stats">
        <div className="d-stat">
          <span>Total value</span>
          <strong>{s ? money(s.totals.totalValue, cur) : "…"}</strong>
        </div>
        <div className="d-stat">
          <span>Total invested</span>
          <strong>{s ? money(s.totals.totalInvested, cur) : "…"}</strong>
        </div>
        <div className="d-stat">
          <span>Unrealised gain / loss</span>
          <strong className={s ? pnlClass(s.totals.unrealisedPnl) : ""}>{s ? signedMoney(s.totals.unrealisedPnl, cur) : "…"}</strong>
          {s && <small className={pnlClass(s.totals.unrealisedPnl)}>{signedPct(s.totals.unrealisedPnlPct)}</small>}
        </div>
        <div className="d-stat">
          <span>Transactions</span>
          <strong>{p ? p.transactionCount : "…"}</strong>
        </div>
      </div>

      <div className="d-cols">
        <section className="d-card" aria-labelledby="alloc-h">
          <h2 id="alloc-h">Allocation by instrument</h2>
          {!s && !summary.error && <p role="status" className="d-muted">Loading allocation…</p>}
          {s && s.holdings.length === 0 && <p className="d-muted">No holdings yet. Record a buy transaction and your allocation will appear here.</p>}
          {s && s.holdings.length > 0 && <Donut slices={s.holdings.map((h) => ({ label: h.instrument, pct: h.allocationPct }))} />}
        </section>

        <section className="d-card" aria-labelledby="hold-h">
          <h2 id="hold-h">Holdings</h2>
          {s && s.holdings.length === 0 ? (
            <p className="d-muted">Nothing held at the moment.</p>
          ) : (
            <div className="d-scroll">
              <table className="d-table">
                <thead>
                  <tr>
                    <th scope="col">Instrument</th>
                    <th scope="col" className="r">Net qty</th>
                    <th scope="col" className="r">Avg cost</th>
                    <th scope="col" className="r">Invested</th>
                    <th scope="col" className="r">Value</th>
                    <th scope="col" className="r">Gain / loss</th>
                    <th scope="col" className="r">Share</th>
                  </tr>
                </thead>
                <tbody>
                  {!s && (
                    <tr>
                      <td colSpan={7} className="d-muted">Loading holdings…</td>
                    </tr>
                  )}
                  {s?.holdings.map((h) => (
                    <tr key={h.instrument}>
                      <th scope="row" title={h.instrumentName}>{h.instrument}</th>
                      <td className="r">{quantity(h.netQuantity)}</td>
                      <td className="r">{money(h.averageCost, cur)}</td>
                      <td className="r">{money(h.totalInvested, cur)}</td>
                      <td className="r">{money(h.totalValue, cur)}</td>
                      <td className={`r ${pnlClass(h.unrealisedPnl)}`}>{signedMoney(h.unrealisedPnl, cur)}</td>
                      <td className="r">{pct(h.allocationPct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <div className="d-cols d-cols--wide">
        <section className="d-card" aria-labelledby="txn-h">
          <div className="d-bar">
            <h2 id="txn-h">Transactions</h2>
            <button type="button" className="d-btn" onClick={exportCsv} disabled={exporting || !pg?.total}>
              <Download size={16} aria-hidden="true" /> {exporting ? "Exporting…" : "Export CSV"}
            </button>
          </div>

          <div className="d-filters">
            <div className="d-fld">
              <label htmlFor="f-inst">Instrument</label>
              <select id="f-inst" value={q.instrument} onChange={(e) => set({ instrument: e.target.value })}>
                <option value="">All instruments</option>
                {instruments.data?.map((i) => (
                  <option key={i.symbol} value={i.symbol}>{i.symbol}</option>
                ))}
              </select>
            </div>
            <div className="d-fld">
              <label htmlFor="f-type">Type</label>
              <select id="f-type" value={q.type} onChange={(e) => set({ type: e.target.value as TxnQuery["type"] })}>
                <option value="">Buy and sell</option>
                <option value="BUY">Buy</option>
                <option value="SELL">Sell</option>
              </select>
            </div>
            <div className="d-fld">
              <label htmlFor="f-size">Rows per page</label>
              <select id="f-size" value={q.pageSize} onChange={(e) => set({ pageSize: Number(e.target.value) })}>
                {[10, 20, 50, 100].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          </div>

          {txns.error && (
            <Banner kind="error" onRetry={txns.reload}>
              Couldn&rsquo;t load transactions: {txns.error.message}
            </Banner>
          )}

          <div className="d-scroll" aria-busy={txns.loading}>
            <table className="d-table">
              <thead>
                <tr>
                  {COLUMNS.map((c) => (
                    <th key={c.key} scope="col" className={c.right ? "r" : ""} aria-sort={q.sort === c.key ? (q.order === "asc" ? "ascending" : "descending") : "none"}>
                      <button type="button" className="d-sort" onClick={() => sortBy(c.key)}>
                        {c.label}
                        {q.sort === c.key && (q.order === "asc" ? <ArrowUp size={12} aria-hidden="true" /> : <ArrowDown size={12} aria-hidden="true" />)}
                      </button>
                    </th>
                  ))}
                  <th scope="col"><span className="d-sr">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {!txns.data && !txns.error && (
                  <tr><td colSpan={7} className="d-muted">Loading transactions…</td></tr>
                )}
                {txns.data && rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="d-muted">
                      {q.instrument || q.type ? "No transactions match these filters." : "No transactions yet. Use the form to record your first buy or sell."}
                    </td>
                  </tr>
                )}
                {rows.map((t) => (
                  <tr key={t.id}>
                    <td>{dateLabel(t.tradeDate)}</td>
                    <th scope="row" title={t.instrumentName}>{t.instrument}</th>
                    <td><span className={`d-tag d-tag--${t.type.toLowerCase()}`}>{t.type === "BUY" ? "Buy" : "Sell"}</span></td>
                    <td className="r">{quantity(t.quantity)}</td>
                    <td className="r">{money(t.unitPrice, cur)}</td>
                    <td className="r">{money(t.amount, cur)}</td>
                    <td className="r">
                      <button type="button" className="d-btn d-btn--ghost d-btn--small" aria-label={`Delete ${t.type.toLowerCase()} of ${t.instrument} on ${dateLabel(t.tradeDate)}`} onClick={() => { setDeleteError(""); setToDelete(t); }}>
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pg && pg.total > 0 && (
            <nav className="d-pager" aria-label="Transactions pages">
              <span>
                Showing {from}–{to} of {pg.total}
              </span>
              <span className="d-pager__btns">
                <button type="button" className="d-btn d-btn--small" disabled={pg.page <= 1} onClick={() => setQ((prev) => ({ ...prev, page: pg.page - 1 }))}>
                  Previous
                </button>
                <span aria-current="page">
                  Page {pg.page} of {pg.totalPages}
                </span>
                <button type="button" className="d-btn d-btn--small" disabled={pg.page >= pg.totalPages} onClick={() => setQ((prev) => ({ ...prev, page: pg.page + 1 }))}>
                  Next
                </button>
              </span>
            </nav>
          )}
        </section>

        <section className="d-card" aria-labelledby="add-h">
          <h2 id="add-h">Add transaction</h2>
          {p ? (
            <TransactionForm
              portfolio={p}
              instruments={instruments.data}
              onCreated={() => {
                setFlash({ kind: "success", text: "Transaction recorded successfully." });
                set({});
                refreshAll();
              }}
            />
          ) : (
            <p role="status" className="d-muted">Loading…</p>
          )}
        </section>
      </div>

      <ConfirmModal
        open={toDelete !== null}
        title="Delete transaction?"
        message={toDelete ? `This ${toDelete.type.toLowerCase()} of ${quantity(toDelete.quantity)} ${toDelete.instrument} on ${dateLabel(toDelete.tradeDate)} will be permanently deleted and your holdings recalculated.` : ""}
        confirmLabel="Delete transaction"
        busy={busy}
        error={deleteError}
        onConfirm={confirmDelete}
        onClose={() => setToDelete(null)}
      />
    </>
  );
}
