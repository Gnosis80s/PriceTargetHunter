import type { AppSettings, Filters, ScoreWeights } from "./types";
import { defaultPresetSymbols } from "../data/presets";

export const DEFAULT_FILTERS: Filters = {
  minUpside: 10,
  minAnalysts: 0,
  maxAnalysts: 200,
  minMarketCapB: 0,
  maxMarketCapB: 1_000_000,
  minPrice: 0,
  maxPrice: 1_000_000,
  sectors: [],
  minRecommendation: 5,
  minRiskReward: 0,
  maxDispersion: 1000,
  onlyRecentUpgrades: false,
  onlyWithTargets: true,
};

/**
 * Target-centric by default, with a meaningful fundamentals block. The four
 * fundamental factors carry 30% combined; raise them for a more value/quality
 * driven screen. Weights are relative and normalised by their sum.
 */
export const DEFAULT_SCORE_WEIGHTS: ScoreWeights = {
  upside: 30,
  consensus: 12,
  momentum: 12,
  coverage: 8,
  agreement: 8,
  value: 10,
  quality: 10,
  growth: 6,
  health: 4,
};

export const DEFAULT_SETTINGS: AppSettings = {
  theme: "dark",
  refreshMinutes: 15,
  autoRefresh: false,
  concurrency: 5,
  yahooEnabled: true,
  fmpApiKey: "",
  finnhubApiKey: "",
  alphaVantageApiKey: "",
  demoFallback: true,
  notifications: false,
  alertMinNewUpside: 30,
  webhookUrl: "",
  universe: defaultPresetSymbols(),
  universePreset: "sp500",
  filters: DEFAULT_FILTERS,
  scoreWeights: DEFAULT_SCORE_WEIGHTS,
};
