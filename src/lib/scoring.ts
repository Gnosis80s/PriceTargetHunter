import type { ScreenerRow, ScoreWeights, StockData, TargetChange } from "./types";
import { DEFAULT_SCORE_WEIGHTS } from "./defaults";

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
const round = (v: number, d = 2) => Math.round(v * 10 ** d) / 10 ** d;

export function upsidePct(target: number | undefined, price: number | undefined): number | null {
  if (!target || !price || price <= 0) return null;
  return ((target - price) / price) * 100;
}

export function riskReward(
  target: number | undefined,
  price: number | undefined,
  low: number | undefined,
): number | null {
  if (!target || !price || !low) return null;
  const downside = price - low;
  if (downside <= 0) return null;
  return (target - price) / downside;
}

/** Target-range width relative to the mean, in %. Lower = tighter analyst agreement. */
export function dispersion(
  high: number | undefined,
  low: number | undefined,
  mean: number | undefined,
): number | null {
  if (!high || !low || !mean || mean <= 0 || high < low) return null;
  return ((high - low) / mean) * 100;
}

function recentChanges(changes: TargetChange[] | undefined, days: number): TargetChange[] {
  if (!changes?.length) return [];
  const cutoff = Date.now() - days * 864e5;
  return changes.filter((c) => c.date >= cutoff);
}

/** Half-life (days) for weighting how much a revision still matters. */
const REVISION_HALF_LIFE_DAYS = 30;

/** Exponential age decay: 1 today, 0.5 after one half-life, etc. */
export function ageWeight(date: number, halfLifeDays = REVISION_HALF_LIFE_DAYS): number {
  const days = Math.max(0, (Date.now() - date) / 864e5);
  return Math.pow(0.5, days / halfLifeDays);
}

/**
 * Best-effort list of large, widely-followed research desks. Their revisions
 * carry more weight in the confidence score (matched case-insensitively by
 * substring, since providers format firm names inconsistently).
 */
const TOP_TIER_FIRMS = [
  "goldman sachs",
  "morgan stanley",
  "jpmorgan",
  "j.p. morgan",
  "jp morgan",
  "bank of america",
  "bofa",
  "merrill",
  "citigroup",
  "citi",
  "barclays",
  "ubs",
  "deutsche bank",
  "wells fargo",
  "rbc",
  "td securities",
  "td cowen",
  "bmo",
  "evercore",
  "piper sandler",
  "raymond james",
  "stifel",
  "jefferies",
  "bernstein",
  "hsbc",
  "nomura",
  "credit suisse",
  "macquarie",
  "mizuho",
  "bnp paribas",
  "societe generale",
  "keefe",
  "baird",
  "cowen",
  "canaccord",
  "needham",
  "wedbush",
  "oppenheimer",
  "william blair",
];

export function isTopTierFirm(firm?: string): boolean {
  if (!firm) return false;
  const f = firm.toLowerCase();
  return TOP_TIER_FIRMS.some((name) => f.includes(name));
}

/**
 * Net bullish/bearish analyst activity within the last `days`.
 *
 * Price-target revisions dominate: a target raise counts proportionally to its
 * size (a 5% raise ≈ +1 point). Grade-only changes fall back to ±1. Every
 * revision is discounted by its age, so a fresh upgrade counts more than a
 * three-month-old one.
 */
export function momentum(changes: StockData["targetChanges"], days = 90): number {
  let net = 0;
  for (const c of recentChanges(changes, days)) {
    const w = ageWeight(c.date);
    if (c.fromTarget && c.toTarget && c.fromTarget > 0) {
      const pct = (c.toTarget - c.fromTarget) / c.fromTarget;
      net += clamp(pct * 20, -3, 3) * w;
      continue;
    }
    const a = (c.action || "").toLowerCase();
    if (a === "up" || a === "init") net += 1 * w;
    else if (a === "down") net -= 1 * w;
  }
  return round(net, 1);
}

