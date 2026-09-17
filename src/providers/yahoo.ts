import type { StockData, TargetChange } from "../lib/types";

/* eslint-disable @typescript-eslint/no-explicit-any */
function num(v: unknown): number | undefined {
  if (v == null) return undefined;
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  if (typeof v === "object" && "raw" in (v as any)) return num((v as any).raw);
  return undefined;
}

/** Accepts Date objects, ISO strings or epoch seconds/milliseconds. */
function epochMs(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number") return v > 1e12 ? v : v * 1000;
  const parsed = Date.parse(String(v));
  return Number.isFinite(parsed) ? parsed : 0;
}

function pick(obj: any, path: string): any {
  return path.split(".").reduce((acc, k) => (acc == null ? acc : acc[k]), obj);
}

export interface YahooChartPoint {
  t: number;
  close: number;
}

export interface NewsItem {
  title: string;
  publisher: string;
  link: string;
  publishedAt: number;
}

function mapGradeHistory(history: any[] | undefined): TargetChange[] {
  if (!Array.isArray(history)) return [];
  return history
    .map((h) => {
      const fromTarget = num(h?.priorPriceTarget);
      const toTarget = num(h?.currentPriceTarget);
      return {
        date: epochMs(h?.epochGradeDate),
        firm: String(h?.firm ?? "Unknown"),
        action: String(h?.action ?? "main"),
        from: h?.fromGrade != null ? String(h.fromGrade) : undefined,
        to: h?.toGrade != null ? String(h.toGrade) : undefined,
        fromTarget: fromTarget && fromTarget > 0 ? fromTarget : undefined,
        toTarget: toTarget && toTarget > 0 ? toTarget : undefined,
        priceTargetAction: h?.priceTargetAction ? String(h.priceTargetAction) : undefined,
      };
    })
    .filter((c) => c.date > 0)
    .sort((a, b) => b.date - a.date)
    .slice(0, 60);
}

