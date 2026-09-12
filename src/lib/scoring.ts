import type { ScreenerRow, StockData } from "./types";

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
const round = (v: number, d = 2) => Math.round(v * 10 ** d) / 10 ** d;

export function upsidePct(target: number | undefined, price: number | undefined): number | null {
  if (!target || !price || price <= 0) return null;
  return ((target - price) / price) * 100;
}

export function riskReward(
  target: number | undefined,
  price: number | undefined,
  low: number | undefined,
): number | null {
  if (!target || !price || !low) return null;
  const downside = price - low;
  if (downside <= 0) return null;
  return (target - price) / downside;
}

/** Net bullish/bearish analyst actions within the last `days`. */
export function momentum(changes: StockData["targetChanges"], days = 90): number {
  if (!changes?.length) return 0;
  const cutoff = Date.now() - days * 864e5;
  let net = 0;
  for (const c of changes) {
    if (c.date < cutoff) continue;
    const a = (c.action || "").toLowerCase();
    if (a === "up" || a === "init" || a === "reit" || a === "main") {
      net += a === "up" || a === "init" ? 1 : 0.25;
    } else if (a === "down") {
      net -= 1;
    }
  }
  return net;
}

/**
 * Composite 0-100 conviction score.
 *   45% upside, 20% analyst consensus, 20% target momentum, 15% coverage.
 */
export function score(stock: StockData): number {
  const up = upsidePct(stock.targetMean, stock.price);
  const upsideScore = up == null ? 0 : clamp((up / 60) * 100);
  const coverageScore = clamp(((stock.analystCount ?? 0) / 20) * 100);
  const rec = stock.recommendationMean;
  const consensusScore = rec == null ? 50 : clamp(((5 - rec) / 4) * 100);
  const mom = momentum(stock.targetChanges);
  const momentumScore = clamp(50 + mom * 12.5);
  return round(upsideScore * 0.45 + consensusScore * 0.2 + momentumScore * 0.2 + coverageScore * 0.15, 1);
}

export function toRow(stock: StockData): ScreenerRow {
  const up = upsidePct(stock.targetMean, stock.price);
  return {
    ...stock,
    upsidePct: up == null ? null : round(up, 2),
    riskReward: (() => {
      const rr = riskReward(stock.targetMean, stock.price, stock.targetLow);
      return rr == null ? null : round(rr, 2);
    })(),
    momentum: round(momentum(stock.targetChanges), 1),
    score: score(stock),
  };
}
