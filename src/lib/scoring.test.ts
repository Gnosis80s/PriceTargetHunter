import { describe, expect, it } from "vitest";
import type { StockData, TargetChange } from "./types";
import {
  ageWeight,
  band,
  compositeScore,
  confidenceParts,
  confidenceScore,
  consensusTarget,
  daysUntil,
  dispersion,
  estimateMomentumScore,
  freshnessScore,
  growthScore,
  healthScore,
  isTopTierFirm,
  momentum,
  participationScore,
  priceTrendScore,
  qualityScore,
  riskFlags,
  riskReward,
  riskScore,
  score,
  scoreParts,
  targetAgeDays,
  targetMomentumPct,
  toRow,
  UNKNOWN_FRESHNESS,
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

describe("revision recency & tier-1 weighting", () => {
  it("halves the weight of a revision every 30 days", () => {
    expect(ageWeight(Date.now())).toBeCloseTo(1);
    expect(ageWeight(Date.now() - 30 * DAY)).toBeCloseTo(0.5, 2);
    expect(ageWeight(Date.now() - 60 * DAY)).toBeCloseTo(0.25, 2);
  });

  it("counts a fresh upgrade more than an old one", () => {
    const fresh = momentum([change({ action: "up", date: Date.now() })]);
    const old = momentum([change({ action: "up", date: Date.now() - 60 * DAY })]);
    expect(fresh).toBeGreaterThan(old);
    expect(old).toBeGreaterThan(0);
  });

  it("recognises top-tier research desks", () => {
    expect(isTopTierFirm("Goldman Sachs")).toBe(true);
    expect(isTopTierFirm("Morgan Stanley & Co.")).toBe(true);
    expect(isTopTierFirm("Bob's Research Shack")).toBe(false);
    expect(isTopTierFirm(undefined)).toBe(false);
  });

  it("scores fresh top-tier participation higher than stale unknown coverage", () => {
    const active = participationScore([
      change({ date: Date.now(), firm: "Morgan Stanley" }),
      change({ date: Date.now() - 5 * DAY, firm: "Goldman Sachs" }),
    ]);
    const stale = participationScore([change({ date: Date.now() - 80 * DAY, firm: "No-name Research" })]);
    expect(active!).toBeGreaterThan(stale!);
  });

  it("treats stale coverage as less fresh", () => {
    const recent = freshnessScore([change({ date: Date.now() })]);
    const older = freshnessScore([change({ date: Date.now() - 90 * DAY })]);
    expect(recent!).toBeGreaterThan(older!);
    expect(freshnessScore([])).toBeNull();
  });
});

describe("confidenceScore", () => {
  it("is higher with tight agreement, broad coverage and fresh top-tier notes", () => {
    const strong = confidenceScore(
      stock({
        recommendationMean: 2,
        analystCount: 25,
        targetChanges: [
          change({ date: Date.now(), firm: "Goldman Sachs" }),
          change({ date: Date.now() - 4 * DAY, firm: "Morgan Stanley" }),
        ],
      }),
      15,
    );
    const weak = confidenceScore(stock({ analystCount: 2, targetChanges: [] }), 150);
    expect(strong!).toBeGreaterThan(weak!);
  });

  it("returns null when nothing is known about the consensus", () => {
    const bare: StockData = { symbol: "X", source: "demo", fetchedAt: 0 };
    expect(confidenceScore(bare, null)).toBeNull();
  });

  it("exposes the four contributing parts", () => {
    const parts = confidenceParts(stock({ analystCount: 10 }), 20);
    expect(parts.agreement).toBeCloseTo(100 - 20 * 0.8, 1);
    expect(parts.coverage).toBeCloseTo(50, 1);
    // A target with no dated revisions is penalised, not treated as unknown.
    expect(parts.freshness).toBe(UNKNOWN_FRESHNESS);
    expect(parts.participation).toBeNull();
  });

  it("does not invent freshness for a stock with no target", () => {
    const parts = confidenceParts({ symbol: "X", source: "demo", fetchedAt: 0 }, null);
    expect(parts.freshness).toBeNull();
  });

  it("penalises a stale target more than a freshly revised one", () => {
    const fresh = confidenceScore(stock({ targetChanges: [change({ date: Date.now() })] }), 20);
    const stale = confidenceScore(stock({ targetChanges: [] }), 20);
    expect(fresh!).toBeGreaterThan(stale!);
  });
});

describe("consensusTarget & targetAgeDays", () => {
  it("prefers the median target", () => {
    expect(consensusTarget(stock({ targetMean: 120, targetMedian: 115 }))).toBe(115);
    expect(consensusTarget(stock({ targetMean: 120 }))).toBe(120);
  });

  it("measures the age of the newest action", () => {
    const age = targetAgeDays([change({ date: Date.now() - 10 * DAY })]);
    expect(age).toBeCloseTo(10, 0);
    expect(targetAgeDays([])).toBeNull();
    expect(targetAgeDays(undefined)).toBeNull();
  });
});

describe("accuracy signals", () => {
  it("estimate momentum rises with upward revisions", () => {
    const up = estimateMomentumScore({
      symbol: "A",
      source: "demo",
      fetchedAt: 0,
      epsRevisionPct: 0.08,
      epsRevisionsUp30d: 5,
      epsRevisionsDown30d: 0,
      forwardEpsGrowth: 0.25,
    });
    const down = estimateMomentumScore({
      symbol: "B",
      source: "demo",
      fetchedAt: 0,
      epsRevisionPct: -0.08,
      epsRevisionsUp30d: 0,
      epsRevisionsDown30d: 5,
      forwardEpsGrowth: -0.1,
    });
    expect(up!).toBeGreaterThan(down!);
    expect(estimateMomentumScore({ symbol: "C", source: "demo", fetchedAt: 0 })).toBeNull();
  });

  it("price trend rewards strength near the high and above the 200d", () => {
    const strong = priceTrendScore({
      symbol: "A",
      source: "demo",
      fetchedAt: 0,
      price: 100,
      fiftyTwoWeekHigh: 105,
      fiftyTwoWeekLow: 60,
      twoHundredDayAverage: 90,
      week52Change: 0.3,
    });
    const weak = priceTrendScore({
      symbol: "B",
      source: "demo",
      fetchedAt: 0,
      price: 100,
      fiftyTwoWeekHigh: 200,
      fiftyTwoWeekLow: 95,
      twoHundredDayAverage: 130,
      week52Change: -0.3,
    });
    expect(strong!).toBeGreaterThan(weak!);
  });

  it("risk score punishes leverage and negative cash flow", () => {
    const safe = riskScore({
      symbol: "A",
      source: "demo",
      fetchedAt: 0,
      netDebtToEbitda: 0.2,
      interestCoverage: 12,
      currentRatio: 2,
      freeCashFlow: 1_000_000,
      shortPercentOfFloat: 0.01,
    });
    const risky = riskScore({
      symbol: "B",
      source: "demo",
      fetchedAt: 0,
      netDebtToEbitda: 6,
      interestCoverage: 1,
      currentRatio: 0.7,
      freeCashFlow: -1_000_000,
      shortPercentOfFloat: 0.25,
    });
    expect(safe!).toBeGreaterThan(risky!);
  });

  it("flags near-term earnings and leverage", () => {
    const flags = riskFlags({
      symbol: "A",
      source: "demo",
      fetchedAt: 0,
      nextEarningsDate: Date.now() + 5 * DAY,
      netDebtToEbitda: 6,
      freeCashFlow: -1,
    });
    expect(flags.some((f) => f.startsWith("Earnings in"))).toBe(true);
    expect(flags).toContain("High leverage");
    expect(flags).toContain("Negative FCF");
  });

  it("computes days until an event", () => {
    expect(daysUntil(undefined)).toBeNull();
    expect(daysUntil(Date.now() + 3 * DAY)).toBe(3);
  });
});

describe("composite scoring", () => {
  it("exposes parts and blends them", () => {
    const parts = scoreParts(stock(), 20);
    expect(parts.upside).not.toBeNull();
    expect(compositeScore(parts)).toBe(score(stock(), 20));
  });

  it("new signals move the composite", () => {
    const base = score(stock(), 20);
    const trended = score(
      stock({
        price: 100,
        fiftyTwoWeekHigh: 105,
        twoHundredDayAverage: 90,
        week52Change: 0.3,
      }),
      20,
    );
    expect(trended).not.toBe(base);
  });
});