/** Age-weighted average % change of price targets (null if none adjusted). */
export function targetMomentumPct(changes: TargetChange[] | undefined, days = 90): number | null {
  const adjusted = recentChanges(changes, days).filter(
    (c) => c.fromTarget && c.toTarget && c.fromTarget > 0,
  );
  if (!adjusted.length) return null;
  let weighted = 0;
  let weights = 0;
  for (const c of adjusted) {
    const w = ageWeight(c.date);
    weighted += ((c.toTarget! - c.fromTarget!) / c.fromTarget!) * 100 * w;
    weights += w;
  }
  return weights > 0 ? round(weighted / weights, 2) : null;
}

/**
 * How recently the consensus was last refreshed by an analyst action.
 * 100 when updated today, ~50 at 45 days, tapering to 0 over ~6 months.
 */
export function freshnessScore(changes: TargetChange[] | undefined): number | null {
  const recent = recentChanges(changes, 180);
  if (!recent.length) return null;
  const latest = Math.max(...recent.map((c) => c.date));
  const days = Math.max(0, (Date.now() - latest) / 864e5);
  return round(clamp(100 * Math.pow(0.5, days / 45)), 1);
}

/**
 * How actively (and by whom) the name is being researched. Combines the
 * recency-weighted volume of revisions with the share coming from top-tier
 * desks, so a couple of fresh notes from major banks beats stale chatter.
 */
export function participationScore(changes: TargetChange[] | undefined): number | null {
  const recent = recentChanges(changes, 90);
  if (!recent.length) return null;
  let weighted = 0;
  let topTier = 0;
  for (const c of recent) {
    const w = ageWeight(c.date);
    weighted += w;
    if (isTopTierFirm(c.firm)) topTier += w;
  }
  if (weighted <= 0) return null;
  const activity = clamp((weighted / 4) * 100); // ~4 fresh revisions ⇒ 100
  const topTierShare = (topTier / weighted) * 100;
  return round(activity * 0.5 + topTierShare * 0.5, 1);
}

export interface ConfidenceParts {
  agreement: number | null;
  coverage: number | null;
  freshness: number | null;
  participation: number | null;
}

/** The four inputs behind the consensus confidence score, for display. */
export function confidenceParts(stock: StockData, disp: number | null): ConfidenceParts {
  return {
    agreement: disp == null ? null : clamp(100 - disp * 0.8),
    coverage: stock.analystCount == null ? null : clamp((stock.analystCount / 20) * 100),
    freshness: freshnessScore(stock.targetChanges),
    participation: participationScore(stock.targetChanges),
  };
}

/**
 * Consensus confidence (0-100): how much the average target can be trusted.
 * Blends agreement (35%), analyst coverage (30%), freshness (20%) and
 * top-tier participation (15%); missing inputs are dropped and renormalised.
 */
export function confidenceScore(stock: StockData, disp: number | null): number | null {
  const parts = confidenceParts(stock, disp);
  const weighted: [number | null, number][] = [
    [parts.agreement, 35],
    [parts.coverage, 30],
    [parts.freshness, 20],
    [parts.participation, 15],
  ];
  let sum = 0;
  let weights = 0;
  for (const [value, weight] of weighted) {
    if (value == null) continue;
    sum += value * weight;
    weights += weight;
  }
  return weights > 0 ? round(sum / weights, 1) : null;
}

/**
 * Composite 0-100 conviction score.
 *
 * Nine components — five target/analyst driven and four fundamentals driven —
 * are each normalised to 0-100, then averaged using relative weights. Components
 * with no data (and zero-weight components) are dropped and the remaining
 * weights renormalised, so a missing metric never silently drags the score down.
 */
export function score(
  stock: StockData,
  disp: number | null,
  weights: ScoreWeights = DEFAULT_SCORE_WEIGHTS,
): number {
  const up = upsidePct(stock.targetMean, stock.price);
  const rec = stock.recommendationMean;

  const components: { value: number | null; weight: number }[] = [
    { value: up == null ? null : clamp((up / 60) * 100), weight: weights.upside },
    { value: rec == null ? null : clamp(((5 - rec) / 4) * 100), weight: weights.consensus },
    { value: clamp(50 + momentum(stock.targetChanges) * 12.5), weight: weights.momentum },
    { value: confidenceScore(stock, disp), weight: weights.confidence },
    { value: valueScore(stock), weight: weights.value },
    { value: qualityScore(stock), weight: weights.quality },
    { value: growthScore(stock), weight: weights.growth },
    { value: healthScore(stock), weight: weights.health },
  ];

  let sum = 0;
  let wsum = 0;
  for (const c of components) {
    if (c.value == null || c.weight <= 0) continue;
    sum += c.value * c.weight;
    wsum += c.weight;
  }
  if (wsum <= 0) return 50;
  return round(sum / wsum, 1);
}

