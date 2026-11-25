import { describe, expect, it } from "vitest";
import { AppError } from "../src/errors";
import { pageMeta, parsePagination } from "../src/pagination";

describe("parsePagination", () => {
  it("uses defaults when nothing is given", () => {
    expect(parsePagination({})).toEqual({ page: 1, pageSize: 20, offset: 0 });
  });

  it("computes the offset", () => {
    expect(parsePagination({ page: "3", pageSize: "25" })).toEqual({ page: 3, pageSize: 25, offset: 50 });
  });

  it.each([
    [{ page: "0" }],
    [{ page: "-1" }],
    [{ page: "abc" }],
    [{ page: "1.5" }],
    [{ pageSize: "0" }],
    [{ pageSize: "101" }],
  ])("rejects %o with a 422", (q) => {
    try {
      parsePagination(q);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).status).toBe(422);
    }
  });
});

describe("pageMeta", () => {
  it("rounds the page count up", () => {
    expect(pageMeta(41, 1, 20)).toEqual({ page: 1, pageSize: 20, total: 41, totalPages: 3 });
  });

  it("always reports at least one page", () => {
    expect(pageMeta(0, 1, 20).totalPages).toBe(1);
  });
});
