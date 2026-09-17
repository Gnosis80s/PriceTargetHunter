import type { ScreenerRow, ScoreWeights, StockData } from "./types";
import { compositeScore, daysUntil, scoreParts, type ScoreParts } from "./scoring";

/**
 * Cross-sectional ranking. Absolute factor bands (P/E < 15 is "cheap") are
 * regime- and sector-blind: a utility at 15x and a software name at 40x are not
 * comparable. This pass converts each factor metric into a percentile rank
 * *within its sector*, so the composite measures "cheap for its sector" rather
 * than "cheap versus the whole market". Sectors with too few names fall back to
 * the whole scanned universe.
 */

interface Metric {
  get: (s: StockData) => number | null | undefined;
  higherIsBetter: boolean;
}

const VALUE_METRICS: Metric[] = [
  { get: (s) => s.forwardPE ?? s.trailingPE, higherIsBetter: false },
  { get: (s) => s.priceToBook, higherIsBetter: false },
  { get: (s) => s.priceToSales, higherIsBetter: false },
  { get: (s) => s.enterpriseToEbitda, higherIsBetter: false },
  { get: (s) => s.pegRatio, higherIsBetter: false },
  {
    get: (s) =>
      s.fcfYield ?? (s.freeCashFlow != null && s.marketCap ? s.freeCashFlow / s.marketCap : undefined),
    higherIsBetter: true,
  },
  { get: (s) => s.dividendYield, higherIsBetter: true },
];

const QUALITY_METRICS: Metric[] = [
  { get: (s) => s.returnOnEquity, higherIsBetter: true },
  { get: (s) => s.returnOnAssets, higherIsBetter: true },
  { get: (s) => s.grossMargin, higherIsBetter: true },
  { get: (s) => s.operatingMargin, higherIsBetter: true },
  { get: (s) => s.netMargin, higherIsBetter: true },
];

const GROWTH_METRICS: Metric[] = [
  { get: (s) => s.revenueGrowth, higherIsBetter: true },
  { get: (s) => s.earningsGrowth, higherIsBetter: true },
  { get: (s) => s.epsGrowth, higherIsBetter: true },
  { get: (s) => s.forwardEpsGrowth, higherIsBetter: true },
];

const HEALTH_METRICS: Metric[] = [
  { get: (s) => s.debtToEquity, higherIsBetter: false },
  { get: (s) => s.currentRatio, higherIsBetter: true },
  { get: (s) => s.netDebtToEbitda, higherIsBetter: false },
  { get: (s) => s.interestCoverage, higherIsBetter: true },
  { get: (s) => s.freeCashFlow, higherIsBetter: true },
];

const ESTIMATE_METRICS: Metric[] = [
  { get: (s) => s.epsRevisionPct, higherIsBetter: true },
  {
    get: (s) =>
      s.epsRevisionsUp30d == null && s.epsRevisionsDown30d == null
        ? undefined
        : (s.epsRevisionsUp30d ?? 0) - (s.epsRevisionsDown30d ?? 0),
    higherIsBetter: true,
  },
  { get: (s) => s.forwardEpsGrowth, higherIsBetter: true },
];

const TREND_METRICS: Metric[] = [
  { get: (s) => (s.fiftyTwoWeekHigh && s.price ? s.price / s.fiftyTwoWeekHigh : undefined), higherIsBetter: true },
  {
    get: (s) => (s.twoHundredDayAverage && s.price ? s.price / s.twoHundredDayAverage : undefined),
    higherIsBetter: true,
  },
  { get: (s) => s.week52Change, higherIsBetter: true },
];

const RISK_METRICS: Metric[] = [
  { get: (s) => s.netDebtToEbitda, higherIsBetter: false },
  { get: (s) => s.interestCoverage, higherIsBetter: true },
  { get: (s) => s.currentRatio, higherIsBetter: true },
  { get: (s) => s.freeCashFlow, higherIsBetter: true },
  { get: (s) => s.shortPercentOfFloat, higherIsBetter: false },
];