/**
 * Linearly map a metric onto 0-100 between a "worst" and "best" bound. Works
 * for lower-is-better metrics too (pass worst > best). Returns null when the
 * metric is missing so the caller can treat it as "unknown".
 */
export function band(v: number | null | undefined, worst: number, best: number): number | null {
  if (v == null || !Number.isFinite(v)) return null;
  if (worst === best) return 50;
  return clamp(((v - worst) / (best - worst)) * 100);
}

/** Average of the available (non-null) sub-scores, or null when there are none. */
function avg(parts: (number | null)[]): number | null {
  const vals = parts.filter((p): p is number => p != null);
  if (!vals.length) return null;
  return round(vals.reduce((a, b) => a + b, 0) / vals.length, 1);
}

/** Cheaper / higher-yielding stocks score better. */
export function valueScore(s: StockData): number | null {
  const fcfYield =
    s.fcfYield ?? (s.freeCashFlow != null && s.marketCap ? s.freeCashFlow / s.marketCap : undefined);
  return avg([
    band(s.forwardPE ?? s.trailingPE, 40, 8),
    band(s.priceToBook, 8, 1),
    band(s.priceToSales, 10, 1),
    band(s.enterpriseToEbitda, 25, 7),
    band(s.pegRatio, 3, 1),
    band(fcfYield, 0, 0.08),
    s.dividendYield != null && s.dividendYield > 0 ? band(s.dividendYield, 0, 0.06) : null,
  ]);
}

/** Profitability and margins. */
export function qualityScore(s: StockData): number | null {
  return avg([
    band(s.returnOnEquity, 0, 0.25),
    band(s.returnOnAssets, 0, 0.12),
    band(s.grossMargin, 0.1, 0.6),
    band(s.operatingMargin, 0, 0.25),
    band(s.netMargin, 0, 0.2),
  ]);
}

/** Top-line and bottom-line growth. */
export function growthScore(s: StockData): number | null {
  return avg([
    band(s.revenueGrowth, -0.1, 0.3),
    band(s.earningsGrowth, -0.1, 0.3),
    band(s.epsGrowth, -0.05, 0.2),
  ]);
}

/** Balance-sheet strength and cash generation. */
export function healthScore(s: StockData): number | null {
  return avg([
    band(s.debtToEquity, 2, 0.3),
    band(s.currentRatio, 0.8, 2),
    band(s.netDebtToEbitda, 5, 0.5),
    band(s.interestCoverage, 1.5, 10),
    s.freeCashFlow != null ? band(s.freeCashFlow, 0, 1) : null,
  ]);
}

export function toRow(stock: StockData, weights: ScoreWeights = DEFAULT_SCORE_WEIGHTS): ScreenerRow {
  const up = upsidePct(stock.targetMean, stock.price);
  const disp = dispersion(stock.targetHigh, stock.targetLow, stock.targetMean);
  const rr = riskReward(stock.targetMean, stock.price, stock.targetLow);
  return {
    ...stock,
    upsidePct: up == null ? null : round(up, 2),
    riskReward: rr == null ? null : round(rr, 2),
    momentum: momentum(stock.targetChanges),
    dispersion: disp == null ? null : round(disp, 1),
    targetMomentumPct: targetMomentumPct(stock.targetChanges),
    valueScore: valueScore(stock),
    qualityScore: qualityScore(stock),
    growthScore: growthScore(stock),
    healthScore: healthScore(stock),
    confidenceScore: confidenceScore(stock, disp),
    score: score(stock, disp, weights),
  };
}
