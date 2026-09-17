import { useMemo } from "react";
import { Trash2 } from "lucide-react";
import { useApp } from "../store/AppStore";
import { Button, Card, CardHeader } from "./ui";
import { fmtMoney, fmtNum, fmtPct, timeAgo } from "../lib/utils";
import { performanceByAge, summarizePicks } from "../lib/tracking";

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return (
    <Card className="p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className={`mt-1 text-2xl font-bold tabular ${tone === "good" ? "text-good" : tone === "bad" ? "text-bad" : ""}`}>
        {value}
      </div>
    </Card>
  );
}

function tone(v: number | null): "good" | "bad" | undefined {
  if (v == null) return undefined;
  return v >= 0 ? "good" : "bad";
}

export function TrackingView() {
  const { picks, benchmark, clearPicks } = useApp();

  const stats = useMemo(() => summarizePicks(picks), [picks]);
  const byAge = useMemo(() => performanceByAge(picks), [picks]);
  const recent = useMemo(() => [...picks].sort((a, b) => b.addedAt - a.addedAt).slice(0, 100), [picks]);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Tracked picks" value={String(stats.count)} />
        <Kpi label="Hit rate" value={stats.hitRate == null ? "—" : `${stats.hitRate.toFixed(0)}%`} />
        <Kpi label="Average return" value={stats.avgReturn == null ? "—" : fmtPct(stats.avgReturn)} tone={tone(stats.avgReturn)} />
        <Kpi
          label="Average excess vs benchmark"
          value={stats.avgExcess == null ? "—" : fmtPct(stats.avgExcess)}
          tone={tone(stats.avgExcess)}
        />
      </div>

      <Card>
        <CardHeader
          title="Performance by holding period"
          subtitle={
            benchmark
              ? `Benchmark price last seen ${timeAgo(benchmark.at)} · returns versus benchmark`
              : "Benchmark not seen yet — run a scan"
          }
        />
        <div className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-4">
          {byAge.map((b) => (
            <div key={b.label} className="rounded-lg border border-border bg-surface-2 px-3 py-2">
              <div className="text-xs font-semibold">{b.label}</div>
              <div className="mt-1 text-lg font-bold tabular">{b.stats.avgReturn == null ? "—" : fmtPct(b.stats.avgReturn)}</div>
              <div className="text-[11px] text-muted">
                {b.stats.count} pick{b.stats.count === 1 ? "" : "s"}
                {b.stats.avgExcess != null ? ` · ${fmtPct(b.stats.avgExcess)} vs bench` : ""}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Logged picks"
          subtitle="Highest-scoring names each scan · return updates as prices refresh"
          action={
            picks.length ? (
              <Button
                size="sm"
                variant="danger"
                onClick={() => {
                  if (confirm("Clear the entire track record?")) clearPicks();
                }}
              >
                <Trash2 size={14} /> Clear
              </Button>
            ) : null
          }
        />
        <div className="overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-surface">
              <tr className="border-b border-border text-left text-xs text-muted">
                <th className="px-3 py-2 font-medium">Symbol</th>
                <th className="px-3 py-2 font-medium">Logged</th>
                <th className="px-3 py-2 text-right font-medium">Entry</th>
                <th className="px-3 py-2 text-right font-medium">Last</th>
                <th className="px-3 py-2 text-right font-medium">Return</th>
                <th className="px-3 py-2 text-right font-medium">vs Bench</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((p) => (
                <tr key={p.id} className="border-b border-border/60">
                  <td className="px-3 py-2">
                    <div className="font-semibold">{p.symbol}</div>
                    <div className="max-w-[200px] truncate text-xs text-muted">{p.name ?? p.sector ?? "—"}</div>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted">{timeAgo(p.addedAt)}</td>
                  <td className="px-3 py-2 text-right tabular">{fmtMoney(p.entryPrice)}</td>
                  <td className="px-3 py-2 text-right tabular">{p.lastPrice == null ? "—" : fmtMoney(p.lastPrice)}</td>
                  <td className={`px-3 py-2 text-right font-semibold tabular ${p.returnPct == null ? "" : p.returnPct >= 0 ? "text-good" : "text-bad"}`}>
                    {p.returnPct == null ? "—" : fmtPct(p.returnPct)}
                  </td>
                  <td className={`px-3 py-2 text-right tabular ${p.excessPct == null ? "" : p.excessPct >= 0 ? "text-good" : "text-bad"}`}>
                    {p.excessPct == null ? "—" : fmtPct(p.excessPct)}
                  </td>
                </tr>
              ))}
              {!recent.length ? (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center text-sm text-muted">
                    No picks logged yet. Run a scan with tracking enabled.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {stats.medianReturn != null ? (
          <div className="border-t border-border px-4 py-2 text-[11px] text-muted">
            Median return {fmtPct(stats.medianReturn)}
            {stats.avgBenchmarkReturn != null ? ` · benchmark ${fmtPct(stats.avgBenchmarkReturn)}` : ""} ·{" "}
            {fmtNum(stats.count, 0)} picks tracked
          </div>
        ) : null}
      </Card>
    </div>
  );
}
