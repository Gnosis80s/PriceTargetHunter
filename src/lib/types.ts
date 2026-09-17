export type DataSource = "yahoo" | "fmp" | "finnhub" | "demo";

export interface TargetChange {
  date: number;
  firm: string;
  action: string;
  from?: string;
  to?: string;
  /** Previous price target (if the action adjusted one). */
  fromTarget?: number;
  /** New price target. */
  toTarget?: number;
  /** Yahoo's priceTargetAction: Raises / Lowers / Maintains / Announces / Adjusts. */
  priceTargetAction?: string;
}

/** Canonical, provider-agnostic representation of a stock + its analyst consensus. */
export interface StockData {
  symbol: string;
  name?: string;
  currency?: string;
  price?: number;
  previousClose?: number;
  changePct?: number;
  marketCap?: number;
  volume?: number;
  avgVolume?: number;
  sector?: string;
  industry?: string;

  targetMean?: number;
  targetMedian?: number;
  targetHigh?: number;
  targetLow?: number;
  analystCount?: number;

  /** 1 = strong buy, 5 = strong sell (Yahoo / Finnhub convention). */
  recommendationMean?: number;
  recommendationKey?: string;
  strongBuy?: number;
  buy?: number;
  hold?: number;
  sell?: number;
  strongSell?: number;

  trailingPE?: number;
  forwardPE?: number;
  eps?: number;
  earningsGrowth?: number;
  revenueGrowth?: number;

  // --- Valuation (value factor) ---
  priceToBook?: number;
  priceToSales?: number;
  enterpriseToEbitda?: number;
  pegRatio?: number;
  /** Fraction, e.g. 0.025 = 2.5%. */
  dividendYield?: number;
  /** Fraction of free cash flow vs market cap. */
  fcfYield?: number;

  // --- Profitability (quality factor), all fractions ---
  returnOnEquity?: number;
  returnOnAssets?: number;
  grossMargin?: number;
  operatingMargin?: number;
  netMargin?: number;
  freeCashFlow?: number;
  operatingCashFlow?: number;

  // --- Balance sheet (health factor) ---
  /** Net debt / equity as a ratio, e.g. 0.5 = 50% (providers are normalised). */
  debtToEquity?: number;
  currentRatio?: number;
  netDebtToEbitda?: number;
  interestCoverage?: number;

  /** Longer-horizon EPS growth (fraction) used in the growth factor. */
  epsGrowth?: number;

  // --- Forward estimates (revision momentum) ---
  /** Consensus forward EPS estimate for the current/next fiscal year. */
  forwardEps?: number;
  /** The same forward EPS estimate as of ~90 days ago (point-in-time). */
  forwardEps90dAgo?: number;
  /** Fractional change in the forward EPS estimate over ~90 days. */
  epsRevisionPct?: number;
  /** Upward EPS-estimate revisions in the last 30 days. */
  epsRevisionsUp30d?: number;
  /** Downward EPS-estimate revisions in the last 30 days. */
  epsRevisionsDown30d?: number;
  /** Expected EPS growth for the forward year (fraction). */
  forwardEpsGrowth?: number;

  // --- Price trend ---
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  twoHundredDayAverage?: number;
  fiftyDayAverage?: number;
  /** Fractional price change over the last 52 weeks. */
  week52Change?: number;

  // --- Event risk / distress ---
  /** Epoch ms of the next expected earnings report. */
  nextEarningsDate?: number;
  /** Shares short as a fraction of float (e.g. 0.08 = 8%). */
  shortPercentOfFloat?: number;
  /** Days-to-cover ratio (shares short / average daily volume). */
  shortRatio?: number;

  targetChanges?: TargetChange[];
  source: DataSource;
  fetchedAt: number;
  /** True when this row was served from the offline cache. */
  stale?: boolean;
}

export interface ScreenerRow extends StockData {
  upsidePct: number | null;
  riskReward: number | null;
  momentum: number;
  /** Target-range width relative to the mean (uncertainty; lower = tighter agreement), in %. */
  dispersion: number | null;
  /** Average % change of analyst price targets over the momentum window. */
  targetMomentumPct: number | null;
  /** Fundamentals factor scores (0-100); null when the provider gave no inputs. */
  valueScore: number | null;
  qualityScore: number | null;
  growthScore: number | null;
  healthScore: number | null;
  /** How trustworthy the analyst consensus is (agreement, coverage, freshness, tier-1). */
  confidenceScore: number | null;
  /** Forward EPS-estimate revision momentum (0-100); null when unavailable. */
  estimateMomentumScore: number | null;
  /** Price-trend confirmation (distance from 52w high, vs 200d MA, 52w change). */
  priceTrendScore: number | null;
  /** Value-trap / event-risk safety score (0-100, higher = safer). */
  riskScore: number | null;
  /** Human-readable risk flags (near earnings, high leverage, …). */
  riskFlags: string[];
  /** Days until the next expected earnings report (negative = past, null = unknown). */
  earningsInDays: number | null;
  /** Distance from the 52-week high as a fraction (e.g. -0.2 = 20% below). */
  pctFrom52wHigh: number | null;
  /** Price versus the 200-day moving average as a fraction. */
  pctVs200d: number | null;
  /** True when factor scores were ranked within sector (vs. absolute bands). */
  rankedBySector: boolean;
  score: number;
}

