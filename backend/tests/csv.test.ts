import { describe, expect, it } from "vitest";
import { csvCell, toCsv } from "../src/csv";

describe("csvCell", () => {
  it("leaves plain values alone", () => {
    expect(csvCell("SCOM")).toBe("SCOM");
    expect(csvCell(12.5)).toBe("12.5");
    expect(csvCell(null)).toBe("");
  });

  it("quotes cells with commas, quotes or newlines and doubles inner quotes", () => {
    expect(csvCell("Safaricom, PLC")).toBe('"Safaricom, PLC"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("a\nb")).toBe('"a\nb"');
  });

  it("neutralises spreadsheet formula injection", () => {
    expect(csvCell("=HYPERLINK(\"http://evil\")")).toBe("\"'=HYPERLINK(\"\"http://evil\"\")\"");
    expect(csvCell("+1+1")).toBe("'+1+1");
    expect(csvCell("-2")).toBe("'-2");
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
  });

  it("does not alter negative numbers passed as numbers", () => {
    expect(csvCell(-5)).toBe("-5");
  });
});

describe("toCsv", () => {
  it("writes a BOM, a header, and CRLF line endings", () => {
    const csv = toCsv(["A", "B"], [["x", 1], ["y", 2]]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv.slice(1)).toBe("A,B\r\nx,1\r\ny,2\r\n");
  });

  it("produces just the header when there are no rows", () => {
    expect(toCsv(["A"], []).slice(1)).toBe("A\r\n");
  });
});
