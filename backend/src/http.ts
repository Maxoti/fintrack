import type { NextFunction, Request, RequestHandler, Response } from "express";
import { AppError, notFoundError } from "./errors";

export const CURRENCIES = ["KES", "USD"] as const;
export const TXN_TYPES = ["BUY", "SELL"] as const;

/** Sends `{ error: { code, message, details } }`: the one error shape used everywhere. */
export function fail(
  res: Response,
  status: number,
  code: string,
  message: string,
  details: unknown[] = [],
): void {
  res.status(status).json({ error: { code, message, details } });
}

/** Validation failure: 422, as documented in openapi.ts. */
export function invalid(field: string, message: string): AppError {
  return new AppError(422, "VALIDATION_ERROR", message, [{ field, message }]);
}

export function isPgError(err: unknown, code: string): boolean {
  return typeof err === "object" && err !== null && (err as { code?: unknown }).code === code;
}

/** Sends any error in the standard shape, translating Postgres errors. */
export function sendError(res: Response, err: unknown): void {
  if (err instanceof AppError) {
    fail(res, err.status, err.code, err.message, err.details);
    return;
  }

  const pg = err as { code?: string; message?: string } | null;
  switch (pg?.code) {
    case "23514": // check_violation: "Insufficient holdings" and currency-mismatch triggers
      fail(res, 422, "UNPROCESSABLE", pg?.message ?? "Rule violation");
      return;
    case "23505": // unique_violation
      fail(res, 409, "CONFLICT", "Resource already exists");
      return;
    case "23503": // foreign_key_violation
      fail(res, 409, "CONFLICT", "Resource is referenced by other records");
      return;
    case "22P02": // invalid_text_representation
    case "22003": // numeric_value_out_of_range
    case "22007": // invalid_datetime_format
    case "22008": // datetime_field_overflow
      fail(res, 422, "VALIDATION_ERROR", "Invalid value");
      return;
  }

  console.error(err);
  fail(res, 500, "INTERNAL_ERROR", "Something went wrong");
}

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

/** Wraps an async route so any thrown error becomes a JSON error response. */
export function handle(fn: AsyncHandler): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch((err) => sendError(res, err));
  };
}

export const bodyOf = (req: Request): Record<string, unknown> =>
  (req.body && typeof req.body === "object" ? req.body : {}) as Record<string, unknown>;

// ---------- Validators ----------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A malformed id in the URL can't match anything, so it is a plain 404. */
export function pathId(v: unknown): string {
  if (typeof v !== "string" || !UUID_RE.test(v)) throw notFoundError();
  return v;
}

export function asText(v: unknown, field: string, max = 200): string {
  if (typeof v !== "string" || v.trim().length === 0) throw invalid(field, `${field} is required`);
  const t = v.trim();
  if (t.length > max) throw invalid(field, `${field} must be at most ${max} characters`);
  return t;
}

export function asEnum<T extends string>(v: unknown, field: string, allowed: readonly T[]): T {
  if (typeof v !== "string" || !allowed.includes(v as T)) {
    throw invalid(field, `${field} must be one of: ${allowed.join(", ")}`);
  }
  return v as T;
}

/** Like asEnum, but a missing value gives `undefined` instead of an error. */
export function optionalEnum<T extends string>(
  v: unknown,
  field: string,
  allowed: readonly T[],
): T | undefined {
  return v === undefined ? undefined : asEnum(v, field, allowed);
}

/** Positive number with at most 4 decimals (matches NUMERIC(18,4)). */
export function asPositiveNumber(v: unknown, field: string): number {
  const n = typeof v === "string" && v.trim() !== "" ? Number(v) : v;
  if (typeof n !== "number" || !Number.isFinite(n) || n <= 0) {
    throw invalid(field, `${field} must be a number greater than 0`);
  }
  if (n >= 1e14) throw invalid(field, `${field} is too large`);
  if (Math.abs(n * 1e4 - Math.round(n * 1e4)) > 1e-6) {
    throw invalid(field, `${field} must have at most 4 decimal places`);
  }
  return n;
}

/** Calendar date as YYYY-MM-DD. */
export function asDate(v: unknown, field: string): string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    throw invalid(field, `${field} must be a date in YYYY-MM-DD format`);
  }
  const d = new Date(`${v}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v) {
    throw invalid(field, `${field} is not a valid date`);
  }
  return v;
}

// ---------- Number helpers (pg returns NUMERIC as strings) ----------

export const num = (v: string | number | null | undefined): number | null =>
  v === null || v === undefined ? null : Number(v);

export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;