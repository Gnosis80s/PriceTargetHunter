import { useMemo, useState } from "react";
import {
  Crosshair,
  Download,
  LayoutDashboard,
  ListFilter,
  Moon,
  RefreshCw,
  Settings as SettingsIcon,
  Square,
  Star,
  Sun,
} from "lucide-react";
import { useScreener } from "./hooks/useScreener";
import { useApp } from "./store/AppStore";
import { Dashboard } from "./components/Dashboard";
import { ScreenerTable } from "./components/ScreenerTable";
import { FiltersPanel } from "./components/FiltersPanel";
import { StockDetail } from "./components/StockDetail";
import { WatchlistView } from "./components/WatchlistView";
import { SettingsPanel } from "./components/SettingsPanel";
import { Button, ProgressBar } from "./components/ui";
import { DEFAULT_FILTERS } from "./lib/defaults";
import { downloadCsv } from "./lib/csv";
import { ALL_SECTORS } from "./data/universe";
import { timeAgo } from "./lib/utils";

type Tab = "dashboard" | "screener" | "watchlist" | "settings";

const TABS: { id: Tab; label: string; icon: typeof Crosshair }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "screener", label: "Screener", icon: ListFilter },
  { id: "watchlist", label: "Watchlist", icon: Star },
  { id: "settings", label: "Settings", icon: SettingsIcon },
];

export default function App() {
  const { settings, updateSettings, updateFilters } = useApp();
  const { rows, allRows, scanning, progress, errors, lastUpdated, scan, stopScan } = useScreener();
  const [tab, setTab] = useState<Tab>("dashboard");
  const [selected, setSelected] = useState<string | null>(null);

  const sectors = useMemo(
    () => Array.from(new Set([...ALL_SECTORS, ...allRows.map((r) => r.sector).filter(Boolean) as string[]])).sort(),
    [allRows],
  );

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-20 border-b border-border bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] items-center gap-3 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <Crosshair size={20} className="text-accent" />
            <div>
              <div className="text-sm font-bold leading-tight">Price Target Hunter</div>
              <div className="text-[11px] text-muted leading-tight">
                {lastUpdated ? `Updated ${timeAgo(lastUpdated)}` : "Never scanned"} · {allRows.length}/{settings.universe.length} loaded
              </div>
            </div>
          </div>

          <nav className="ml-4 hidden items-center gap-1 md:flex">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
                  tab === t.id ? "bg-surface-2 text-fg" : "text-muted hover:text-fg"
                }`}
              >
                <t.icon size={15} />
                {t.label}
              </button>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => downloadCsv("price-target-hunter.csv", rows)}>
              <Download size={14} /> <span className="hidden sm:inline">Export CSV</span>
            </Button>
            <Button variant="primary" size="sm" onClick={() => void scan(true)} disabled={scanning}>
              <RefreshCw size={14} className={scanning ? "animate-spin" : ""} />
              {scanning ? `${progress.done}/${progress.total}` : "Scan"}
            </Button>
            {scanning ? (
              <Button variant="danger" size="sm" onClick={stopScan} title="Stop scan">
                <Square size={13} />
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="icon"
              title="Toggle theme"
              onClick={() => updateSettings({ theme: settings.theme === "dark" ? "light" : "dark" })}
            >
              {settings.theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </Button>
          </div>
        </div>
        {scanning ? <ProgressBar value={progress.done} max={progress.total} /> : null}
      </header>

      <nav className="flex items-center gap-1 border-b border-border px-4 py-1.5 md:hidden">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 rounded-md px-2 py-1.5 text-xs transition-colors ${
              tab === t.id ? "bg-surface-2 text-fg" : "text-muted"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="mx-auto w-full max-w-[1500px] flex-1 px-4 py-4">
        {errors.length ? (
          <div className="mb-3 rounded-lg border border-warn/30 bg-warn/10 px-3 py-2 text-xs text-warn">
            {errors.length} symbol{errors.length === 1 ? "" : "s"} failed to load ({errors.slice(0, 5).map((e) => e.symbol).join(", ")}
            {errors.length > 5 ? "…" : ""}). Check the data source settings or try again.
          </div>
        ) : null}

        {tab === "dashboard" ? <Dashboard rows={allRows} lastUpdated={lastUpdated} onSelect={setSelected} /> : null}

        {tab === "screener" ? (
          <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
            <aside className="rounded-xl border border-border bg-surface lg:sticky lg:top-16 lg:max-h-[calc(100vh-5rem)] lg:overflow-y-auto">
              <FiltersPanel
                filters={settings.filters}
                sectors={sectors}
                onChange={updateFilters}
                onReset={() => updateFilters(DEFAULT_FILTERS)}
              />
            </aside>
            <div className="overflow-hidden rounded-xl border border-border bg-surface">
              <div className="flex items-center justify-between border-b border-border px-4 py-2 text-xs text-muted">
                <span>{rows.length} matches</span>
                <span>Click a row for details</span>
              </div>
              <ScreenerTable rows={rows} onSelect={setSelected} />
            </div>
          </div>
        ) : null}

        {tab === "watchlist" ? <WatchlistView rows={allRows} onSelect={setSelected} /> : null}
        {tab === "settings" ? <SettingsPanel /> : null}
      </main>

      <footer className="border-t border-border px-4 py-3 text-center text-[11px] text-muted">
        Data from Yahoo Finance, Financial Modeling Prep and Finnhub. For research only — not investment advice.
      </footer>

      <StockDetail symbol={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
