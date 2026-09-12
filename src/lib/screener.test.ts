import { describe, expect, it } from "vitest";
import type { StockData } from "./types";
import { toRow } from "./scoring";
import { applyFilters, sortRows } from "./screener";
import { DEFAULT_FILTERS } from "./defaults";

function row(overrides: Partial<StockData>) {
  return toRow({
    symbol: "AAA",
    price: 100,
    targetMean: 120,
    targetHigh: 130,
    targetLow: 100,
    analystCount: 10,
    source: "demo",
    fetchedAt: Date.now(),
    ...overrides,
  });
}

const filters = (patch = {}) => ({ ...DEFAULT_FILTERS, ...patch });

describe("applyFilters", () => {
  it("enforces the minimum upside", () => {
    const rows = [row({ symbol: "LOW", targetMean: 105 }), row({ symbol: "HIGH", targetMean: 130 })];
    const out = applyFilters(rows, filters({ minUpside: 20 }));
    expect(out.map((r) => r.symbol)).toEqual(["HIGH"]);
  });

  it("drops rows without targets when onlyWithTargets is set", () => {
    const rows = [row({ symbol: "NONE", targetMean: undefined, targetHigh: undefined, targetLow: undefined })];
    expect(applyFilters(rows, filters({ onlyWithTargets: true }))).toHaveLength(0);
  });

  it("enforces analyst coverage bounds", () => {
    const rows = [row({ symbol: "THIN", analystCount: 2 }), row({ symbol: "DEEP", analystCount: 15 })];
    expect(applyFilters(rows, filters({ minAnalysts: 5 })).map((r) => r.symbol)).toEqual(["DEEP"]);
  });

  it("enforces max dispersion", () => {
    const rows = [
      row({ symbol: "TIGHT", targetHigh: 125, targetLow: 115, targetMean: 120 }),
      row({ symbol: "WIDE", targetHigh: 220, targetLow: 40, targetMean: 120 }),
    ];
    expect(applyFilters(rows, filters({ maxDispersion: 50 })).map((r) => r.symbol)).toEqual(["TIGHT"]);
  });

  it("filters by sector", () => {
    const rows = [row({ symbol: "TECH", sector: "Technology" }), row({ symbol: "ENER", sector: "Energy" })];
    expect(applyFilters(rows, filters({ sectors: ["Energy"] })).map((r) => r.symbol)).toEqual(["ENER"]);
  });
});

describe("sortRows", () => {
  it("sorts descending by the given key", () => {
    const rows = [row({ symbol: "A", targetMean: 130 }), row({ symbol: "B", targetMean: 110 })];
    expect(sortRows(rows, "upsidePct", "desc").map((r) => r.symbol)).toEqual(["A", "B"]);
    expect(sortRows(rows, "upsidePct", "asc").map((r) => r.symbol)).toEqual(["B", "A"]);
  });
});
