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
  score: number;
}

/**
 * Weights for the composite conviction score. Values are relative and are
 * normalised by their sum, so they do not need to add up to 100.
 */
export interface ScoreWeights {
  upside: number;
  consensus: number;
  momentum: number;
  coverage: number;
  agreement: number;
  value: number;
  quality: number;
  growth: number;
  health: number;
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
