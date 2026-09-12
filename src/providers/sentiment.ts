import type { AppSettings } from "../lib/types";
import { cacheGet, cacheSet } from "../lib/cache";

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface SentimentArticle {
  title: string;
  url: string;
  source: string;
  time: number;
  score: number;
  label: string;
  summary?: string;
}

export interface NewsSentiment {
  source: "alphavantage" | "finnhub";
  /** Weighted score in [-1, 1]; positive = bullish. */
  score: number;
  label: string;
  /** Number of scored articles/mentions. */
  articles: number;
  bullishPct: number | null;
  bearishPct: number | null;
  /** Finnhub relative coverage vs the weekly average (null for Alpha Vantage). */
  buzz?: number;
  /** Scored headlines (Alpha Vantage only). */
  top: SentimentArticle[];
}

const TTL = 6 * 60 * 60 * 1000;

const num = (v: unknown): number | undefined => {
  const n = typeof v === "string" ? Number(v) : (v as number);
  return typeof n === "number" && Number.isFinite(n) ? n : undefined;
};

function labelFor(score: number): string {
  if (score >= 0.35) return "Bullish";
  if (score >= 0.15) return "Somewhat Bullish";
  if (score > -0.15) return "Neutral";
  if (score > -0.35) return "Somewhat Bearish";
  return "Bearish";
}

/** Alpha Vantage time_published, e.g. "20251201T120000" (UTC). */
function parseAvTime(s: unknown): number {
  const str = String(s ?? "");
  if (!/^\d{8}T\d{6}$/.test(str)) return 0;
  const iso = `${str.slice(0, 4)}-${str.slice(4, 6)}-${str.slice(6, 8)}T${str.slice(
    9,
    11,
  )}:${str.slice(11, 13)}:${str.slice(13, 15)}Z`;
  return Date.parse(iso) || 0;
}

export function aggregateAlphaVantage(symbol: string, json: any): NewsSentiment | null {
  const feed: any[] = Array.isArray(json?.feed) ? json.feed : [];
  const sym = symbol.toUpperCase();

  const scored: { article: SentimentArticle; relevance: number }[] = [];
  for (const item of feed) {
    const match = (item?.ticker_sentiment ?? []).find(
      (t: any) => String(t?.ticker ?? "").toUpperCase() === sym,
    );
    if (!match) continue;
    scored.push({
      relevance: num(match.relevance_score) ?? 0,
      article: {
        title: String(item?.title ?? ""),
        url: String(item?.url ?? ""),
        source: String(item?.source ?? ""),
        time: parseAvTime(item?.time_published),
        score: num(match.ticker_sentiment_score) ?? 0,
        label: String(match.ticker_sentiment_label ?? "Neutral"),
        summary: item?.summary ? String(item.summary) : undefined,
      },
    });
  }
  if (!scored.length) return null;

  const totalRel = scored.reduce((a, s) => a + s.relevance, 0);
  const score =
    totalRel > 0
      ? scored.reduce((a, s) => a + s.article.score * s.relevance, 0) / totalRel
      : scored.reduce((a, s) => a + s.article.score, 0) / scored.length;

  const bullish = scored.filter((s) => s.article.label.includes("Bullish")).length;
  const bearish = scored.filter((s) => s.article.label.includes("Bearish")).length;

  return {
    source: "alphavantage",
    score,
    label: labelFor(score),
    articles: scored.length,
    bullishPct: (bullish / scored.length) * 100,
    bearishPct: (bearish / scored.length) * 100,
    top: scored
      .sort((a, b) => b.article.time - a.article.time)
      .slice(0, 8)
      .map((s) => s.article),
  };
}

export function aggregateFinnhub(json: any): NewsSentiment | null {
  const sentiment = json?.sentiment;
  if (!sentiment) return null;
  const bull = (num(sentiment.bullishPercent) ?? 0) * 100;
  const bear = (num(sentiment.bearishPercent) ?? 0) * 100;
  const score = (bull - bear) / 100;
  return {
    source: "finnhub",
    score,
    label: labelFor(score),
    articles: num(json?.buzz?.articlesInLastWeek) ?? 0,
    bullishPct: bull,
    bearishPct: bear,
    buzz: num(json?.buzz?.buzz),
    top: [],
  };
}

async function fromAlphaVantage(symbol: string, apiKey: string): Promise<NewsSentiment | null> {
  const url = `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&tickers=${encodeURIComponent(
    symbol,
  )}&limit=50&apikey=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`alphavantage ${res.status}`);
  const json = await res.json();
  if (json?.Note || json?.Information) throw new Error("alphavantage rate limit");
  return aggregateAlphaVantage(symbol, json);
}

async function fromFinnhub(symbol: string, apiKey: string): Promise<NewsSentiment | null> {
  const url = `https://finnhub.io/api/v1/news-sentiment?symbol=${encodeURIComponent(
    symbol,
  )}&token=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`finnhub ${res.status}`);
  return aggregateFinnhub(await res.json());
}

/** Fetch (and cache) news sentiment, preferring Alpha Vantage then Finnhub. */
export async function fetchSentiment(
  symbol: string,
  settings: AppSettings,
  opts: { bypassCache?: boolean } = {},
): Promise<NewsSentiment | null> {
  const key = `sentiment:${symbol.toUpperCase()}`;
  if (!opts.bypassCache) {
    const cached = cacheGet<NewsSentiment | null>(key, TTL);
    if (cached !== null) return cached;
  }

  const av = settings.alphaVantageApiKey?.trim();
  const fh = settings.finnhubApiKey?.trim();
  if (!av && !fh) return null;

  try {
    const result = av ? await fromAlphaVantage(symbol, av) : await fromFinnhub(symbol, fh);
    cacheSet(key, result);
    return result;
  } catch {
    if (av && fh) {
      // Alpha Vantage unavailable (e.g. rate limited) — try Finnhub.
      try {
        const result = await fromFinnhub(symbol, fh);
        cacheSet(key, result);
        return result;
      } catch {
        return null;
      }
    }
    return null;
  }
}