export async function fetchYahoo(symbol: string): Promise<StockData> {
  const res = await fetch(`/api/yahoo/quoteSummary?symbol=${encodeURIComponent(symbol)}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`yahoo ${res.status}`);
  const json = await res.json();
  // yahoo-finance2 returns the module object directly; tolerate the legacy
  // { quoteSummary: { result: [...] } } envelope too.
  const r = json?.quoteSummary?.result?.[0] ?? json;
  if (!r || typeof r !== "object") throw new Error("yahoo: no result");

  const price = pick(r, "price");
  const fin = pick(r, "financialData");
  const stats = pick(r, "defaultKeyStatistics");
  const detail = pick(r, "summaryDetail");
  const profile = pick(r, "summaryProfile");
  const trend = pick(r, "recommendationTrend.trend")?.[0];

  const current = num(fin?.currentPrice) ?? num(price?.regularMarketPrice) ?? num(detail?.regularMarketPrice);
  const previousClose = num(price?.regularMarketPreviousClose) ?? num(detail?.previousClose);
  // Yahoo is inconsistent here: yields can arrive as 0.02 (2%) or 2.0 (2%).
  const rawYield = num(detail?.dividendYield);
  const dividendYield = rawYield == null ? undefined : rawYield > 1 ? rawYield / 100 : rawYield;
  let changePct: number | undefined;
  if (current != null && previousClose) changePct = ((current - previousClose) / previousClose) * 100;
  else if (num(price?.regularMarketChangePercent) != null) changePct = num(price?.regularMarketChangePercent)! * 100;

  let recMean = num(fin?.recommendationMean);
  const recKey = fin?.recommendationKey ? String(fin.recommendationKey) : undefined;
  if (recMean == null && trend) {
    const sb = num(trend.strongBuy) ?? 0;
    const b = num(trend.buy) ?? 0;
    const h = num(trend.hold) ?? 0;
    const s = num(trend.sell) ?? 0;
    const ss = num(trend.strongSell) ?? 0;
    const total = sb + b + h + s + ss;
    if (total > 0) recMean = (sb * 1 + b * 2 + h * 3 + s * 4 + ss * 5) / total;
  }

  // Forward estimate revisions (from earningsTrend): prefer the current fiscal
  // year, then next year, then whatever is available.
  const earningsTrend = pick(r, "earningsTrend.trend") as any[] | undefined;
  const estimate =
    (Array.isArray(earningsTrend) ? earningsTrend.find((t) => t?.period === "0y") : undefined) ??
    (Array.isArray(earningsTrend) ? earningsTrend.find((t) => t?.period === "+1y") : undefined) ??
    (Array.isArray(earningsTrend) ? earningsTrend[0] : undefined);
  const epsTrend = estimate?.epsTrend;
  const epsRevisions = estimate?.epsRevisions;
  const forwardEps = num(epsTrend?.current);
  const forwardEps90dAgo = num(epsTrend?.["90daysAgo"]);
  const epsRevisionPct =
    forwardEps != null && forwardEps90dAgo != null && forwardEps90dAgo !== 0
      ? (forwardEps - forwardEps90dAgo) / Math.abs(forwardEps90dAgo)
      : undefined;

  // Price trend.
  const fiftyTwoWeekHigh = num(detail?.fiftyTwoWeekHigh) ?? num(price?.fiftyTwoWeekHigh);
  const fiftyTwoWeekLow = num(detail?.fiftyTwoWeekLow) ?? num(price?.fiftyTwoWeekLow);
  const twoHundredDayAverage = num(detail?.twoHundredDayAverage) ?? num(price?.twoHundredDayAverage);
  const fiftyDayAverage = num(detail?.fiftyDayAverage) ?? num(price?.fiftyDayAverage);
  const week52Change = num(stats?.["52WeekChange"]) ?? num(stats?.fiftyTwoWeekChange);

  // Event risk.
  const rawEarningsDates = pick(r, "calendarEvents.earnings.earningsDate") as unknown;
  const firstEarningsDate = Array.isArray(rawEarningsDates) ? rawEarningsDates[0] : undefined;
  const nextEarningsDate = firstEarningsDate != null ? epochMs(firstEarningsDate) : undefined;

  return {
    symbol,
    name: price?.longName ?? price?.shortName ?? undefined,
    currency: price?.currency ?? undefined,
    price: current,
    previousClose,
    changePct,
    marketCap: num(price?.marketCap) ?? num(detail?.marketCap),
    volume: num(price?.regularMarketVolume) ?? num(detail?.volume),
    avgVolume: num(detail?.averageVolume) ?? num(stats?.averageVolume),
    sector: profile?.sector ?? undefined,
    industry: profile?.industry ?? undefined,
    targetMean: num(fin?.targetMeanPrice),
    targetMedian: num(fin?.targetMedianPrice),
    targetHigh: num(fin?.targetHighPrice),
    targetLow: num(fin?.targetLowPrice),
    analystCount: num(fin?.numberOfAnalystOpinions),
    recommendationMean: recMean,
    recommendationKey: recKey,
    strongBuy: num(trend?.strongBuy),
    buy: num(trend?.buy),
    hold: num(trend?.hold),
    sell: num(trend?.sell),
    strongSell: num(trend?.strongSell),
    trailingPE: num(detail?.trailingPE) ?? num(stats?.trailingPE),
    forwardPE: num(detail?.forwardPE) ?? num(stats?.forwardPE),
    eps: num(stats?.trailingEps),
    earningsGrowth: num(fin?.earningsGrowth),
    revenueGrowth: num(fin?.revenueGrowth),

    priceToBook: num(stats?.priceToBook),
    priceToSales: num(detail?.priceToSalesTrailing12Months),
    enterpriseToEbitda: num(stats?.enterpriseToEbitda),
    pegRatio: num(stats?.pegRatio) ?? num(stats?.trailingPegRatio),
    dividendYield,
    returnOnEquity: num(fin?.returnOnEquity),
    returnOnAssets: num(fin?.returnOnAssets),
    grossMargin: num(fin?.grossMargins),
    operatingMargin: num(fin?.operatingMargins),
    netMargin: num(fin?.profitMargins),
    freeCashFlow: num(fin?.freeCashflow),
    operatingCashFlow: num(fin?.operatingCashflow),
    // Yahoo reports debt/equity as a percentage (e.g. 154.3 = 1.54x).
    debtToEquity: num(fin?.debtToEquity) != null ? num(fin?.debtToEquity)! / 100 : undefined,
    currentRatio: num(fin?.currentRatio),
    epsGrowth: num(stats?.earningsQuarterlyGrowth),

    forwardEps,
    forwardEps90dAgo,
    epsRevisionPct,
    epsRevisionsUp30d: num(epsRevisions?.upLast30days),
    epsRevisionsDown30d: num(epsRevisions?.downLast30days),
    forwardEpsGrowth: num(estimate?.earningsEstimate?.growth),

    fiftyTwoWeekHigh,
    fiftyTwoWeekLow,
    twoHundredDayAverage,
    fiftyDayAverage,
    week52Change,

    nextEarningsDate: nextEarningsDate && nextEarningsDate > 0 ? nextEarningsDate : undefined,
    shortPercentOfFloat: num(stats?.shortPercentOfFloat),
    shortRatio: num(stats?.shortRatio),

    targetChanges: mapGradeHistory(pick(r, "upgradeDowngradeHistory.history")),
    source: "yahoo",
    fetchedAt: Date.now(),
  };
}

export async function fetchYahooChart(symbol: string, range = "1y", interval = "1d"): Promise<YahooChartPoint[]> {
  const res = await fetch(
    `/api/yahoo/chart?symbol=${encodeURIComponent(symbol)}&range=${range}&interval=${interval}`,
  );
  if (!res.ok) throw new Error(`yahoo chart ${res.status}`);
  const json = await res.json();

  // yahoo-finance2 chart() returns { meta, quotes: [{ date, close, ... }] }.
  if (Array.isArray(json?.quotes)) {
    return json.quotes
      .map((q: any) => ({
        t: epochMs(q?.date),
        close: typeof q?.close === "number" ? q.close : NaN,
      }))
      .filter((p: YahooChartPoint) => p.t > 0 && Number.isFinite(p.close));
  }

  // Legacy raw Yahoo shape.
  const result = json?.chart?.result?.[0];
  const ts: number[] = result?.timestamp ?? [];
  const closes: (number | null)[] = result?.indicators?.quote?.[0]?.close ?? [];
  return ts
    .map((t, i) => ({ t: t * 1000, close: closes[i] ?? NaN }))
    .filter((p) => Number.isFinite(p.close));
}

export async function fetchYahooNews(symbol: string): Promise<NewsItem[]> {
  try {
    const res = await fetch(`/api/yahoo/search?q=${encodeURIComponent(symbol)}`);
    if (!res.ok) return [];
    const json = await res.json();
    return (json?.news ?? []).map((n: any) => ({
      title: String(n?.title ?? ""),
      publisher: String(n?.publisher ?? ""),
      link: String(n?.link ?? ""),
      publishedAt: epochMs(n?.providerPublishTime),
    }));
  } catch {
    return [];
  }
}
