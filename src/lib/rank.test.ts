import { describe, expect, it } from "vitest";
import type { StockData } from "./types";
import { toRow } from "./scoring";
import { rankRowsBySector } from "./rank";
import { DEFAULT_SCORE_WEIGHTS } from "./defaults";

function stock(symbol: string, sector: string, forwardPE: number, extra: Partial<StockData> = {}) {
  return toRow({
    symbol,
    sector,
    forwardPE,
    price: 100,
    targetMean: 120,
    targetHigh: 130,
    targetLow: 100,
    analystCount: 10,
    source: "demo",
    fetchedAt: 0,
    ...extra,
  });
}

describe("rankRowsBySector", () => {
  it("ranks factors within a sector instead of on absolute thresholds", () => {
    const tech = [stock("T1", "Technology", 30), stock("T2", "Technology", 35), stock("T3", "Technology", 40), stock("T4", "Technology", 45), stock("T5", "Technology", 50)];
    const utils = [stock("U1", "Utilities", 10), stock("U2", "Utilities", 11), stock("U3", "Utilities", 12), stock("U4", "Utilities", 13), stock("U5", "Utilities", 14)];

    const ranked = rankRowsBySector([...tech, ...utils], DEFAULT_SCORE_WEIGHTS);
    const by = new Map(ranked.map((r) => [r.symbol, r]));

    // Cheapest in Technology beats the most expensive in Technology…
    expect(by.get("T1")!.valueScore!).toBeGreaterThan(by.get("T5")!.valueScore!);
    // …and even beats the most expensive (absolutely cheap) utility, because it
    // is the best value *among its own sector*.
    expect(by.get("T1")!.valueScore!).toBeGreaterThan(by.get("U5")!.valueScore!);
    expect(by.get("T1")!.rankedBySector).toBe(true);
  });

  it("falls back to the whole universe for tiny sectors", () => {
    const tech = [stock("T1", "Technology", 30), stock("T2", "Technology", 35), stock("T3", "Technology", 40), stock("T4", "Technology", 45), stock("T5", "Technology", 50)];
    const lone = stock("L1", "Energy", 12);
    const ranked = rankRowsBySector([...tech, lone], DEFAULT_SCORE_WEIGHTS);
    const l = ranked.find((r) => r.symbol === "L1")!;
    expect(l.rankedBySector).toBe(false);
    expect(l.score).toBeGreaterThan(0);
  });

  it("recomputes a finite composite score for every row", () => {
    const rows = rankRowsBySector([stock("A", "Technology", 20), stock("B", "Technology", 40)], DEFAULT_SCORE_WEIGHTS);
    for (const r of rows) {
      expect(Number.isFinite(r.score)).toBe(true);
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(100);
    }
  });
});
