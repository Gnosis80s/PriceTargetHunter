import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ScreenerRow } from "../lib/types";
import { applyFilters } from "../lib/screener";
import { scanUniverse } from "../providers";
import { toRow } from "../lib/scoring";
import { useApp } from "../store/AppStore";

export function notify(title: string, body: string) {
  try {
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification(title, { body });
    }
  } catch {
    /* notifications unsupported */
  }
}

export async function ensureNotificationPermission(): Promise<boolean> {
  try {
    if (typeof Notification === "undefined") return false;
    if (Notification.permission === "granted") return true;
    if (Notification.permission === "denied") return false;
    return (await Notification.requestPermission()) === "granted";
  } catch {
    return false;
  }
}

export function useScreener() {
  const { settings, recordSnapshots, isWatched } = useApp();
  const [allRows, setAllRows] = useState<ScreenerRow[]>([]);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [errors, setErrors] = useState<{ symbol: string; message: string }[]>([]);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const scanningRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const prevUpsideRef = useRef<Map<string, number> | null>(null);
  const didInit = useRef(false);

  const rows = useMemo(() => applyFilters(allRows, settings.filters), [allRows, settings.filters]);

  const postWebhook = useCallback(
    (payload: unknown) => {
      if (!settings.webhookUrl) return;
      void fetch(settings.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).catch(() => undefined);
    },
    [settings.webhookUrl],
  );

  const detectAlerts = useCallback(
    (rows: ScreenerRow[]) => {
      const prev = prevUpsideRef.current;
      const next = new Map<string, number>();
      const alerts: string[] = [];

      for (const r of rows) {
        if (r.upsidePct != null) next.set(r.symbol, r.upsidePct);
        if (!prev || !settings.notifications) continue;
        const old = prev.get(r.symbol);
        if (r.upsidePct != null && r.upsidePct >= settings.alertMinNewUpside && (old == null || old < settings.alertMinNewUpside)) {
          alerts.push(`${r.symbol} entered high-upside screen at +${r.upsidePct.toFixed(1)}%`);
        }
        if (isWatched(r.symbol) && old != null && r.upsidePct != null && Math.abs(r.upsidePct - old) >= 5) {
          alerts.push(`${r.symbol} upside moved ${old.toFixed(1)}% → ${r.upsidePct.toFixed(1)}%`);
        }
      }

      prevUpsideRef.current = next;
      for (const a of alerts) {
        notify("Price Target Hunter", a);
        postWebhook({ type: "alert", message: a, at: Date.now() });
      }
    },
    [settings.notifications, settings.alertMinNewUpside, isWatched, postWebhook],
  );

  const scan = useCallback(
    async (bypassCache = false) => {
      if (scanningRef.current) return;
      scanningRef.current = true;
      abortRef.current = new AbortController();
      setScanning(true);
      setErrors([]);
      setAllRows([]);
      setProgress({ done: 0, total: settings.universe.length });
      try {
        const res = await scanUniverse(
          settings.universe,
          settings,
          (done, total) => setProgress({ done, total }),
          {
            bypassCache,
            signal: abortRef.current.signal,
            onRow: (stock) => setAllRows((prev) => [...prev, toRow(stock)]),
          },
        );
        const mapped = res.rows.map(toRow);
        setAllRows(mapped);
        setErrors(res.errors);
        setLastUpdated(Date.now());
        recordSnapshots(res.rows);
        detectAlerts(mapped);
      } finally {
        setScanning(false);
        scanningRef.current = false;
        abortRef.current = null;
      }
    },
    [settings, recordSnapshots, detectAlerts],
  );

  const stopScan = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    void scan(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!settings.autoRefresh) return;
    const ms = Math.max(1, settings.refreshMinutes) * 60_000;
    const id = setInterval(() => void scan(true), ms);
    return () => clearInterval(id);
  }, [settings.autoRefresh, settings.refreshMinutes, scan]);

  return { rows, allRows, scanning, progress, errors, lastUpdated, scan, stopScan };
}
