import type { StockData, TargetChange } from "../lib/types";

/* eslint-disable @typescript-eslint/no-explicit-any */
const BASE = "https://finnhub.io/api/v1";

function num(v: unknown): number | undefined {
  const n = typeof v === "string" ? Number(v) : (v as number);
  return typeof n === "number" && Number.isFinite(n) && n !== 0 ? n : undefined;
}

/** Finnhub reports most ratios as percentages (e.g. 15.2 = 15.2%). */
function pct(v: unknown): number | undefined {
  const n = num(v);
  return n == null ? undefined : n / 100;
}

async function get(path: string, apiKey: string): Promise<any> {
  const res = await fetch(`${BASE}${path}${path.includes("?") ? "&" : "?"}token=${encodeURIComponent(apiKey)}`);
  if (!res.ok) throw new Error(`finnhub ${res.status}`);
  return res.json();
}

export async function fetchFinnhub(symbol: string, apiKey: string): Promise<StockData> {
  if (!apiKey) throw new Error("finnhub: missing api key");
  const s = encodeURIComponent(symbol);

  const [quote, target, recs, profile, upgrades, metrics] = await Promise.all([
    get(`/quote?symbol=${s}`, apiKey).catch(() => ({})),
    get(`/stock/price-target?symbol=${s}`, apiKey).catch(() => ({})),
    get(`/stock/recommendation?symbol=${s}`, apiKey).catch(() => []),
    get(`/stock/profile2?symbol=${s}`, apiKey).catch(() => ({})),
    get(`/stock/upgrade-downgrade?symbol=${s}`, apiKey).catch(() => []),
    get(`/stock/metric?symbol=${s}&metric=all`, apiKey).catch(() => ({})),
  ]);

  const rec = Array.isArray(recs) && recs.length ? recs[0] : {};
  const counts = [num(rec.strongBuy) ?? 0, num(rec.buy) ?? 0, num(rec.hold) ?? 0, num(rec.sell) ?? 0, num(rec.strongSell) ?? 0];
  const countSum = counts.reduce((a, b) => a + b, 0);
  const recMean =
    countSum > 0 ? (counts[0] * 1 + counts[1] * 2 + counts[2] * 3 + counts[3] * 4 + counts[4] * 5) / countSum : undefined;

  const changes: TargetChange[] = (Array.isArray(upgrades) ? upgrades : [])
    .map((h: any) => ({
      date: Date.parse(String(h.gradeTime ?? h.date ?? "")) || 0,
      firm: String(h.company ?? h.gradingCompany ?? "Unknown"),
      action: String(h.action ?? "main").toLowerCase(),
      from: h.fromGrade != null ? String(h.fromGrade) : undefined,
      to: h.toGrade != null ? String(h.toGrade) : undefined,
    }))
    .filter((c) => c.date > 0)
    .sort((a, b) => b.date - a.date)
    .slice(0, 60);

  const m = metrics?.metric ?? {};
  const netDebt = num(m.netDebt);
  const ebitdaTtm = num(m.ebitdaTTM);
  return {
    symbol,
    name: profile?.name ?? undefined,
    currency: profile?.currency ?? "USD",
    price: num(quote?.c),
    previousClose: num(quote?.pc),
    changePct: num(quote?.dp),
    marketCap: profile?.marketCapitalization ? profile.marketCapitalization * 1e6 : num(m.marketCapitalization),
    sector: profile?.finnhubIndustry ?? undefined,
    industry: profile?.finnhubIndustry ?? undefined,
    targetMean: num(target?.targetMean) ?? num(target?.targetMedian),
    targetMedian: num(target?.targetMedian),
    targetHigh: num(target?.targetHigh),
    targetLow: num(target?.targetLow),
    analystCount: countSum || undefined,
    recommendationMean: recMean,
    strongBuy: counts[0],
    buy: counts[1],
    hold: counts[2],
    sell: counts[3],
    strongSell: counts[4],
    trailingPE: num(m.peTTM) ?? num(m.peBasicExclExtraTTM),
    forwardPE: num(m.forwardPE),
    eps: num(m.epsTTM) ?? num(m.epsBasicExclExtraItemsTTM),
    earningsGrowth: num(m.epsGrowthTTMYoy) != null ? num(m.epsGrowthTTMYoy)! / 100 : undefined,
    revenueGrowth: num(m.revenueGrowthTTMYoy) != null ? num(m.revenueGrowthTTMYoy)! / 100 : undefined,

    priceToBook: num(m.pb) ?? num(m.pbQuarterly),
    priceToSales: num(m.psTTM) ?? num(m.psAnnual),
    enterpriseToEbitda: num(m.evEbitdaTTM),
    pegRatio: num(m.pegTTM) ?? num(m.pegAnnual),
    dividendYield: pct(m.dividendYieldIndicatedAnnual),
    returnOnEquity: pct(m.roeTTM),
    returnOnAssets: pct(m.roaTTM),
    grossMargin: pct(m.grossMarginTTM),
    operatingMargin: pct(m.operatingMarginTTM),
    netMargin: pct(m.netProfitMarginTTM),
    freeCashFlow: num(m.freeCashFlowTTM) ?? num(m.freeCashFlowAnnual),
    debtToEquity: pct(m["totalDebt/totalEquityQuarterly"] ?? m["totalDebt/totalEquityAnnual"]),
    currentRatio: num(m.currentRatioQuarterly) ?? num(m.currentRatioAnnual),
    netDebtToEbitda: netDebt != null && ebitdaTtm != null && ebitdaTtm > 0 ? netDebt / ebitdaTtm : undefined,
    interestCoverage: num(m.netInterestCoverageTTM) ?? num(m.interestCoverageTTM),
    epsGrowth: pct(m.epsGrowth5Y) ?? pct(m.epsGrowth3Y),

    targetChanges: changes,
    source: "finnhub",
    fetchedAt: Date.now(),
  };
}
