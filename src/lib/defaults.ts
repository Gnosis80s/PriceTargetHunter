import type { AppSettings, Filters } from "./types";
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
  onlyRecentUpgrades: false,
  onlyWithTargets: true,
};

export const DEFAULT_SETTINGS: AppSettings = {
  theme: "dark",
  refreshMinutes: 15,
  autoRefresh: false,
  concurrency: 5,
  yahooEnabled: true,
  fmpApiKey: "",
  finnhubApiKey: "",
  demoFallback: true,
  notifications: false,
  alertMinNewUpside: 30,
  webhookUrl: "",
  universe: defaultPresetSymbols(),
  universePreset: "sp500",
  filters: DEFAULT_FILTERS,
};
