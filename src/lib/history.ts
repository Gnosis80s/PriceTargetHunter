import type { TargetChange } from "./types";

export interface HistoryPoint {
  t: number;
  v: number;
}

/**
 * Build a "consensus target over time" series from dated analyst actions.
 *
 * Each firm's most recent target is tracked; the series records the running
 * average across firms after every revision. This lets the target-history chart
 * render immediately from `upgradeDowngradeHistory`, instead of waiting days for
 * locally stored snapshots to accumulate.
 */
export function runningTargetAverage(changes: TargetChange[] | undefined): HistoryPoint[] {
  if (!changes?.length) return [];

  const events = changes
    .map((c) => {
      const value = c.toTarget ?? c.fromTarget;
      return value != null && c.date > 0 ? { date: c.date, firm: c.firm, value } : null;
    })
    .filter((e): e is { date: number; firm: string; value: number } => e != null)
    .sort((a, b) => a.date - b.date);

  const latestByFirm = new Map<string, number>();
  const out: HistoryPoint[] = [];
  for (const e of events) {
    latestByFirm.set(e.firm, e.value);
    let sum = 0;
    for (const v of latestByFirm.values()) sum += v;
    const avg = sum / latestByFirm.size;
    const last = out[out.length - 1];
    if (last && last.t === e.date) last.v = avg;
    else out.push({ t: e.date, v: avg });
  }
  return out;
}
