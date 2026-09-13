import { describe, expect, it } from "vitest";
import type { StockData, TargetChange } from "./types";
import {
  band,
  dispersion,
  growthScore,
  healthScore,
  momentum,
  qualityScore,
  riskReward,
  score,
  targetMomentumPct,
  toRow,
  upsidePct,
  valueScore,
} from "./scoring";
import { DEFAULT_SCORE_WEIGHTS } from "./defaults";

const DAY = 864e5;
const change = (partial: Partial<TargetChange>): TargetChange => ({
  date: Date.now(),
  firm: "Test",
  action: "main",
  ...partial,
});

function stock(overrides: Partial<StockData> = {}): StockData {
  return {
    symbol: "TEST",
    price: 100,
    targetMean: 120,
    targetHigh: 140,
    targetLow: 90,
    analystCount: 10,
    recommendationMean: 2,
    source: "demo",
    fetchedAt: Date.now(),
    ...overrides,
  };
}

describe("upsidePct", () => {
  it("computes percentage upside", () => {
    expect(upsidePct(120, 100)).toBeCloseTo(20);
  });
  it("returns null without a target or a positive price", () => {
    expect(upsidePct(undefined, 100)).toBeNull();
    expect(upsidePct(120, 0)).toBeNull();
  });
});

describe("riskReward", () => {
  it("is reward divided by downside", () => {
    expect(riskReward(120, 100, 90)).toBeCloseTo(2);
  });
  it("returns null when there is no downside room", () => {
    expect(riskReward(120, 100, 100)).toBeNull();
  });
});

describe("dispersion", () => {
  it("is the target range width relative to the mean", () => {
    expect(dispersion(140, 90, 120)).toBeCloseTo((50 / 120) * 100);
  });
  it("returns null for invalid ranges", () => {
    expect(dispersion(90, 140, 120)).toBeNull();
    expect(dispersion(undefined, 90, 120)).toBeNull();
  });
});

describe("momentum", () => {
  it("weights price-target raises more than grade changes", () => {
    expect(momentum([change({ fromTarget: 100, toTarget: 110 })])).toBeCloseTo(2);
    expect(momentum([change({ action: "up" })])).toBeCloseTo(1);
    expect(momentum([change({ action: "down" })])).toBeCloseTo(-1);
  });
  it("ignores changes older than the window", () => {
    expect(momentum([change({ date: Date.now() - 200 * DAY, action: "up" })], 90)).toBe(0);
  });
  it("clamps a single revision to +/-3", () => {
    expect(momentum([change({ fromTarget: 100, toTarget: 200 })])).toBe(3);
    expect(momentum([change({ fromTarget: 100, toTarget: 1 })])).toBe(-3);
  });
});

describe("targetMomentumPct", () => {
  it("averages percentage target changes", () => {
    const changes = [change({ fromTarget: 100, toTarget: 110 }), change({ fromTarget: 100, toTarget: 120 })];
    expect(targetMomentumPct(changes)).toBeCloseTo(15);
  });
  it("returns null when no targets were adjusted", () => {
    expect(targetMomentumPct([change({ action: "up" })])).toBeNull();
  });
});

describe("score", () => {
  it("rises with upside", () => {
    const low = score(stock({ targetMean: 110, targetHigh: 120, targetLow: 100 }), 20);
    const high = score(stock({ targetMean: 180, targetHigh: 200, targetLow: 150 }), 20);
    expect(high).toBeGreaterThan(low);
  });
  it("rewards tighter target agreement", () => {
    const tight = score(stock({ targetHigh: 130, targetLow: 110 }), 16);
    const wide = score(stock({ targetHigh: 220, targetLow: 40 }), 150);
    expect(tight).toBeGreaterThan(wide);
  });
});

describe("toRow", () => {
  it("derives the screener fields", () => {
    const row = toRow(
      stock({ targetChanges: [change({ fromTarget: 100, toTarget: 110 })] }),
    );
    expect(row.upsidePct).toBeCloseTo(20);
    expect(row.dispersion).toBeCloseTo(41.7, 1);
    expect(row.targetMomentumPct).toBeCloseTo(10);
    expect(row.momentum).toBeCloseTo(2);
    expect(row.score).toBeGreaterThan(0);
  });
});

