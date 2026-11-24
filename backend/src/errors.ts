import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

// Every error response uses this one shape:
// { "error": { "code": "...", "message": "...", "details": [] } }
export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details: unknown[] = [],
  ) {
    super(message);
  }
}

export const badRequest = (msg: string, details: unknown[] = []) => new AppError(400, "BAD_REQUEST", msg, details);
export const unauthorized = (msg = "Authentication required") => new AppError(401, "UNAUTHORIZED", msg);
export const notFoundError = (msg = "Resource not found") => new AppError(404, "NOT_FOUND", msg);
export const conflict = (msg: string) => new AppError(409, "CONFLICT", msg);
export const unprocessable = (msg: string) => new AppError(422, "UNPROCESSABLE", msg);

export function notFound(_req: Request, _res: Response, next: NextFunction) {
  next(notFoundError("Route not found"));
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request data",
        details: err.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
      },
    });
  }
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
  }
  console.error(err);
  res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Something went wrong", details: [] } });
}