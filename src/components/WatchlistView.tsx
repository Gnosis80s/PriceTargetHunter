import { useMemo } from "react";
import { ArrowDownRight, ArrowUpRight, Trash2 } from "lucide-react";
import type { ScreenerRow } from "../lib/types";
import { useApp } from "../store/AppStore";
import { Button, Card, CardHeader } from "./ui";
import { fmtMoney, fmtNum, fmtPct } from "../lib/utils";

export function WatchlistView({ rows, onSelect }: { rows: ScreenerRow[]; onSelect: (symbol: string) => void }) {
  const { watchlist, removeWatch } = useApp();
  const bySymbol = useMemo(() => new Map(rows.map((r) => [r.symbol, r])), [rows]);

  return (
    <Card>
      <CardHeader title="Watchlist" subtitle={`${watchlist.length} saved symbol${watchlist.length === 1 ? "" : "s"}`} />
      <div className="divide-y divide-border/60">
        {watchlist.map((w) => {
          const r = bySymbol.get(w.symbol);
          const delta =
            r?.upsidePct != null && w.entryUpsidePct != null ? r.upsidePct - w.entryUpsidePct : null;
          return (
            <div key={w.symbol} className="flex items-center justify-between gap-3 px-4 py-3">
              <button className="text-left" onClick={() => onSelect(w.symbol)}>
                <div className="font-semibold">{w.symbol}</div>
                <div className="max-w-[240px] truncate text-xs text-muted">{r?.name ?? "Not in current scan"}</div>
              </button>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-xs text-muted">Price</div>
                  <div className="text-sm tabular">{fmtMoney(r?.price, r?.currency)}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted">Upside</div>
                  <div className="text-sm font-semibold text-good tabular">{fmtPct(r?.upsidePct)}</div>
                </div>
                <div className="hidden w-24 text-right sm:block">
                  <div className="text-xs text-muted">Since added</div>
                  <div
                    className={`inline-flex items-center gap-0.5 text-sm tabular ${
                      (delta ?? 0) >= 0 ? "text-good" : "text-bad"
                    }`}
                  >
                    {delta == null ? (
                      "—"
                    ) : (
                      <>
                        {delta >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                        {fmtNum(Math.abs(delta), 1)}
                      </>
                    )}
                  </div>
                </div>
                <Button size="icon" variant="ghost" title="Remove" onClick={() => removeWatch(w.symbol)}>
                  <Trash2 size={15} className="text-muted" />
                </Button>
              </div>
            </div>
          );
        })}
        {!watchlist.length ? (
          <div className="px-4 py-10 text-center text-sm text-muted">
            No symbols yet. Click the star on any row to add it.
          </div>
        ) : null}
      </div>
    </Card>
  );
}
