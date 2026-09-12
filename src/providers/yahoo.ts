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
    .map((h) => ({
      date: (num(h?.epochGradeDate) ?? 0) * 1000,
      firm: String(h?.firm ?? "Unknown"),
      action: String(h?.action ?? "main"),
      from: h?.fromGrade != null ? String(h.fromGrade) : undefined,
      to: h?.toGrade != null ? String(h.toGrade) : undefined,
    }))
    .filter((c) => c.date > 0)
    .slice(0, 60);
}

export async function fetchYahoo(symbol: string): Promise<StockData> {
  const res = await fetch(`/api/yahoo/quoteSummary?symbol=${encodeURIComponent(symbol)}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`yahoo ${res.status}`);
  const json = await res.json();
  const r = json?.quoteSummary?.result?.[0];
  if (!r) throw new Error(json?.quoteSummary?.error?.description ?? "yahoo: no result");

  const price = pick(r, "price");
  const fin = pick(r, "financialData");
  const stats = pick(r, "defaultKeyStatistics");
  const detail = pick(r, "summaryDetail");
  const profile = pick(r, "summaryProfile");
  const trend = pick(r, "recommendationTrend.trend")?.[0];

  const current = num(fin?.currentPrice) ?? num(price?.regularMarketPrice) ?? num(detail?.regularMarketPrice);
  const changePct =
    num(price?.regularMarketChangePercent) != null
      ? num(price?.regularMarketChangePercent)! * 100
      : undefined;

  let recMean = num(fin?.recommendationMean);
  let recKey = fin?.recommendationKey ? String(fin.recommendationKey) : undefined;
  if (recMean == null && trend) {
    const sb = num(trend.strongBuy) ?? 0;
    const b = num(trend.buy) ?? 0;
    const h = num(trend.hold) ?? 0;
    const s = num(trend.sell) ?? 0;
    const ss = num(trend.strongSell) ?? 0;
    const total = sb + b + h + s + ss;
    if (total > 0) recMean = (sb * 1 + b * 2 + h * 3 + s * 4 + ss * 5) / total;
  }

  const volume = num(price?.regularMarketVolume) ?? num(detail?.volume);
  const avgVolume = num(detail?.averageVolume) ?? num(stats?.averageVolume);

  return {
    symbol,
    name: price?.longName ?? price?.shortName ?? undefined,
    currency: price?.currency ?? undefined,
    price: current,
    previousClose: num(price?.regularMarketPreviousClose) ?? num(detail?.previousClose),
    changePct,
    marketCap: num(price?.marketCap) ?? num(detail?.marketCap),
    volume,
    avgVolume,
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
      title: String(n.title ?? ""),
      publisher: String(n.publisher ?? ""),
      link: String(n.link ?? ""),
      publishedAt: (num(n.providerPublishTime) ?? 0) * 1000,
    }));
  } catch {
    return [];
  }
}
