"use client";
import Link from "next/link";
import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { ApiError, api, type Currency, type Portfolio } from "../lib/api";
import { money } from "../lib/format";
import { useApi } from "../lib/useApi";
import Banner from "./components-dashboard/Banner";
import ConfirmModal from "./components-dashboard/ConfirmModal";
import PortfolioModal from "./components-dashboard/PortfolioModal";

export default function DashboardPage() {
  const list = useApi(() => api.portfolios(), []);
  const [target, setTarget] = useState<Portfolio | "new" | null>(null);
  const [deleting, setDeleting] = useState<Portfolio | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState("");

  const portfolios = list.data ?? [];
  const totals = new Map<Currency, number>();
  for (const p of portfolios) totals.set(p.baseCurrency, (totals.get(p.baseCurrency) ?? 0) + p.totalValue);

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    setDeleteError("");
    try {
      await api.deletePortfolio(deleting.id);
      setDeleting(null);
      setFlash(`Deleted "${deleting.name}".`);
      list.reload();
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : "Could not delete the portfolio.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section className="d-hero">
        <h1>Welcome back</h1>
        <p>Here&rsquo;s how your portfolios are performing today.</p>
      </section>

      {flash && (
        <Banner kind="success" onDismiss={() => setFlash("")}>
          {flash}
        </Banner>
      )}
      {list.error && (
        <Banner kind="error" onRetry={list.reload}>
          {list.error.message}
        </Banner>
      )}

      <div className="d-stats">
        <div className="d-stat">
          <span>Portfolios</span>
          <strong>{list.loading && !list.data ? "…" : portfolios.length}</strong>
        </div>
        {[...totals].map(([currency, value]) => (
          <div className="d-stat" key={currency}>
            <span>Total value ({currency})</span>
            <strong>{money(value, currency)}</strong>
          </div>
        ))}
      </div>

      <div className="d-bar">
        <h2>Your portfolios</h2>
        <button type="button" className="d-btn d-btn--primary" onClick={() => setTarget("new")}>
          <Plus size={16} aria-hidden="true" /> New portfolio
        </button>
      </div>

      {list.loading && !list.data ? (
        <div className="d-grid" aria-busy="true">
          <p role="status" className="d-muted">
            Loading portfolios…
          </p>
          {[0, 1, 2].map((i) => (
            <div key={i} className="d-card d-skeleton" aria-hidden="true" />
          ))}
        </div>
      ) : portfolios.length === 0 && !list.error ? (
        <div className="d-card d-empty">
          <h3>No portfolios yet</h3>
          <p>Create your first portfolio to start recording buy and sell transactions and see your holdings.</p>
          <button type="button" className="d-btn d-btn--primary" onClick={() => setTarget("new")}>
            <Plus size={16} aria-hidden="true" /> Create a portfolio
          </button>
        </div>
      ) : (
        <div className="d-grid">
          {portfolios.map((p) => (
            <article key={p.id} className="d-card d-pcard">
              <div>
                <h3>
                  <Link href={`/dashboard/portfolios/${p.id}`}>{p.name}</Link>
                </h3>
                <p className="d-muted">
                  {p.clientName} · {p.baseCurrency}
                </p>
              </div>
              <p className="d-big">{money(p.totalValue, p.baseCurrency)}</p>
              <p className="d-muted">
                {p.transactionCount} {p.transactionCount === 1 ? "transaction" : "transactions"}
              </p>
              <div className="d-actions d-actions--start">
                <button type="button" className="d-btn d-btn--small" onClick={() => setTarget(p)} aria-label={`Edit ${p.name}`}>
                  <Pencil size={14} aria-hidden="true" /> Edit
                </button>
                <button type="button" className="d-btn d-btn--small d-btn--danger-outline" onClick={() => { setDeleteError(""); setDeleting(p); }} aria-label={`Delete ${p.name}`}>
                  <Trash2 size={14} aria-hidden="true" /> Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <PortfolioModal
        target={target}
        onClose={() => setTarget(null)}
        onSaved={(msg) => {
          setTarget(null);
          setFlash(msg);
          list.reload();
        }}
      />
      <ConfirmModal
        open={deleting !== null}
        title="Delete portfolio?"
        message={deleting ? `"${deleting.name}" and its ${deleting.transactionCount} transactions will be permanently deleted. This can't be undone.` : ""}
        confirmLabel="Delete portfolio"
        busy={busy}
        error={deleteError}
        onConfirm={confirmDelete}
        onClose={() => setDeleting(null)}
      />
    </>
  );
}
