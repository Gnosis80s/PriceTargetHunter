import { useMemo } from "react";
import { Flame, TrendingUp } from "lucide-react";
import type { ScreenerRow } from "../lib/types";
import { Badge, Card, CardHeader } from "./ui";
import { fmtNum, fmtPct, timeAgo } from "../lib/utils";

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "good" }) {
  return (
    <Card className="p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className={`mt-1 text-2xl font-bold tabular ${tone === "good" ? "text-good" : ""}`}>{value}</div>
      {sub ? <div className="mt-0.5 text-xs text-muted">{sub}</div> : null}
    </Card>
  );
}

function upsideTone(v: number): string {
  if (v >= 40) return "bg-good/35";
  if (v >= 30) return "bg-good/25";
  if (v >= 20) return "bg-good/15";
  if (v >= 10) return "bg-warn/15";
  if (v >= 0) return "bg-surface-2";
  return "bg-bad/20";
}

export function Dashboard({
  rows,
  lastUpdated,
  onSelect,
}: {
  rows: ScreenerRow[];
  lastUpdated: number | null;
  onSelect: (symbol: string) => void;
}) {
  const withTargets = useMemo(() => rows.filter((r) => r.upsidePct != null), [rows]);

  const top = useMemo(
    () => [...withTargets].sort((a, b) => b.score - a.score).slice(0, 12),
    [withTargets],
  );

  const trending = useMemo(
    () => [...withTargets].filter((r) => r.momentum > 0).sort((a, b) => b.momentum - a.momentum).slice(0, 8),
    [withTargets],
  );

  const sectors = useMemo(() => {
    const map = new Map<string, { sum: number; n: number }>();
    for (const r of withTargets) {
      if (!r.sector || r.upsidePct == null) continue;
      const cur = map.get(r.sector) ?? { sum: 0, n: 0 };
      cur.sum += r.upsidePct;
      cur.n += 1;
      map.set(r.sector, cur);
    }
    return [...map.entries()]
      .map(([sector, { sum, n }]) => ({ sector, avg: sum / n, count: n }))
      .sort((a, b) => b.avg - a.avg);
  }, [withTargets]);

  const avgUpside = withTargets.length
    ? withTargets.reduce((a, r) => a + (r.upsidePct ?? 0), 0) / withTargets.length
    : 0;
  const strong = withTargets.filter((r) => (r.upsidePct ?? 0) >= 25 && (r.analystCount ?? 0) >= 5).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Stocks with targets" value={String(withTargets.length)} sub={`of ${rows.length} screened`} />
        <Kpi label="Average upside" value={fmtPct(avgUpside)} tone={avgUpside > 0 ? "good" : undefined} />
        <Kpi label="High conviction (≥25%, ≥5 analysts)" value={String(strong)} />
        <Kpi label="Last scan" value={lastUpdated ? timeAgo(lastUpdated) : "—"} sub="auto-refresh in Settings" />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader
            title={
              <span className="inline-flex items-center gap-2">
                <Flame size={15} className="text-warn" /> Top opportunities
              </span>
            }
            subtitle="Ranked by composite conviction score"
          />
          <div className="divide-y divide-border/60">
            {top.map((r, i) => (
              <button
                key={r.symbol}
                onClick={() => onSelect(r.symbol)}
                className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface-2"
              >
                <div className="flex items-center gap-3">
                  <span className="w-5 text-xs text-muted tabular">{i + 1}</span>
                  <div>
                    <div className="font-semibold">{r.symbol}</div>
                    <div className="max-w-[180px] truncate text-xs text-muted">{r.name}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge tone="default">{r.analystCount ?? 0} analysts</Badge>
                  <span className="w-16 text-right font-semibold text-good tabular">{fmtPct(r.upsidePct)}</span>
                  <span className="hidden w-12 text-right text-xs text-muted tabular sm:block">
                    {fmtNum(r.score, 0)}
                  </span>
                </div>
              </button>
            ))}
            {!top.length ? <div className="px-4 py-6 text-sm text-muted">Run a scan to see opportunities.</div> : null}
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Sector heat map" subtitle="Average upside by sector" />
          <div className="grid grid-cols-2 gap-2 p-4">
            {sectors.map((s) => (
              <div key={s.sector} className={`rounded-lg border border-border p-3 ${upsideTone(s.avg)}`}>
                <div className="truncate text-xs font-medium" title={s.sector}>
                  {s.sector}
                </div>
                <div className="mt-1 text-lg font-bold tabular">{fmtPct(s.avg)}</div>
                <div className="text-[11px] text-muted">{s.count} names</div>
              </div>
            ))}
            {!sectors.length ? <div className="col-span-2 py-6 text-center text-sm text-muted">No data yet.</div> : null}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader
          title={
            <span className="inline-flex items-center gap-2">
              <TrendingUp size={15} className="text-good" /> Trending upgrades
            </span>
          }
          subtitle="Net bullish analyst actions in the last 90 days"
        />
        <div className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-4">
          {trending.map((r) => (
            <button
              key={r.symbol}
              onClick={() => onSelect(r.symbol)}
              className="flex items-center justify-between rounded-lg border border-border bg-surface-2 px-3 py-2 text-left transition-colors hover:border-accent/40"
            >
              <div>
                <div className="text-sm font-semibold">{r.symbol}</div>
                <div className="max-w-[140px] truncate text-xs text-muted">{r.name}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-good tabular">+{fmtNum(r.momentum, 0)}</div>
                <div className="text-[11px] text-muted tabular">{fmtPct(r.upsidePct)}</div>
              </div>
            </button>
          ))}
          {!trending.length ? <div className="col-span-full py-4 text-center text-sm text-muted">No recent upgrades.</div> : null}
        </div>
      </Card>
    </div>
  );
}
