import { invalid } from "./http";

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

function intParam(v: unknown, field: string, fallback: number, max: number): number {
  if (v === undefined || v === "") return fallback;
  const n = typeof v === "string" && /^\d+$/.test(v) ? Number(v) : NaN;
  if (!Number.isInteger(n) || n < 1 || n > max) {
    throw invalid(field, `${field} must be a whole number between 1 and ${max}`);
  }
  return n;
}

/** Reads ?page= and ?pageSize= (defaults 1 and 20, pageSize at most 100). */
export function parsePagination(q: Record<string, unknown>) {
  const page = intParam(q.page, "page", 1, 1_000_000);
  const pageSize = intParam(q.pageSize, "pageSize", DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  return { page, pageSize, offset: (page - 1) * pageSize };
}

export function pageMeta(total: number, page: number, pageSize: number) {
  return { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}
