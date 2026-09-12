import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Eye, Star } from "lucide-react";
import type { ScreenerRow } from "../lib/types";
import { Badge, Button } from "./ui";
import { fmtCompact, fmtMoney, fmtNum, fmtPct, recLabel } from "../lib/utils";
import { sortRows, type SortKey } from "../lib/screener";
import { useApp } from "../store/AppStore";

const COLUMNS: { key: SortKey | "consensus"; label: string; align?: "right"; sortable: boolean; title?: string }[] = [
  { key: "symbol", label: "Symbol", sortable: true },
  { key: "price", label: "Price", align: "right", sortable: false },
  { key: "upsidePct", label: "Upside", align: "right", sortable: true },
  { key: "riskReward", label: "R/R", align: "right", sortable: true },
  { key: "dispersion", label: "Disp", align: "right", sortable: true, title: "Target-range width vs mean — lower = tighter agreement" },
  { key: "analystCount", label: "Analysts", align: "right", sortable: true },
  { key: "consensus", label: "Consensus", sortable: false },
  { key: "momentum", label: "Momentum", align: "right", sortable: true },
  { key: "targetMomentumPct", label: "Tgt Δ", align: "right", sortable: true, title: "Average analyst price-target change (90d)" },
  { key: "score", label: "Score", align: "right", sortable: true },
  { key: "marketCap", label: "Mkt Cap", align: "right", sortable: true },
];

export function ScreenerTable({ rows, onSelect }: { rows: ScreenerRow[]; onSelect: (symbol: string) => void }) {
  const { isWatched, addWatch, removeWatch } = useApp();
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [dir, setDir] = useState<"asc" | "desc">("desc");

  const sorted = useMemo(() => sortRows(rows, sortKey, dir), [rows, sortKey, dir]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setDir((d) => (d === "desc" ? "asc" : "desc"));
    else {
      setSortKey(key);
      setDir("desc");
    }
  };

  return (
    <div className="overflow-auto">
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-surface">
          <tr className="border-b border-border text-left text-xs text-muted">
            {COLUMNS.map((c) => (
              <th
                key={c.key}
                title={c.title}
                className={`whitespace-nowrap px-3 py-2 font-medium ${c.align === "right" ? "text-right" : ""} ${
                  c.sortable ? "cursor-pointer select-none hover:text-fg" : ""
                }`}
                onClick={() => c.sortable && toggleSort(c.key as SortKey)}
              >
                <span className="inline-flex items-center gap-1">
                  {c.label}
                  {sortKey === c.key ? (
                    dir === "desc" ? (
                      <ArrowDown size={11} />
                    ) : (
                      <ArrowUp size={11} />
                    )
                  ) : null}
                </span>
              </th>
            ))}
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => {
            const watched = isWatched(r.symbol);
            return (
              <tr
                key={r.symbol}
                className="cursor-pointer border-b border-border/60 transition-colors hover:bg-surface-2"
                onClick={() => onSelect(r.symbol)}
              >
                <td className="px-3 py-2">
                  <div className="font-semibold">{r.symbol}</div>
                  <div className="max-w-[220px] truncate text-xs text-muted">{r.name ?? "—"}</div>
                </td>
                <td className="px-3 py-2 text-right tabular">{fmtMoney(r.price, r.currency)}</td>
                <td className={`px-3 py-2 text-right font-semibold tabular ${(r.upsidePct ?? 0) >= 0 ? "text-good" : "text-bad"}`}>
                  {fmtPct(r.upsidePct)}
                </td>
                <td className="px-3 py-2 text-right tabular">{fmtNum(r.riskReward, 1)}</td>
                <td className={`px-3 py-2 text-right tabular ${(r.dispersion ?? 999) <= 40 ? "text-good" : (r.dispersion ?? 0) >= 120 ? "text-bad" : ""}`}>
                  {r.dispersion == null ? "—" : `${fmtNum(r.dispersion, 0)}%`}
                </td>
                <td className="px-3 py-2 text-right tabular">{r.analystCount ?? "—"}</td>
                <td className="px-3 py-2">
                  <Badge
                    tone={
                      (r.recommendationMean ?? 3) <= 2 ? "good" : (r.recommendationMean ?? 3) <= 3 ? "warn" : "bad"
                    }
                  >
                    {recLabel(r.recommendationKey, r.recommendationMean)}
                  </Badge>
                </td>
                <td className={`px-3 py-2 text-right tabular ${r.momentum > 0 ? "text-good" : r.momentum < 0 ? "text-bad" : ""}`}>
                  {r.momentum > 0 ? "+" : ""}
                  {fmtNum(r.momentum, 0)}
                </td>
                <td className={`px-3 py-2 text-right tabular ${(r.targetMomentumPct ?? 0) > 0 ? "text-good" : (r.targetMomentumPct ?? 0) < 0 ? "text-bad" : ""}`}>
                  {r.targetMomentumPct == null ? "—" : fmtPct(r.targetMomentumPct)}
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <div className="hidden h-1.5 w-12 overflow-hidden rounded-full bg-surface-2 sm:block">
                      <div className="h-full rounded-full bg-accent" style={{ width: `${r.score}%` }} />
                    </div>
                    <span className="tabular">{fmtNum(r.score, 0)}</span>
                  </div>
                </td>
                <td className="px-3 py-2 text-right tabular">{r.marketCap ? `$${fmtCompact(r.marketCap)}` : "—"}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      title={watched ? "Remove from watchlist" : "Add to watchlist"}
                      onClick={(e) => {
                        e.stopPropagation();
                        watched ? removeWatch(r.symbol) : addWatch(r.symbol, r.upsidePct);
                      }}
                    >
                      <Star size={15} className={watched ? "fill-warn text-warn" : "text-muted"} />
                    </Button>
                    <Button size="icon" variant="ghost" title="Details" onClick={() => onSelect(r.symbol)}>
                      <Eye size={15} />
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
          {!sorted.length ? (
            <tr>
              <td colSpan={COLUMNS.length + 1} className="px-3 py-10 text-center text-sm text-muted">
                No stocks match the current filters.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
