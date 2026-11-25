const money2 = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const qty4 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 });

const sign = (n: number) => (n > 0 ? "+" : n < 0 ? "\u2212" : "");

/** KES 1,250,000.00 */
export const money = (n: number, currency: string) => `${currency} ${money2.format(n)}`;
/** +KES 97,500.00 / \u2212KES 25,000.00 (the sign always accompanies green/red) */
export const signedMoney = (n: number, currency: string) => `${sign(n)}${currency} ${money2.format(Math.abs(n))}`;
export const signedPct = (n: number) => `${sign(n)}${money2.format(Math.abs(n))}%`;
export const pct = (n: number) => `${money2.format(n)}%`;
export const quantity = (n: number) => qty4.format(n);
export const pnlClass = (n: number) => (n > 0 ? "pos" : n < 0 ? "neg" : "");

export const dateLabel = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });

export const todayIso = () => new Date().toISOString().slice(0, 10);

export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "portfolio";
