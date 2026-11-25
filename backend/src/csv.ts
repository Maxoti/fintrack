// CSV helpers (RFC 4180). Cells that start with = + - @ (or tab / CR) are prefixed
// with an apostrophe so spreadsheets treat them as text, not as formulas.
const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  let s = String(value);
  if (typeof value === "string" && FORMULA_START.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Builds a CSV document with a UTF-8 BOM (so Excel reads it correctly) and CRLF line ends. */
export function toCsv(header: string[], rows: (string | number | null)[][]): string {
  const lines = [header, ...rows].map((row) => row.map(csvCell).join(","));
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}
