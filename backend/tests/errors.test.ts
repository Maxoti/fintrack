import { Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { AppError, errorHandler, unprocessable } from "../src/errors";

// Unit tests: call the error handler directly with a fake response.
function fakeRes() {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  return res as unknown as Response & { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> };
}
const req = {} as Request;

describe("errorHandler", () => {
  it("maps AppError to its status and code", () => {
    const res = fakeRes();
    errorHandler(unprocessable("Cannot sell more than held"), req, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: "UNPROCESSABLE", message: "Cannot sell more than held", details: [] },
    });
  });

  it("maps Zod validation errors to 400 with field details", () => {
    const result = z.object({ quantity: z.number().positive() }).safeParse({ quantity: -5 });
    const res = fakeRes();
    errorHandler(result.error, req, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    const body = res.json.mock.calls[0][0];
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details[0].field).toBe("quantity");
  });

  it("hides internal error messages behind a 500", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = fakeRes();
    errorHandler(new Error("db password is hunter2"), req, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(500);
    expect(JSON.stringify(res.json.mock.calls[0][0])).not.toContain("hunter2");
    spy.mockRestore();
  });

  it("AppError keeps custom details", () => {
    const err = new AppError(409, "CONFLICT", "Email already registered", [{ field: "email" }]);
    expect(err.details).toEqual([{ field: "email" }]);
  });
});