import type { TrackedPick, ScreenerRow } from "./types";

/**
 * Forward-return tracking. Logging what the screen picked — and measuring what
 * happened next — is the only way to know whether a scoring change actually
 * improves selection. Picks are compared against a benchmark so market-wide
 * moves don't masquerade as skill.
 */

const DAY = 864e5;

/** Stable id: a symbol can be logged at most once per calendar day. */
export function pickId(symbol: string, at = Date.now()): string {
  return `${symbol.toUpperCase()}:${new Date(at).toISOString().slice(0, 10)}`;
}

export function makePick(
  row: ScreenerRow,
  benchmarkPrice: number | null,
  at = Date.now(),
): TrackedPick {
  return {
    id: pickId(row.symbol, at),
    symbol: row.symbol,
    name: row.name,
    sector: row.sector,
    addedAt: at,
    entryPrice: row.price as number,
    entryUpsidePct: row.upsidePct,
    entryScore: row.score,
    entryBenchmark: benchmarkPrice,
    lastPrice: row.price ?? null,
    lastAt: at,
    returnPct: 0,
    benchmarkReturnPct: benchmarkPrice != null ? 0 : null,
    excessPct: benchmarkPrice != null ? 0 : null,
  };
}

/**
 * Choose which rows to log: the highest-scoring names, skipping symbols already
 * logged within the cooldown window (so a persistent name isn't re-added on
 * every scan) and rows without a usable price.
 */
export function selectPickCandidates(
  rows: ScreenerRow[],
  existing: TrackedPick[],
  topN: number,
  cooldownDays: number,
  now = Date.now(),
): ScreenerRow[] {
  if (topN <= 0) return [];
  const lastBySymbol = new Map<string, number>();
  for (const p of existing) {
    const prev = lastBySymbol.get(p.symbol) ?? 0;
    if (p.addedAt > prev) lastBySymbol.set(p.symbol, p.addedAt);
  }
  const cooldownMs = Math.max(0, cooldownDays) * DAY;
  const takenToday = new Set(existing.map((p) => p.id));

  return [...rows]
    .filter((r) => r.price != null && r.price > 0)
    .sort((a, b) => b.score - a.score)
    .filter((r) => {
      const last = lastBySymbol.get(r.symbol);
      if (last != null && now - last < cooldownMs) return false;
      return !takenToday.has(pickId(r.symbol, now));
    })
    .slice(0, topN);
}

/** Recompute a pick's return (and excess vs the benchmark) at a new price. */
export function updatePick(
  pick: TrackedPick,
  price: number | null,
  benchmarkPrice: number | null,
  at = Date.now(),
): TrackedPick {
  if (price == null || !(pick.entryPrice > 0)) return pick;
  const returnPct = ((price - pick.entryPrice) / pick.entryPrice) * 100;
  const benchmarkReturnPct =
    benchmarkPrice != null && pick.entryBenchmark != null && pick.entryBenchmark > 0
      ? ((benchmarkPrice - pick.entryBenchmark) / pick.entryBenchmark) * 100
      : null;
  return {
    ...pick,
    lastPrice: price,
    lastAt: at,
    returnPct,
    benchmarkReturnPct,
    excessPct: benchmarkReturnPct == null ? null : returnPct - benchmarkReturnPct,
  };
}

export interface PickStats {
  count: number;
  hitRate: number | null;
  avgReturn: number | null;
  medianReturn: number | null;
  avgBenchmarkReturn: number | null;
  avgExcess: number | null;
}

function mean(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Aggregate track-record statistics across evaluated picks. */
export function summarizePicks(picks: TrackedPick[]): PickStats {
  const returns = picks.map((p) => p.returnPct).filter((v): v is number => v != null);
  const bench = picks.map((p) => p.benchmarkReturnPct).filter((v): v is number => v != null);
  const excess = picks.map((p) => p.excessPct).filter((v): v is number => v != null);
  return {
    count: picks.length,
    hitRate: returns.length ? (returns.filter((v) => v > 0).length / returns.length) * 100 : null,
    avgReturn: mean(returns),
    medianReturn: median(returns),
    avgBenchmarkReturn: mean(bench),
    avgExcess: mean(excess),
  };
}

/** Picks grouped into age buckets for a simple decaying-performance view. */
export function performanceByAge(picks: TrackedPick[], now = Date.now()): { label: string; stats: PickStats }[] {
  const buckets: { label: string; maxDays: number }[] = [
    { label: "0–1m", maxDays: 30 },
    { label: "1–3m", maxDays: 90 },
    { label: "3–6m", maxDays: 180 },
    { label: "6m+", maxDays: Infinity },
  ];
  return buckets.map((b, i) => {
    const minDays = i === 0 ? 0 : buckets[i - 1].maxDays;
    const subset = picks.filter((p) => {
      const age = (now - p.addedAt) / DAY;
      return age >= minDays && age < b.maxDays;
    });
    return { label: b.label, stats: summarizePicks(subset) };
  });
}
