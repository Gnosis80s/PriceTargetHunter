import type { AppSettings, Filters, ScoreWeights } from "./types";
import { defaultPresetSymbols } from "../data/presets";

export const DEFAULT_FILTERS: Filters = {
  minUpside: 10,
  // A consensus needs more than one voice to mean anything.
  minAnalysts: 3,
  maxAnalysts: 200,
  minMarketCapB: 0,
  maxMarketCapB: 1_000_000,
  minPrice: 0,
  maxPrice: 1_000_000,
  sectors: [],
  minRecommendation: 5,
  minRiskReward: 0,
  maxDispersion: 1000,
  maxTargetAgeDays: 0,
  minPriceTrend: 0,
  excludeEarningsWithinDays: 0,
  minRiskScore: 0,
  onlyRecentUpgrades: false,
  onlyWithTargets: true,
};

/**
 * Balanced across three signal families that carry the most predictive weight:
 * the analyst view (upside / consensus / confidence), revision momentum
 * (price-target + forward EPS estimates), and confirmation (price trend, quality,
 * risk). The static target *level* keeps the largest single weight but is no
 * longer dominant; forward estimate revisions and price trend are new and carry
 * meaningful weight because they are the more robust signals. Weights are
 * relative and normalised by their sum.
 */
export const DEFAULT_SCORE_WEIGHTS: ScoreWeights = {
  upside: 20,
  consensus: 8,
  momentum: 10,
  confidence: 12,
  estimate: 12,
  trend: 12,
  risk: 6,
  value: 6,
  quality: 6,
  growth: 5,
  health: 3,
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
  sectorRelative: true,
  trackEnabled: true,
  trackTopN: 10,
  trackCooldownDays: 30,
  benchmarkSymbol: "SPY",
  filters: DEFAULT_FILTERS,
  scoreWeights: DEFAULT_SCORE_WEIGHTS,
};
