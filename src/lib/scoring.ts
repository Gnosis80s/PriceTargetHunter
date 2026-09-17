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

/**
 * The consensus target we rank on. The median is preferred because a single
 * wild high/low target can move the mean substantially; the mean is the
 * fallback when no median is published.
 */
export function consensusTarget(stock: StockData): number | undefined {
  return stock.targetMedian ?? stock.targetMean;
}

/** Days since the most recent analyst action, or null when none are known. */
export function targetAgeDays(changes: TargetChange[] | undefined): number | null {
  if (!changes?.length) return null;
  const latest = Math.max(...changes.map((c) => c.date));
  if (!latest) return null;
  return Math.max(0, (Date.now() - latest) / 864e5);
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

/**
 * Freshness applied when a stock has a target but none of the analyst actions
 * are recent enough to prove the consensus is current. An old/undated target is
 * a liability, not a neutral unknown, so it is penalised rather than dropped.
 */
export const UNKNOWN_FRESHNESS = 15;

/** The four inputs behind the consensus confidence score, for display. */
export function confidenceParts(stock: StockData, disp: number | null): ConfidenceParts {
  const hasTarget = stock.targetMean != null || stock.targetMedian != null;
  return {
    agreement: disp == null ? null : clamp(100 - disp * 0.8),
    coverage: stock.analystCount == null ? null : clamp((stock.analystCount / 20) * 100),
    freshness: freshnessScore(stock.targetChanges) ?? (hasTarget ? UNKNOWN_FRESHNESS : null),
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

/** All component values that feed the composite score, each normalised 0-100. */
export interface ScoreParts {
  upside: number | null;
  consensus: number | null;
  momentum: number | null;
  confidence: number | null;
  value: number | null;
  quality: number | null;
  growth: number | null;
  health: number | null;
  estimate: number | null;
  trend: number | null;
  risk: number | null;
}

/** Analyst upside normalised to 0-100 (a 60% upside saturates the scale). */
export function upsideScore(stock: StockData): number | null {
  const up = upsidePct(consensusTarget(stock), stock.price);
  return up == null ? null : clamp((up / 60) * 100);
}

/** Recommendation mean (1 = strong buy) normalised to 0-100. */
export function consensusScore(stock: StockData): number | null {
  return stock.recommendationMean == null ? null : clamp(((5 - stock.recommendationMean) / 4) * 100);
}

/** Price-target revision momentum centred on 50 (± net revision points). */
export function momentumScore(stock: StockData): number {
  return clamp(50 + momentum(stock.targetChanges) * 12.5);
}

/**
 * Compute every component of the composite score for a stock. Kept separate so
 * the cross-sectional ranking pass can override the factor values (e.g. with
 * sector-relative percentiles) and recompute the composite without re-deriving
 * the target-centric parts.
 */
export function scoreParts(stock: StockData, disp: number | null): ScoreParts {
  return {
    upside: upsideScore(stock),
    consensus: consensusScore(stock),
    momentum: momentumScore(stock),
    confidence: confidenceScore(stock, disp),
    value: valueScore(stock),
    quality: qualityScore(stock),
    growth: growthScore(stock),
    health: healthScore(stock),
    estimate: estimateMomentumScore(stock),
    trend: priceTrendScore(stock),
    risk: riskScore(stock),
  };
}

/**
 * Weighted average of the component scores. Components with no data (and
 * zero-weight components) are dropped and the remaining weights renormalised, so
 * a missing metric never silently drags the score down.
 */
export function compositeScore(parts: ScoreParts, weights: ScoreWeights = DEFAULT_SCORE_WEIGHTS): number {
  const components: [number | null, number][] = [
    [parts.upside, weights.upside],
    [parts.consensus, weights.consensus],
    [parts.momentum, weights.momentum],
    [parts.confidence, weights.confidence],
    [parts.value, weights.value],
    [parts.quality, weights.quality],
    [parts.growth, weights.growth],
    [parts.health, weights.health],
    [parts.estimate, weights.estimate],
    [parts.trend, weights.trend],
    [parts.risk, weights.risk],
  ];

  let sum = 0;
  let wsum = 0;
  for (const [value, weight] of components) {
    if (value == null || weight <= 0) continue;
    sum += value * weight;
    wsum += weight;
  }
  if (wsum <= 0) return 50;
  return round(sum / wsum, 1);
}

/**
 * Composite 0-100 conviction score — eleven components blended by relative
 * weight. It ranks ideas to investigate; it is not a buy signal.
 */
export function score(
  stock: StockData,
  disp: number | null,
  weights: ScoreWeights = DEFAULT_SCORE_WEIGHTS,
): number {
  return compositeScore(scoreParts(stock, disp), weights);
}

/** Whole days until a timestamp (negative once it is in the past), or null. */
export function daysUntil(ts: number | undefined): number | null {
  if (!ts) return null;
  return Math.ceil((ts - Date.now()) / 864e5);
}

/**
 * Forward EPS-estimate revision momentum (0-100). Estimate revisions are the
 * analyst signal with the strongest empirical track record, so this is kept
 * independent of the price-target revision momentum.
 */
export function estimateMomentumScore(s: StockData): number | null {
  const revision = band(s.epsRevisionPct, -0.1, 0.1);
  const breadth =
    s.epsRevisionsUp30d == null && s.epsRevisionsDown30d == null
      ? null
      : clamp(50 + ((s.epsRevisionsUp30d ?? 0) - (s.epsRevisionsDown30d ?? 0)) * 12.5);
  const forward = band(s.forwardEpsGrowth, -0.1, 0.3);
  return avg([revision, breadth, forward]);
}

/** Fraction of the 52-week range the price sits at (0 = low, 1 = high). */
export function week52Position(s: StockData): number | null {
  if (s.fiftyTwoWeekHigh == null || s.fiftyTwoWeekLow == null || s.price == null) return null;
  const range = s.fiftyTwoWeekHigh - s.fiftyTwoWeekLow;
  if (range <= 0) return null;
  return clamp((s.price - s.fiftyTwoWeekLow) / range);
}

/**
 * Price-trend confirmation (0-100). Stocks in an uptrend are less likely to be
 * "cheap for a reason"; a high upside with a collapsing price is a falling
 * knife. Combines distance from the 52-week high, price vs the 200-day average
 * and the trailing 52-week return.
 */
export function priceTrendScore(s: StockData): number | null {
  const pos = week52Position(s);
  const fromHigh = s.fiftyTwoWeekHigh && s.price ? s.price / s.fiftyTwoWeekHigh : undefined;
  const vs200 = s.twoHundredDayAverage && s.price ? s.price / s.twoHundredDayAverage : undefined;
  return avg([
    fromHigh == null || fromHigh <= 0 ? null : band(fromHigh, 0.4, 1),
    vs200 == null || vs200 <= 0 ? null : band(vs200, 0.8, 1.2),
    s.week52Change == null ? null : band(s.week52Change, -0.4, 0.4),
    pos == null ? null : pos * 100,
  ]);
}

/** Balance-sheet / liquidity / crowding caveats worth surfacing to the user. */
export function riskFlags(s: StockData): string[] {
  const flags: string[] = [];
  const d = daysUntil(s.nextEarningsDate);
  if (d != null && d >= 0 && d <= 14) flags.push(`Earnings in ${d}d`);
  if (s.netDebtToEbitda != null && s.netDebtToEbitda > 4) flags.push("High leverage");
  if (s.interestCoverage != null && s.interestCoverage < 2) flags.push("Thin interest cover");
  if (s.freeCashFlow != null && s.freeCashFlow < 0) flags.push("Negative FCF");
  if (s.currentRatio != null && s.currentRatio < 1) flags.push("Current ratio < 1");
  if (s.shortPercentOfFloat != null && s.shortPercentOfFloat > 0.15) flags.push("Heavily shorted");
  return flags;
}

/**
 * Value-trap / event-risk safety score (0-100, higher = safer). Complements the
 * quality and health factors by folding balance-sheet resilience, cash burn,
 * short crowding and near-term earnings event risk into one signal.
 */
export function riskScore(s: StockData): number | null {
  const base = avg([
    s.netDebtToEbitda == null ? null : band(s.netDebtToEbitda, 5, 0),
    s.interestCoverage == null ? null : band(s.interestCoverage, 1.5, 10),
    s.currentRatio == null ? null : band(s.currentRatio, 0.8, 2),
    s.freeCashFlow == null ? null : s.freeCashFlow > 0 ? 100 : 0,
    s.shortPercentOfFloat == null ? null : band(s.shortPercentOfFloat, 0.2, 0),
  ]);
  if (base == null) return null;
  const d = daysUntil(s.nextEarningsDate);
  const eventPenalty = d != null && d >= 0 && d <= 14 ? 25 : 0;
  return round(clamp(base - eventPenalty), 1);
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
    // Positive free cash flow is the signal; a dollar-value band is meaningless.
    s.freeCashFlow == null ? null : s.freeCashFlow > 0 ? 100 : 0,
  ]);
}

export function toRow(stock: StockData, weights: ScoreWeights = DEFAULT_SCORE_WEIGHTS): ScreenerRow {
  const target = consensusTarget(stock);
  const up = upsidePct(target, stock.price);
  const disp = dispersion(stock.targetHigh, stock.targetLow, target);
  const rr = riskReward(target, stock.price, stock.targetLow);
  const parts = scoreParts(stock, disp);
  const fromHigh = stock.fiftyTwoWeekHigh && stock.price ? stock.price / stock.fiftyTwoWeekHigh - 1 : null;
  const vs200 = stock.twoHundredDayAverage && stock.price ? stock.price / stock.twoHundredDayAverage - 1 : null;
  return {
    ...stock,
    upsidePct: up == null ? null : round(up, 2),
    riskReward: rr == null ? null : round(rr, 2),
    momentum: momentum(stock.targetChanges),
    dispersion: disp == null ? null : round(disp, 1),
    targetMomentumPct: targetMomentumPct(stock.targetChanges),
    valueScore: parts.value,
    qualityScore: parts.quality,
    growthScore: parts.growth,
    healthScore: parts.health,
    confidenceScore: parts.confidence,
    estimateMomentumScore: parts.estimate,
    priceTrendScore: parts.trend,
    riskScore: parts.risk,
    riskFlags: riskFlags(stock),
    earningsInDays: daysUntil(stock.nextEarningsDate),
    pctFrom52wHigh: fromHigh == null ? null : round(fromHigh, 4),
    pctVs200d: vs200 == null ? null : round(vs200, 4),
    rankedBySector: false,
    score: compositeScore(parts, weights),
  };
}
