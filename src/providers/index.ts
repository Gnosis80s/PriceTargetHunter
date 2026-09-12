import type { AppSettings, StockData } from "../lib/types";
import { cacheGet, cacheSet } from "../lib/cache";
import { RateLimiter, mapLimit, sleep } from "../lib/concurrency";
import { demoData } from "../data/demo";
import { fetchYahoo } from "./yahoo";
import { fetchFmp } from "./fmp";
import { fetchFinnhub } from "./finnhub";

const CACHE_TTL = 15 * 60 * 1000;

const yahooLimiter = new RateLimiter(300);
const fmpLimiter = new RateLimiter(300);
const finnhubLimiter = new RateLimiter(55);

export interface FetchOutcome {
  data: StockData;
  stale: boolean;
  fromCache: boolean;
}

type Provider = { name: StockData["source"]; run: () => Promise<StockData>; limiter: RateLimiter };

function providersFor(symbol: string, settings: AppSettings): Provider[] {
  const list: Provider[] = [];
  if (settings.yahooEnabled) {
    list.push({ name: "yahoo", limiter: yahooLimiter, run: () => fetchYahoo(symbol) });
  }
  if (settings.fmpApiKey.trim()) {
    list.push({ name: "fmp", limiter: fmpLimiter, run: () => fetchFmp(symbol, settings.fmpApiKey.trim()) });
  }
  if (settings.finnhubApiKey.trim()) {
    list.push({ name: "finnhub", limiter: finnhubLimiter, run: () => fetchFinnhub(symbol, settings.finnhubApiKey.trim()) });
  }
  return list;
}

function mergeMissing(base: StockData, extra: StockData): StockData {
  const out: StockData = { ...base };
  for (const [k, v] of Object.entries(extra) as [keyof StockData, unknown][]) {
    if (out[k] == null && v != null) {
      (out as unknown as Record<string, unknown>)[k] = v;
    }
  }
  // Prefer the provider that actually supplied target data as the source label.
  if (base.targetMean == null && extra.targetMean != null) out.source = extra.source;
  if (!out.targetChanges?.length && extra.targetChanges?.length) out.targetChanges = extra.targetChanges;
  return out;
}

const hasTargets = (d: StockData) => d.targetMean != null || d.targetMedian != null;
const isUsable = (d: StockData) => d.price != null && d.price > 0;

async function tryProvider(p: Provider): Promise<StockData | null> {
  try {
    await p.limiter.acquire();
    const data = await p.run();
    return isUsable(data) ? data : null;
  } catch {
    return null;
  }
}

/**
 * Hybrid fetch: try configured providers in order, then fill any missing fields
 * (especially price targets) from the remaining providers. Falls back to the
 * bundled demo dataset so the UI is never empty.
 */
export async function fetchStock(
  symbol: string,
  settings: AppSettings,
  opts: { bypassCache?: boolean } = {},
): Promise<FetchOutcome> {
  const sym = symbol.trim().toUpperCase();
  const cacheKey = `stock:${sym}`;

  if (!opts.bypassCache) {
    const cached = cacheGet<StockData>(cacheKey, CACHE_TTL);
    if (cached) return { data: cached, stale: false, fromCache: true };
  }

  const providers = providersFor(sym, settings);
  let primary: StockData | null = null;

  for (const p of providers) {
    primary = await tryProvider(p);
    if (primary) break;
  }

  if (primary && !hasTargets(primary)) {
    for (const p of providers) {
      if (p.name === primary.source) continue;
      const extra = await tryProvider(p);
      if (extra) {
        primary = mergeMissing(primary, extra);
        if (hasTargets(primary)) break;
      }
    }
  }

  if (!primary) {
    if (settings.demoFallback) {
      const demo = demoData().find((d) => d.symbol === sym);
      if (demo) return { data: { ...demo }, stale: false, fromCache: false };
    }
    const expired = cacheGet<StockData>(cacheKey, -1);
    if (expired) return { data: expired, stale: true, fromCache: true };
    throw new Error(`No data for ${sym}`);
  }

  cacheSet(cacheKey, primary);
  return { data: primary, stale: false, fromCache: false };
}

export interface ScanResult {
  rows: StockData[];
  errors: { symbol: string; message: string }[];
}

export interface ScanOptions {
  bypassCache?: boolean;
  /** Called as each symbol resolves, for progressive results. */
  onRow?: (stock: StockData) => void;
  signal?: AbortSignal;
}

export async function scanUniverse(
  symbols: string[],
  settings: AppSettings,
  onProgress?: (done: number, total: number) => void,
  opts: ScanOptions = {},
): Promise<ScanResult> {
  let done = 0;
  const rows: StockData[] = [];
  const errors: { symbol: string; message: string }[] = [];

  await mapLimit(symbols, Math.max(1, settings.concurrency), async (symbol) => {
    if (opts.signal?.aborted) {
      done += 1;
      onProgress?.(done, symbols.length);
      return;
    }
    try {
      const { data } = await fetchStock(symbol, settings, { bypassCache: opts.bypassCache });
      rows.push(data);
      opts.onRow?.(data);
    } catch (e) {
      errors.push({ symbol, message: (e as Error).message });
    }
    done += 1;
    onProgress?.(done, symbols.length);
    await sleep(40);
  });

  return { rows, errors };
}

export { fetchYahoo, fetchFmp, fetchFinnhub };