/** One point in the track-record series: a stock logged when it entered the screen. */
export interface TrackedPick {
  id: string;
  symbol: string;
  name?: string;
  sector?: string;
  addedAt: number;
  entryPrice: number;
  entryUpsidePct: number | null;
  entryScore: number;
  /** Benchmark (e.g. SPY) price when the pick was logged. */
  entryBenchmark: number | null;
  /** Latest observed price and when it was seen. */
  lastPrice: number | null;
  lastAt: number | null;
  /** Price return since entry, in %. */
  returnPct: number | null;
  /** Benchmark return over the same window, in %. */
  benchmarkReturnPct: number | null;
  /** returnPct − benchmarkReturnPct. */
  excessPct: number | null;
}

/**
 * Weights for the composite conviction score. Values are relative and are
 * normalised by their sum, so they do not need to add up to 100.
 */
export interface ScoreWeights {
  upside: number;
  consensus: number;
  momentum: number;
  confidence: number;
  value: number;
  quality: number;
  growth: number;
  health: number;
  /** Forward estimate-revision momentum (independent of price-target revisions). */
  estimate: number;
  /** Price-trend confirmation (avoids catching a falling knife). */
  trend: number;
  /** Value-trap / event-risk avoidance. */
  risk: number;
}

export interface Filters {
  minUpside: number;
  minAnalysts: number;
  maxAnalysts: number;
  minMarketCapB: number;
  maxMarketCapB: number;
  minPrice: number;
  maxPrice: number;
  sectors: string[];
  minRecommendation: number; // 1..5 (lower = more bullish), include stocks <= this
  minRiskReward: number;
  /** Skip names whose target range is wider than this (% of mean). 1000 = no limit. */
  maxDispersion: number;
  /** Exclude names whose newest analyst action is older than this many days. 0 = no limit. */
  maxTargetAgeDays: number;
  /** Minimum price-trend score (0-100). 0 = no limit. */
  minPriceTrend: number;
  /** Exclude names reporting earnings within this many days. 0 = no limit. */
  excludeEarningsWithinDays: number;
  /** Minimum value-trap / event-risk safety score (0-100). 0 = no limit. */
  minRiskScore: number;
  onlyRecentUpgrades: boolean;
  onlyWithTargets: boolean;
}

export interface AppSettings {
  theme: "dark" | "light";
  refreshMinutes: number;
  autoRefresh: boolean;
  concurrency: number;
  yahooEnabled: boolean;
  fmpApiKey: string;
  finnhubApiKey: string;
  /** Optional. Enables per-article news sentiment (Alpha Vantage NEWS_SENTIMENT). */
  alphaVantageApiKey: string;
  demoFallback: boolean;
  notifications: boolean;
  alertMinNewUpside: number;
  webhookUrl: string;
  universe: string[];
  /** id of the selected preset (see data/presets.ts); "custom" when hand-edited. */
  universePreset: string;
  /** Rank fundamental/signal factors as percentiles within each sector. */
  sectorRelative: boolean;
  /** Log screen picks and evaluate their forward return versus a benchmark. */
  trackEnabled: boolean;
  /** How many top-scoring names to log per scan. */
  trackTopN: number;
  /** Don't re-log a symbol within this many days of its last pick. */
  trackCooldownDays: number;
  /** Benchmark symbol used to measure excess return (e.g. SPY). */
  benchmarkSymbol: string;
  filters: Filters;
  /** Relative weights for each component of the composite score. */
  scoreWeights: ScoreWeights;
}

export interface WatchlistItem {
  symbol: string;
  addedAt: number;
  note?: string;
  /** upsidePct at the moment it was added, for change alerts. */
  entryUpsidePct: number | null;
}

export interface TargetSnapshot {
  symbol: string;
  date: number;
  targetMean?: number;
  price?: number;
  analystCount?: number;
}
