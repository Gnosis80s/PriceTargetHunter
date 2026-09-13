import type { StockData, TargetChange } from "../lib/types";

/* eslint-disable @typescript-eslint/no-explicit-any */
const BASE = "https://financialmodelingprep.com";

function num(v: unknown): number | undefined {
  const n = typeof v === "string" ? Number(v) : (v as number);
  return typeof n === "number" && Number.isFinite(n) ? n : undefined;
}

function arr(json: any): any[] {
  if (Array.isArray(json)) return json;
  if (json && Array.isArray(json.data)) return json.data;
  return json && typeof json === "object" ? [json] : [];
}

async function get(paths: string[], apiKey: string): Promise<any[]> {
  for (const p of paths) {
    const url = `${BASE}${p}${p.includes("?") ? "&" : "?"}apikey=${encodeURIComponent(apiKey)}`;
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const json = await res.json();
      const rows = arr(json);
      if (rows.length) return rows;
    } catch {
      /* try next variant */
    }
  }
  return [];
}

function toChanges(rows: any[]): TargetChange[] {
  return rows
    .map((h) => ({
      date: Date.parse(String(h.publishedDate ?? h.date ?? "")) || 0,
      firm: String(h.gradingCompany ?? h.analystCompany ?? "Unknown"),
      action: String(h.action ?? (h.priceTarget != null ? "up" : "main")).toLowerCase(),
      from: h.previousGrade != null ? String(h.previousGrade) : undefined,
      to: h.newGrade != null ? String(h.newGrade) : undefined,
    }))
    .filter((c) => c.date > 0)
    .sort((a, b) => b.date - a.date)
    .slice(0, 60);
}

export async function fetchFmp(symbol: string, apiKey: string): Promise<StockData> {
  if (!apiKey) throw new Error("fmp: missing api key");
  const s = encodeURIComponent(symbol);

  const [quoteRows, profileRows, consensusRows, gradesRows, targetRows, metricsRows, ratiosRows, growthRows] =
    await Promise.all([
      get([`/stable/quote?symbol=${s}`, `/api/v3/quote/${s}`], apiKey),
      get([`/stable/profile?symbol=${s}`, `/api/v3/profile/${s}`], apiKey),
      get([`/stable/price-target-consensus?symbol=${s}`, `/api/v3/price-target-consensus?symbol=${s}`], apiKey),
      get([`/stable/grades-consensus?symbol=${s}`, `/api/v3/grades-consensus?symbol=${s}`], apiKey),
      get([`/stable/price-target?symbol=${s}`, `/api/v3/price-target?symbol=${s}`], apiKey),
      get([`/stable/key-metrics-ttm?symbol=${s}`, `/api/v3/key-metrics-ttm?symbol=${s}`], apiKey),
      get([`/stable/ratios-ttm?symbol=${s}`, `/api/v3/ratios-ttm?symbol=${s}`], apiKey),
      get([`/stable/financial-growth?symbol=${s}&limit=1`, `/api/v3/financial-growth/${s}?limit=1`], apiKey),
    ]);

  const q = quoteRows[0] ?? {};
  const p = profileRows[0] ?? {};
  const c = consensusRows[0] ?? {};
  const g = gradesRows[0] ?? {};
  const km = metricsRows[0] ?? {};
  const rt = ratiosRows[0] ?? {};
  const gr = growthRows[0] ?? {};

  const strongBuy = num(g.strongBuy);
  const buy = num(g.buy);
  const hold = num(g.hold);
  const sell = num(g.sell);
  const strongSell = num(g.strongSell);
  const counts = [strongBuy, buy, hold, sell, strongSell].map((x) => x ?? 0);
  const countSum = counts.reduce((a, b) => a + b, 0);
  const recMean =
    countSum > 0 ? (counts[0] * 1 + counts[1] * 2 + counts[2] * 3 + counts[3] * 4 + counts[4] * 5) / countSum : undefined;

  const changes = toChanges(targetRows);
  const price = num(q.price) ?? num(c.priceWhenPosted);

  return {
    symbol,
    name: q.name ?? p.companyName ?? undefined,
    currency: p.currency ?? "USD",
    price,
    previousClose: num(q.previousClose),
    changePct: num(q.changePercentage) ?? num(q.changesPercentage),
    marketCap: num(q.marketCap) ?? num(p.mktCap) ?? num(p.marketCap),
    volume: num(q.volume),
    avgVolume: num(q.avgVolume),
    sector: p.sector ?? undefined,
    industry: p.industry ?? undefined,
    targetMean: num(c.targetConsensus) ?? num(c.targetMedian),
    targetMedian: num(c.targetMedian),
    targetHigh: num(c.targetHigh),
    targetLow: num(c.targetLow),
    analystCount: countSum || changes.length || undefined,
    recommendationMean: recMean,
    recommendationKey: g.consensus ? String(g.consensus) : undefined,
    strongBuy,
    buy,
    hold,
    sell,
    strongSell,
    trailingPE: num(q.pe),
    forwardPE: num(q.forwardPE) ?? num(rt.priceToEarningsRatioTTM),
    eps: num(q.eps) ?? num(q.epsDiluted),

    priceToBook: num(rt.priceToBookRatioTTM) ?? num(km.priceToBookRatioTTM),
    priceToSales: num(rt.priceToSalesRatioTTM),
    enterpriseToEbitda: num(km.enterpriseValueOverEBITDATTM) ?? num(km.evToEBITDATTM),
    pegRatio: num(rt.priceToEarningsGrowthRatioTTM) ?? num(km.pegRatioTTM),
    dividendYield: num(rt.dividendYieldTTM),
    freeCashFlow: num(km.freeCashFlowTTM),
    operatingCashFlow: num(km.operatingCashFlowTTM),
    returnOnEquity: num(km.returnOnEquityTTM),
    returnOnAssets: num(km.returnOnAssetsTTM),
    grossMargin: num(rt.grossProfitMarginTTM),
    operatingMargin: num(rt.operatingProfitMarginTTM),
    netMargin: num(rt.netProfitMarginTTM),
    debtToEquity: num(rt.debtToEquityRatioTTM) ?? num(km.debtToEquityTTM),
    currentRatio: num(rt.currentRatioTTM) ?? num(km.currentRatioTTM),
    netDebtToEbitda: num(km.netDebtToEBITDATTM),
    interestCoverage: num(km.interestCoverageTTM) ?? num(rt.interestCoverageTTM),
    revenueGrowth: num(gr.revenueGrowth),
    earningsGrowth: num(gr.epsgrowth) ?? num(gr.netIncomeGrowth),
    epsGrowth: num(gr.epsgrowth),

    targetChanges: changes,
    source: "fmp",
    fetchedAt: Date.now(),
  };
}
