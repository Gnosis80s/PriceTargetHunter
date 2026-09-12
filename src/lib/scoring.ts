import type { ScreenerRow, StockData, TargetChange } from "./types";

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

/** Target-range width relative to the mean, in %. Lower = tighter analyst agreement. */
export function dispersion(
  high: number | undefined,
  low: number | undefined,
  mean: number | undefined,
): number | null {
  if (!high || !low || !mean || mean <= 0 || high < low) return null;
  return ((high - low) / mean) * 100;
}

function recentChanges(changes: TargetChange[] | undefined, days: number): TargetChange[] {
  if (!changes?.length) return [];
  const cutoff = Date.now() - days * 864e5;
  return changes.filter((c) => c.date >= cutoff);
}

/**
 * Net bullish/bearish analyst activity within the last `days`.
 *
 * Price-target revisions dominate: a target raise counts proportionally to its
 * size (a 5% raise ≈ +1 point). Grade-only changes fall back to ±1.
 */
export function momentum(changes: StockData["targetChanges"], days = 90): number {
  let net = 0;
  for (const c of recentChanges(changes, days)) {
    if (c.fromTarget && c.toTarget && c.fromTarget > 0) {
      const pct = (c.toTarget - c.fromTarget) / c.fromTarget;
      net += clamp(pct * 20, -3, 3);
      continue;
    }
    const a = (c.action || "").toLowerCase();
    if (a === "up" || a === "init") net += 1;
    else if (a === "down") net -= 1;
  }
  return round(net, 1);
}

/** Average % change of price targets over the window (null if none adjusted). */
export function targetMomentumPct(changes: TargetChange[] | undefined, days = 90): number | null {
  const adjusted = recentChanges(changes, days).filter(
    (c) => c.fromTarget && c.toTarget && c.fromTarget > 0,
  );
  if (!adjusted.length) return null;
  const avg =
    adjusted.reduce((acc, c) => acc + ((c.toTarget! - c.fromTarget!) / c.fromTarget!) * 100, 0) /
    adjusted.length;
  return round(avg, 2);
}

/**
 * Composite 0-100 conviction score.
 *   40% upside, 18% consensus, 18% momentum, 12% coverage, 12% target agreement.
 */
export function score(stock: StockData, disp: number | null): number {
  const up = upsidePct(stock.targetMean, stock.price);
  const upsideScore = up == null ? 0 : clamp((up / 60) * 100);
  const coverageScore = clamp(((stock.analystCount ?? 0) / 20) * 100);
  const rec = stock.recommendationMean;
  const consensusScore = rec == null ? 50 : clamp(((5 - rec) / 4) * 100);
  const momentumScore = clamp(50 + momentum(stock.targetChanges) * 12.5);
  // Tight target ranges (low dispersion) score better.
  const agreementScore = disp == null ? 50 : clamp(100 - disp * 0.8);
  return round(
    upsideScore * 0.4 + consensusScore * 0.18 + momentumScore * 0.18 + coverageScore * 0.12 + agreementScore * 0.12,
    1,
  );
}

export function toRow(stock: StockData): ScreenerRow {
  const up = upsidePct(stock.targetMean, stock.price);
  const disp = dispersion(stock.targetHigh, stock.targetLow, stock.targetMean);
  const rr = riskReward(stock.targetMean, stock.price, stock.targetLow);
  return {
    ...stock,
    upsidePct: up == null ? null : round(up, 2),
    riskReward: rr == null ? null : round(rr, 2),
    momentum: momentum(stock.targetChanges),
    dispersion: disp == null ? null : round(disp, 1),
    targetMomentumPct: targetMomentumPct(stock.targetChanges),
    score: score(stock, disp),
  };
}
