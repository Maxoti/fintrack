"use client";
import { useState } from "react";
import { ApiError, api, type Instrument, type Portfolio, type TxnType } from "../../lib/api";
import { todayIso } from "../../lib/format";

interface Props {
  portfolio: Portfolio;
  instruments: Instrument[] | undefined;
  onCreated: () => void;
}

export default function TransactionForm({ portfolio, instruments, onCreated }: Props) {
  const [type, setType] = useState<TxnType>("BUY");
  const [instrument, setInstrument] = useState("");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [date, setDate] = useState(todayIso());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  function pick(symbol: string) {
    setInstrument(symbol);
    const last = instruments?.find((i) => i.symbol === symbol)?.lastPrice;
    if (!price && last) setPrice(String(last)); // suggest the latest price
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!instrument) next.instrument = "Choose an instrument";
    if (!(Number(quantity) > 0)) next.quantity = "Enter a quantity greater than 0";
    if (!(Number(price) > 0)) next.unitPrice = "Enter a unit price greater than 0";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) next.tradeDate = "Choose a trade date";
    setErrors(next);
    setFormError("");
    if (Object.keys(next).length) return;

    setBusy(true);
    try {
      await api.createTransaction(portfolio.id, { instrument, type, quantity: Number(quantity), unitPrice: Number(price), tradeDate: date });
      setQuantity("");
      setPrice("");
      onCreated();
    } catch (err) {
      if (err instanceof ApiError) {
        const fields = ["instrument", "quantity", "unitPrice", "tradeDate"];
        setErrors(Object.fromEntries(fields.flatMap((f) => (err.field(f) ? [[f, err.field(f)!]] : []))));
        // e.g. "Insufficient holdings" from the database rule arrives without a field
        setFormError(err.details.length ? "" : err.message);
      } else setFormError("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const field = (id: string, label: string, input: React.ReactNode) => (
    <div className="d-fld">
      <label htmlFor={`tx-${id}`}>{label}</label>
      {input}
      {errors[id] && (
        <p id={`tx-${id}-err`} className="d-err">
          {errors[id]}
        </p>
      )}
    </div>
  );
  const aria = (id: string) => ({ id: `tx-${id}`, "aria-invalid": !!errors[id], "aria-describedby": errors[id] ? `tx-${id}-err` : undefined });

  return (
    <form onSubmit={submit} noValidate>
      {formError && (
        <p className="d-alert" role="alert">
          {formError}
        </p>
      )}
      <fieldset className="d-seg">
        <legend>Type</legend>
        {(["BUY", "SELL"] as const).map((t) => (
          <label key={t} className={type === t ? "on" : ""}>
            <input type="radio" name="type" value={t} checked={type === t} onChange={() => setType(t)} />
            {t === "BUY" ? "Buy" : "Sell"}
          </label>
        ))}
      </fieldset>
      {field(
        "instrument",
        "Instrument",
        <select {...aria("instrument")} value={instrument} onChange={(e) => pick(e.target.value)} disabled={!instruments}>
          <option value="">{instruments ? "Select instrument…" : "Loading…"}</option>
          {instruments?.map((i) => (
            <option key={i.symbol} value={i.symbol}>
              {i.symbol} · {i.name}
            </option>
          ))}
        </select>,
      )}
      <div className="d-row2">
        {field("quantity", "Quantity", <input {...aria("quantity")} inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} />)}
        {field("unitPrice", `Unit price (${portfolio.baseCurrency})`, <input {...aria("unitPrice")} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />)}
      </div>
      {field("tradeDate", "Trade date", <input {...aria("tradeDate")} type="date" value={date} onChange={(e) => setDate(e.target.value)} />)}
      <button type="submit" className="d-btn d-btn--primary d-btn--block" disabled={busy}>
        {busy ? "Saving…" : "Save transaction"}
      </button>
    </form>
  );
}
