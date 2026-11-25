"use client";
import { useState } from "react";
import { ApiError, api, type Currency, type Portfolio } from "../../lib/api";
import Modal from "./Modal";

interface Props {
  /** `null` = closed, `"new"` = create, a portfolio = edit it. */
  target: Portfolio | "new" | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}

export default function PortfolioModal({ target, onClose, onSaved }: Props) {
  return (
    <Modal open={target !== null} title={target === "new" ? "New portfolio" : "Edit portfolio"} onClose={onClose}>
      {target !== null && <PortfolioForm key={target === "new" ? "new" : target.id} target={target} onClose={onClose} onSaved={onSaved} />}
    </Modal>
  );
}

function PortfolioForm({ target, onClose, onSaved }: Omit<Props, "target"> & { target: Portfolio | "new" }) {
  const editing = target === "new" ? null : target;
  const [name, setName] = useState(editing?.name ?? "");
  const [clientName, setClientName] = useState(editing?.clientName ?? "");
  const [currency, setCurrency] = useState<Currency>(editing?.baseCurrency ?? "KES");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const currencyLocked = !!editing && editing.transactionCount > 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = "Portfolio name is required";
    if (!clientName.trim()) next.clientName = "Client name is required";
    setErrors(next);
    setFormError("");
    if (Object.keys(next).length) return;

    setBusy(true);
    try {
      const data = { name: name.trim(), clientName: clientName.trim(), baseCurrency: currency };
      if (editing) await api.updatePortfolio(editing.id, data);
      else await api.createPortfolio(data);
      onSaved(editing ? "Portfolio updated." : "Portfolio created.");
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors({
          ...(err.field("name") && { name: err.field("name")! }),
          ...(err.field("clientName") && { clientName: err.field("clientName")! }),
        });
        setFormError(err.details.length ? "" : err.message);
      } else setFormError("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      {formError && (
        <p className="d-alert" role="alert">
          {formError}
        </p>
      )}
      <div className="d-fld">
        <label htmlFor="pf-name">Portfolio name</label>
        <input id="pf-name" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!errors.name} aria-describedby={errors.name ? "pf-name-err" : undefined} autoFocus />
        {errors.name && <p id="pf-name-err" className="d-err">{errors.name}</p>}
      </div>
      <div className="d-fld">
        <label htmlFor="pf-client">Client name</label>
        <input id="pf-client" value={clientName} onChange={(e) => setClientName(e.target.value)} aria-invalid={!!errors.clientName} aria-describedby={errors.clientName ? "pf-client-err" : undefined} />
        {errors.clientName && <p id="pf-client-err" className="d-err">{errors.clientName}</p>}
      </div>
      <div className="d-fld">
        <label htmlFor="pf-currency">Base currency</label>
        <select id="pf-currency" value={currency} onChange={(e) => setCurrency(e.target.value as Currency)} disabled={currencyLocked} aria-describedby={currencyLocked ? "pf-currency-hint" : undefined}>
          <option value="KES">KES: Kenyan shilling</option>
          <option value="USD">USD: US dollar</option>
        </select>
        {currencyLocked && <p id="pf-currency-hint" className="d-hint">Currency can&apos;t change once a portfolio has transactions.</p>}
      </div>
      <div className="d-actions">
        <button type="button" className="d-btn" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className="d-btn d-btn--primary" disabled={busy}>
          {busy ? "Saving…" : editing ? "Save changes" : "Create portfolio"}
        </button>
      </div>
    </form>
  );
}
