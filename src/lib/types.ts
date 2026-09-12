export type DataSource = "yahoo" | "fmp" | "finnhub" | "demo";

export interface TargetChange {
  date: number;
  firm: string;
  action: string;
  from?: string;
  to?: string;
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
  score: number;
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
  demoFallback: boolean;
  notifications: boolean;
  alertMinNewUpside: number;
  webhookUrl: string;
  universe: string[];
  /** id of the selected preset (see data/presets.ts); "custom" when hand-edited. */
  universePreset: string;
  filters: Filters;
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
