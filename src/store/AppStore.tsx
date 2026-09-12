import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from "react";
import type { AppSettings, Filters, StockData, TargetSnapshot, WatchlistItem } from "../lib/types";
import { DEFAULT_SETTINGS } from "../lib/defaults";
import { DEFAULT_UNIVERSE } from "../data/universe";
import { defaultPresetSymbols } from "../data/presets";
import { usePersistentState } from "../hooks/usePersistentState";

interface AppContextValue {
  settings: AppSettings;
  updateSettings: (patch: Partial<AppSettings>) => void;
  updateFilters: (patch: Partial<Filters>) => void;
  resetSettings: () => void;
  watchlist: WatchlistItem[];
  addWatch: (symbol: string, entryUpsidePct: number | null) => void;
  removeWatch: (symbol: string) => void;
  isWatched: (symbol: string) => boolean;
  snapshots: Record<string, TargetSnapshot[]>;
  recordSnapshots: (rows: StockData[]) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

const MAX_SNAPSHOTS = 240;

export function AppProvider({ children }: { children: ReactNode }) {
  const [rawSettings, setRawSettings] = usePersistentState<AppSettings>("settings", DEFAULT_SETTINGS);
  const [watchlist, setWatchlist] = usePersistentState<WatchlistItem[]>("watchlist", []);
  const [snapshots, setSnapshots] = usePersistentState<Record<string, TargetSnapshot[]>>("snapshots", {});

  const settings = useMemo<AppSettings>(() => {
    const merged: AppSettings = {
      ...DEFAULT_SETTINGS,
      ...rawSettings,
      filters: { ...DEFAULT_SETTINGS.filters, ...(rawSettings?.filters ?? {}) },
      universe: rawSettings?.universe?.length ? rawSettings.universe : DEFAULT_SETTINGS.universe,
      universePreset: rawSettings?.universePreset ?? DEFAULT_SETTINGS.universePreset,
    };

    // Migrate installs that predate universe presets and were on the old
    // 70-name curated list: upgrade them to the S&P 500 preset.
    if (!rawSettings?.universePreset) {
      const curated = DEFAULT_UNIVERSE.map((u) => u.symbol);
      const current = merged.universe ?? [];
      const looksCurated = current.length === curated.length && curated.every((s) => current.includes(s));
      if (looksCurated) {
        merged.universe = defaultPresetSymbols();
        merged.universePreset = "sp500";
      } else {
        merged.universePreset = "custom";
      }
    }

    return merged;
  }, [rawSettings]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("light", settings.theme === "light");
    root.classList.toggle("dark", settings.theme !== "light");
  }, [settings.theme]);

  const updateSettings = useCallback(
    (patch: Partial<AppSettings>) => setRawSettings((prev) => ({ ...prev, ...patch })),
    [setRawSettings],
  );

  const updateFilters = useCallback(
    (patch: Partial<Filters>) =>
      setRawSettings((prev) => ({ ...prev, filters: { ...prev.filters, ...patch } })),
    [setRawSettings],
  );

  const resetSettings = useCallback(() => setRawSettings(DEFAULT_SETTINGS), [setRawSettings]);

  const addWatch = useCallback(
    (symbol: string, entryUpsidePct: number | null) =>
      setWatchlist((prev) =>
        prev.some((w) => w.symbol === symbol)
          ? prev
          : [...prev, { symbol, addedAt: Date.now(), entryUpsidePct }],
      ),
    [setWatchlist],
  );

  const removeWatch = useCallback(
    (symbol: string) => setWatchlist((prev) => prev.filter((w) => w.symbol !== symbol)),
    [setWatchlist],
  );

  const isWatched = useCallback((symbol: string) => watchlist.some((w) => w.symbol === symbol), [watchlist]);

  const recordSnapshots = useCallback(
    (rows: StockData[]) => {
      const day = new Date().toISOString().slice(0, 10);
      setSnapshots((prev) => {
        const next = { ...prev };
        for (const r of rows) {
          if (r.targetMean == null && r.price == null) continue;
          const list = next[r.symbol] ? [...next[r.symbol]] : [];
          const snap: TargetSnapshot = {
            symbol: r.symbol,
            date: Date.now(),
            targetMean: r.targetMean,
            price: r.price,
            analystCount: r.analystCount,
          };
          const last = list[list.length - 1];
          if (last && new Date(last.date).toISOString().slice(0, 10) === day) {
            list[list.length - 1] = snap;
          } else {
            list.push(snap);
          }
          next[r.symbol] = list.slice(-MAX_SNAPSHOTS);
        }
        return next;
      });
    },
    [setSnapshots],
  );

  const value: AppContextValue = {
    settings,
    updateSettings,
    updateFilters,
    resetSettings,
    watchlist,
    addWatch,
    removeWatch,
    isWatched,
    snapshots,
    recordSnapshots,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