describe("band", () => {
  it("maps lower-is-better metrics", () => {
    expect(band(8, 40, 8)).toBe(100);
    expect(band(40, 40, 8)).toBe(0);
    expect(band(24, 40, 8)).toBeCloseTo(50);
  });
  it("returns null for missing input", () => {
    expect(band(undefined, 0, 1)).toBeNull();
  });
});

describe("fundamental factor scores", () => {
  it("value: cheaper stocks score higher", () => {
    const cheap = valueScore({ symbol: "A", source: "demo", fetchedAt: 0, forwardPE: 10, priceToBook: 1.2 });
    const expensive = valueScore({ symbol: "B", source: "demo", fetchedAt: 0, forwardPE: 35, priceToBook: 7 });
    expect(cheap!).toBeGreaterThan(expensive!);
  });

  it("quality: profitable, high-margin businesses score higher", () => {
    const strong = qualityScore({
      symbol: "A",
      source: "demo",
      fetchedAt: 0,
      returnOnEquity: 0.25,
      returnOnAssets: 0.12,
      grossMargin: 0.6,
      operatingMargin: 0.25,
      netMargin: 0.2,
    });
    const weak = qualityScore({
      symbol: "B",
      source: "demo",
      fetchedAt: 0,
      returnOnEquity: 0.0,
      returnOnAssets: 0.0,
      grossMargin: 0.1,
      operatingMargin: 0.0,
      netMargin: 0.0,
    });
    expect(strong!).toBeGreaterThan(weak!);
  });

  it("growth: expanding businesses score higher", () => {
    const fast = growthScore({ symbol: "A", source: "demo", fetchedAt: 0, revenueGrowth: 0.3, earningsGrowth: 0.3 });
    const slow = growthScore({ symbol: "B", source: "demo", fetchedAt: 0, revenueGrowth: -0.1, earningsGrowth: -0.1 });
    expect(fast!).toBeGreaterThan(slow!);
  });

  it("health: lower leverage and positive cash flow score higher", () => {
    const sturdy = healthScore({
      symbol: "A",
      source: "demo",
      fetchedAt: 0,
      debtToEquity: 0.2,
      currentRatio: 2,
      freeCashFlow: 1_000_000,
    });
    const risky = healthScore({
      symbol: "B",
      source: "demo",
      fetchedAt: 0,
      debtToEquity: 2,
      currentRatio: 0.8,
      freeCashFlow: -1_000_000,
    });
    expect(sturdy!).toBeGreaterThan(risky!);
  });

  it("returns null when no inputs are available", () => {
    expect(valueScore({ symbol: "A", source: "demo", fetchedAt: 0 })).toBeNull();
    expect(qualityScore({ symbol: "A", source: "demo", fetchedAt: 0 })).toBeNull();
    expect(growthScore({ symbol: "A", source: "demo", fetchedAt: 0 })).toBeNull();
    expect(healthScore({ symbol: "A", source: "demo", fetchedAt: 0 })).toBeNull();
  });

  it("folds fundamentals into the composite score", () => {
    const good = score(stock({ forwardPE: 9, priceToBook: 1, returnOnEquity: 0.25 }), 20);
    const bad = score(stock({ forwardPE: 38, priceToBook: 7, returnOnEquity: 0 }), 20);
    expect(good).toBeGreaterThan(bad);
  });

  it("drops zero-weight components instead of counting them as zero", () => {
    const noFundamentals = score(stock(), 20, { ...DEFAULT_SCORE_WEIGHTS, value: 0, quality: 0, growth: 0, health: 0 });
    const neutralFundamentals = score(stock(), 20, DEFAULT_SCORE_WEIGHTS);
    expect(noFundamentals).toBeGreaterThan(0);
    expect(neutralFundamentals).toBeGreaterThan(0);
  });
});
