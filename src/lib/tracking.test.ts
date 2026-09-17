import { describe, expect, it } from "vitest";
import type { ScreenerRow, TrackedPick } from "./types";
import { toRow } from "./scoring";
import {
  makePick,
  performanceByAge,
  pickId,
  selectPickCandidates,
  summarizePicks,
  updatePick,
} from "./tracking";

const DAY = 864e5;

function row(symbol: string, overrides: Partial<ScreenerRow> = {}): ScreenerRow {
  return {
    ...toRow({
      symbol,
      name: `${symbol} Inc`,
      sector: "Technology",
      price: 100,
      targetMean: 120,
      targetHigh: 130,
      targetLow: 100,
      analystCount: 10,
      source: "demo",
      fetchedAt: 0,
    }),
    ...overrides,
  };
}

function pick(symbol: string, overrides: Partial<TrackedPick> = {}): TrackedPick {
  return {
    id: pickId(symbol, 0),
    symbol,
    addedAt: 0,
    entryPrice: 100,
    entryUpsidePct: 20,
    entryScore: 70,
    entryBenchmark: 400,
    lastPrice: 110,
    lastAt: DAY,
    returnPct: 10,
    benchmarkReturnPct: 2,
    excessPct: 8,
    ...overrides,
  };
}

describe("makePick", () => {
  it("captures the entry state", () => {
    const p = makePick(row("AAA"), 400, 1000);
    expect(p.symbol).toBe("AAA");
    expect(p.entryPrice).toBe(100);
    expect(p.entryUpsidePct).toBeCloseTo(20);
    expect(p.entryBenchmark).toBe(400);
    expect(p.returnPct).toBe(0);
  });
});

describe("selectPickCandidates", () => {
  const now = 100 * DAY;

  it("takes the top N by score", () => {
    const rows = [row("A", { score: 90 }), row("B", { score: 80 }), row("C", { score: 70 })];
    const out = selectPickCandidates(rows, [], 2, 30, now);
    expect(out.map((r) => r.symbol)).toEqual(["A", "B"]);
  });

  it("skips symbols inside the cooldown window", () => {
    const rows = [row("A", { score: 90 }), row("B", { score: 80 })];
    const existing = [pick("A", { addedAt: now - 5 * DAY })];
    const out = selectPickCandidates(rows, existing, 5, 30, now);
    expect(out.map((r) => r.symbol)).toEqual(["B"]);
  });

  it("re-logs after the cooldown has elapsed", () => {
    const rows = [row("A", { score: 90 })];
    const existing = [pick("A", { addedAt: now - 40 * DAY })];
    const out = selectPickCandidates(rows, existing, 5, 30, now);
    expect(out.map((r) => r.symbol)).toEqual(["A"]);
  });

  it("ignores rows without a usable price", () => {
    const rows = [row("A", { score: 90, price: undefined })];
    expect(selectPickCandidates(rows, [], 5, 30, now)).toHaveLength(0);
  });
});

describe("updatePick", () => {
  it("computes return and excess versus the benchmark", () => {
    const updated = updatePick(pick("A"), 120, 440, DAY * 2);
    expect(updated.returnPct).toBeCloseTo(20);
    expect(updated.benchmarkReturnPct).toBeCloseTo(10);
    expect(updated.excessPct).toBeCloseTo(10);
  });

  it("leaves the pick alone without a fresh price", () => {
    const original = pick("A");
    expect(updatePick(original, null, 440)).toBe(original);
  });
});

describe("summarizePicks", () => {
  it("computes hit rate and averages", () => {
    const stats = summarizePicks([
      pick("A", { returnPct: 10, excessPct: 5, benchmarkReturnPct: 5 }),
      pick("B", { returnPct: -4, excessPct: -6, benchmarkReturnPct: 2 }),
      pick("C", { returnPct: 6, excessPct: 3, benchmarkReturnPct: 3 }),
    ]);
    expect(stats.count).toBe(3);
    expect(stats.hitRate).toBeCloseTo((2 / 3) * 100);
    expect(stats.avgReturn).toBeCloseTo(4);
    expect(stats.medianReturn).toBeCloseTo(6);
    expect(stats.avgExcess).toBeCloseTo((5 - 6 + 3) / 3);
  });
});

describe("performanceByAge", () => {
  it("buckets picks by age", () => {
    const now = 200 * DAY;
    const buckets = performanceByAge(
      [
        pick("A", { addedAt: now - 5 * DAY, returnPct: 10 }),
        pick("B", { addedAt: now - 50 * DAY, returnPct: -10 }),
        pick("C", { addedAt: now - 100 * DAY, returnPct: 20 }),
      ],
      now,
    );
    expect(buckets[0].label).toBe("0–1m");
    expect(buckets[0].stats.count).toBe(1);
    expect(buckets[1].stats.count).toBe(1);
    expect(buckets[2].stats.count).toBe(1);
  });
});
