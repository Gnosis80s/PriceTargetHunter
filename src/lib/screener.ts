import type { Filters, ScreenerRow } from "./types";

export type SortKey =
  | "score"
  | "upsidePct"
  | "riskReward"
  | "dispersion"
  | "targetMomentumPct"
  | "analystCount"
  | "marketCap"
  | "momentum"
  | "price"
  | "valueScore"
  | "qualityScore"
  | "growthScore"
  | "healthScore"
  | "symbol";

export function applyFilters(rows: ScreenerRow[], f: Filters): ScreenerRow[] {
  return rows.filter((r) => {
    if (f.onlyWithTargets && r.upsidePct == null) return false;
    if (r.upsidePct != null && r.upsidePct < f.minUpside) return false;

    const analysts = r.analystCount ?? 0;
    if (analysts < f.minAnalysts || analysts > f.maxAnalysts) return false;

    const capB = (r.marketCap ?? 0) / 1e9;
    if (capB < f.minMarketCapB || capB > f.maxMarketCapB) return false;

    const price = r.price ?? 0;
    if (price < f.minPrice || price > f.maxPrice) return false;

    if (f.sectors.length && (!r.sector || !f.sectors.includes(r.sector))) return false;

    if (f.minRecommendation < 5 && r.recommendationMean != null && r.recommendationMean > f.minRecommendation) {
      return false;
    }

    if (f.minRiskReward > 0 && (r.riskReward ?? 0) < f.minRiskReward) return false;

    if (f.maxDispersion < 1000 && r.dispersion != null && r.dispersion > f.maxDispersion) return false;

    if (f.onlyRecentUpgrades && r.momentum <= 0) return false;

    return true;
  });
}

export function sortRows(rows: ScreenerRow[], key: SortKey, dir: "asc" | "desc"): ScreenerRow[] {
  const sign = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    if (key === "symbol") return sign * a.symbol.localeCompare(b.symbol);
    const av = (a[key] as number | null) ?? -Infinity;
    const bv = (b[key] as number | null) ?? -Infinity;
    return sign * (av - bv);
  });
}