interface Sampled {
  values: number[];
}

/** Pre-extract non-null values for a metric across the population. */
function sample(population: ScreenerRow[], metric: Metric): Sampled {
  const values: number[] = [];
  for (const s of population) {
    const v = metric.get(s);
    if (v != null && Number.isFinite(v)) values.push(v);
  }
  return { values };
}

/** Percentile of `v` in `values` (0-100), flipped for lower-is-better metrics. */
function percentile(values: number[], v: number, higherIsBetter: boolean): number {
  if (values.length <= 1) return 50;
  let below = 0;
  let equal = 0;
  for (const x of values) {
    if (x < v) below++;
    else if (x === v) equal++;
  }
  const pct = ((below + equal / 2) / values.length) * 100;
  return higherIsBetter ? pct : 100 - pct;
}

/** Average sector-relative percentile across a metric group, or null. */
function rankedFactor(population: ScreenerRow[], stock: ScreenerRow, metrics: Metric[]): number | null {
  let sum = 0;
  let n = 0;
  for (const metric of metrics) {
    const v = metric.get(stock);
    if (v == null || !Number.isFinite(v)) continue;
    const { values } = sample(population, metric);
    if (values.length < 2) continue;
    sum += percentile(values, v, metric.higherIsBetter);
    n++;
  }
  return n ? Math.round((sum / n) * 10) / 10 : null;
}

const MIN_SECTOR_SIZE = 5;

/**
 * Recompute factor scores as within-sector percentiles and re-derive the
 * composite score. Rows whose sector is unknown or too small are ranked against
 * the whole universe. Rows are returned as new objects; input is untouched.
 */
export function rankRowsBySector(rows: ScreenerRow[], weights: ScoreWeights): ScreenerRow[] {
  const out = rows.map((r) => ({ ...r }));
  if (out.length < 2) return out;

  const groups = new Map<string, ScreenerRow[]>();
  for (const r of out) {
    const key = r.sector && r.sector.trim() ? r.sector : "Unknown";
    const list = groups.get(key);
    if (list) list.push(r);
    else groups.set(key, [r]);
  }

  for (const group of groups.values()) {
    const useSector = group.length >= MIN_SECTOR_SIZE;
    const population = useSector ? group : out;

    for (const row of group) {
      const parts: ScoreParts = scoreParts(row, row.dispersion);
      const value = rankedFactor(population, row, VALUE_METRICS);
      const quality = rankedFactor(population, row, QUALITY_METRICS);
      const growth = rankedFactor(population, row, GROWTH_METRICS);
      const health = rankedFactor(population, row, HEALTH_METRICS);
      const estimate = rankedFactor(population, row, ESTIMATE_METRICS);
      const trend = rankedFactor(population, row, TREND_METRICS);
      let risk = rankedFactor(population, row, RISK_METRICS);
      if (risk != null) {
        const d = daysUntil(row.nextEarningsDate);
        if (d != null && d >= 0 && d <= 14) risk = Math.max(0, risk - 25);
      }

      row.valueScore = value ?? parts.value;
      row.qualityScore = quality ?? parts.quality;
      row.growthScore = growth ?? parts.growth;
      row.healthScore = health ?? parts.health;
      row.estimateMomentumScore = estimate ?? parts.estimate;
      row.priceTrendScore = trend ?? parts.trend;
      row.riskScore = risk ?? parts.risk;
      row.rankedBySector = useSector;

      parts.value = row.valueScore;
      parts.quality = row.qualityScore;
      parts.growth = row.growthScore;
      parts.health = row.healthScore;
      parts.estimate = row.estimateMomentumScore;
      parts.trend = row.priceTrendScore;
      parts.risk = row.riskScore;
      row.score = compositeScore(parts, weights);
    }
  }

  return out;
}

export { MIN_SECTOR_SIZE };
