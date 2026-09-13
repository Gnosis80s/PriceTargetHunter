import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Star, X } from "lucide-react";
import type { NewsItem, YahooChartPoint } from "../providers/yahoo";
import { fetchYahooChart, fetchYahooNews } from "../providers/yahoo";
import { fetchSentiment, type NewsSentiment } from "../providers/sentiment";
import { fetchStock } from "../providers";
import type { StockData } from "../lib/types";
import { toRow, confidenceParts } from "../lib/scoring";
import { runningTargetAverage } from "../lib/history";
import { useApp } from "../store/AppStore";
import { Badge, Button, Dialog, InfoTip } from "./ui";
import { ErrorBoundary } from "./ErrorBoundary";
import { MultiLineChart, type Series } from "./LineChart";
import { fmtCompact, fmtMoney, fmtNum, fmtPct, recLabel, timeAgo } from "../lib/utils";
import { GLOSSARY } from "../lib/glossary";

function Stat({ label, value, tone, tip }: { label: string; value: string; tone?: "good" | "bad"; tip?: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface-2 px-3 py-2">
      <div className="text-[11px] text-muted">{tip ? <InfoTip tip={tip}>{label}</InfoTip> : label}</div>
      <div className={`mt-0.5 text-sm font-semibold tabular ${tone === "good" ? "text-good" : tone === "bad" ? "text-bad" : ""}`}>
        {value}
      </div>
    </div>
  );
}

function pct1(v?: number): string {
  return v == null ? "—" : `${(v * 100).toFixed(1)}%`;
}

export function StockDetail({ symbol, onClose }: { symbol: string | null; onClose: () => void }) {
  const { settings, snapshots, isWatched, addWatch, removeWatch } = useApp();
  const [stock, setStock] = useState<StockData | null>(null);
  const [chart, setChart] = useState<YahooChartPoint[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [sentiment, setSentiment] = useState<NewsSentiment | null>(null);
  const [loading, setLoading] = useState(false);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartError, setChartError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!symbol) return;
    let active = true;
    setLoading(true);
    setStock(null);
    setChart([]);
    setNews([]);
    setSentiment(null);
    setChartError(false);
    void (async () => {
      const { data } = await fetchStock(symbol, settings).catch(() => ({ data: null as unknown as StockData }));
      if (active && data) setStock(data);
      if (settings.yahooEnabled) {
        setChartLoading(true);
        const chartPromise = fetchYahooChart(symbol, "1y", "1d")
          .then((r) => ({ ok: true as const, points: r }))
          .catch(() => ({ ok: false as const, points: [] as YahooChartPoint[] }));
        const [c, n, s] = await Promise.all([
          chartPromise,
          fetchYahooNews(symbol).catch(() => []),
          fetchSentiment(symbol, settings).catch(() => null),
        ]);
        if (active) {
          setChart(c.points);
          setChartError(!c.ok);
          setNews(n);
          setSentiment(s);
          setChartLoading(false);
        }
      }
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [symbol, settings, reloadKey]);

  const row = useMemo(
    () => (stock ? toRow(stock, settings.scoreWeights) : null),
    [stock, settings.scoreWeights],
  );

  const conf = useMemo(
    () => (stock ? confidenceParts(stock, row?.dispersion ?? null) : null),
    [stock, row?.dispersion],
  );

  const series = useMemo<Series[]>(() => {
    const out: Series[] = [];
    if (chart.length) {
      out.push({ name: "Price", color: "#3b82f6", points: chart.map((p) => ({ t: p.t, v: p.close })) });
      if (stock?.targetMean) {
        out.push({
          name: "Target",
          color: "#22c55e",
          points: chart.map((p) => ({ t: p.t, v: stock.targetMean as number })),
        });
      }
    }

    // Consensus target trajectory from dated analyst actions (available now).
    const fromActions = runningTargetAverage(stock?.targetChanges);
    if (fromActions.length >= 2) {
      out.push({ name: "Target history", color: "#f59e0b", points: fromActions });
    }

    // Longer timeline from locally stored snapshots (accumulates over time).
    const snaps = (snapshots[symbol ?? ""] ?? []).filter((s) => s.targetMean != null);
    if (snaps.length >= 2) {
      out.push({
        name: "Stored avg target",
        color: "#94a3b8",
        points: snaps.map((s) => ({ t: s.date, v: s.targetMean as number })),
      });
    }
    return out;
  }, [chart, stock, snapshots, symbol]);

  const ratings = useMemo(() => {
    if (!stock) return [];
    const data = [
      { label: "Strong Buy", value: stock.strongBuy ?? 0, tone: "good" as const },
      { label: "Buy", value: stock.buy ?? 0, tone: "good" as const },
      { label: "Hold", value: stock.hold ?? 0, tone: "warn" as const },
      { label: "Sell", value: stock.sell ?? 0, tone: "bad" as const },
      { label: "Strong Sell", value: stock.strongSell ?? 0, tone: "bad" as const },
    ];
    const total = data.reduce((a, b) => a + b.value, 0) || 1;
    return data.map((d) => ({ ...d, pct: (d.value / total) * 100 }));
  }, [stock]);

  const changes = useMemo(
    () => (stock?.targetChanges ?? []).filter((c) => Date.now() - c.date < 180 * 864e5).slice(0, 12),
    [stock],
  );

  const consensusTrend = useMemo(() => {
    const snaps = (snapshots[symbol ?? ""] ?? []).filter((s) => s.targetMean != null);
    if (snaps.length < 2) return null;
    const cutoff = Date.now() - 30 * 864e5;
    const recent = snaps.filter((s) => s.date >= cutoff);
    const base = recent.length ? recent[0] : snaps[0];
    const last = snaps[snaps.length - 1];
    if (base.targetMean == null || last.targetMean == null || base.targetMean <= 0) return null;
    return {
      pct: ((last.targetMean - base.targetMean) / base.targetMean) * 100,
      days: Math.max(0, Math.round((last.date - base.date) / 864e5)),
    };
  }, [snapshots, symbol]);

  if (!symbol) return null;
  const watched = isWatched(symbol);

  return (
    <Dialog open={!!symbol} onClose={onClose} wide>
      <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold">{symbol}</h2>
            {row ? <Badge tone="accent">Score {fmtNum(row.score, 0)}</Badge> : null}
            {stock ? <Badge tone="default">{stock.source}</Badge> : null}
          </div>
          <div className="text-sm text-muted">{stock?.name ?? "Loading…"} {stock?.sector ? `· ${stock.sector}` : ""}</div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => (watched ? removeWatch(symbol) : addWatch(symbol, row?.upsidePct ?? null))}
          >
            <Star size={14} className={watched ? "fill-warn text-warn" : ""} />
            {watched ? "Watching" : "Watch"}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="Open on Yahoo Finance"
            onClick={() => window.open(`https://finance.yahoo.com/quote/${symbol}`, "_blank")}
          >
            <ExternalLink size={16} />
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X size={16} />
          </Button>
        </div>
      </div>

      <div className="max-h-[75vh] overflow-y-auto p-5">
        {loading && !stock ? <div className="text-sm text-muted">Loading {symbol}…</div> : null}

        {stock ? (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="Price" value={fmtMoney(stock.price, stock.currency)} tip={GLOSSARY.price} />
              <Stat label="Avg target" value={fmtMoney(stock.targetMean, stock.currency)} tip={GLOSSARY.avgTarget} />
              <Stat
                label="Upside"
                value={fmtPct(row?.upsidePct)}
                tone={(row?.upsidePct ?? 0) >= 0 ? "good" : "bad"}
                tip={GLOSSARY.upside}
              />
              <Stat label="Risk / reward" value={fmtNum(row?.riskReward, 2)} tip={GLOSSARY.riskReward} />
              <Stat
                label="Dispersion"
                value={row?.dispersion == null ? "—" : `${fmtNum(row.dispersion, 0)}%`}
                tone={row?.dispersion != null && row.dispersion <= 40 ? "good" : undefined}
                tip={GLOSSARY.dispersion}
              />
              <Stat
                label="Confidence"
                value={row?.confidenceScore == null ? "—" : fmtNum(row.confidenceScore, 0)}
                tone={
                  row?.confidenceScore == null
                    ? undefined
                    : row.confidenceScore >= 65
                      ? "good"
                      : row.confidenceScore <= 35
                        ? "bad"
                        : undefined
                }
                tip={GLOSSARY.confidence}
              />
              <Stat
                label="Target Δ (90d)"
                value={row?.targetMomentumPct == null ? "—" : fmtPct(row.targetMomentumPct)}
                tone={row?.targetMomentumPct != null ? (row.targetMomentumPct >= 0 ? "good" : "bad") : undefined}
                tip={GLOSSARY.targetMomentumPct}
              />
              <Stat
                label={consensusTrend ? `Consensus (${consensusTrend.days}d)` : "Consensus trend"}
                value={consensusTrend ? fmtPct(consensusTrend.pct) : "—"}
                tone={consensusTrend ? (consensusTrend.pct >= 0 ? "good" : "bad") : undefined}
                tip={GLOSSARY.consensusTrend}
              />
              <Stat
                label="News sentiment"
                value={sentiment ? `${sentiment.label} (${fmtNum(sentiment.score, 2)})` : "—"}
                tone={sentiment ? (sentiment.score >= 0.15 ? "good" : sentiment.score <= -0.15 ? "bad" : undefined) : undefined}
                tip={GLOSSARY.newsSentiment}
              />
              <Stat label="Analysts" value={stock.analystCount ? String(stock.analystCount) : "—"} tip={GLOSSARY.analysts} />
              <Stat label="Consensus" value={recLabel(stock.recommendationKey, stock.recommendationMean)} tip={GLOSSARY.consensus} />
              <Stat label="Low / High target" value={`${fmtMoney(stock.targetLow)} – ${fmtMoney(stock.targetHigh)}`} tip={GLOSSARY.targetLowHigh} />
              <Stat label="Market cap" value={stock.marketCap ? `$${fmtCompact(stock.marketCap)}` : "—"} tip={GLOSSARY.marketCap} />
            </div>

            {ratings.some((r) => r.value > 0) ? (
              <div className="mt-5">
                <div className="mb-2 text-sm font-semibold">Analyst ratings</div>
                <div className="flex h-3 w-full overflow-hidden rounded-full bg-surface-2">
                  {ratings.map((r) => (
                    <div
                      key={r.label}
                      title={`${r.label}: ${r.value}`}
                      style={{ width: `${r.pct}%` }}
                      className={r.tone === "good" ? "bg-good" : r.tone === "warn" ? "bg-warn" : "bg-bad"}
                    />
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted">
                  {ratings.map((r) => (
                    <span key={r.label}>
                      {r.label}: <span className="text-fg">{r.value}</span> ({r.pct.toFixed(0)}%)
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {row && [row.valueScore, row.qualityScore, row.growthScore, row.healthScore].some((v) => v != null) ? (
              <div className="mt-5">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold">Fundamental factor scores</div>
                  <span className="text-[11px] text-muted">0–100 · blended into Score by your weights</span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {[
                    { label: "Value", value: row.valueScore, tip: GLOSSARY.valueFactor },
                    { label: "Quality", value: row.qualityScore, tip: GLOSSARY.qualityFactor },
                    { label: "Growth", value: row.growthScore, tip: GLOSSARY.growthFactor },
                    { label: "Health", value: row.healthScore, tip: GLOSSARY.healthFactor },
                  ].map((f) => (
                    <div key={f.label} className="rounded-lg border border-border bg-surface-2 px-3 py-2">
                      <div className="flex items-center justify-between text-[11px] text-muted">
                        <InfoTip tip={f.tip}>{f.label}</InfoTip>
                        <span className="tabular font-semibold text-fg">{f.value == null ? "—" : fmtNum(f.value, 0)}</span>
                      </div>
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface">
                        <div
                          className="h-full rounded-full bg-accent"
                          style={{ width: `${f.value ?? 0}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {conf && [conf.agreement, conf.coverage, conf.freshness, conf.participation].some((v) => v != null) ? (
              <div className="mt-5">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold">Consensus confidence</div>
                  <span className="text-[11px] text-muted">How much to trust the average target</span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {[
                    { label: "Agreement", value: conf.agreement, tip: GLOSSARY.confidenceAgreement },
                    { label: "Coverage", value: conf.coverage, tip: GLOSSARY.confidenceCoverage },
                    { label: "Freshness", value: conf.freshness, tip: GLOSSARY.confidenceFreshness },
                    { label: "Participation", value: conf.participation, tip: GLOSSARY.confidenceParticipation },
                  ].map((f) => (
                    <div key={f.label} className="rounded-lg border border-border bg-surface-2 px-3 py-2">
                      <div className="flex items-center justify-between text-[11px] text-muted">
                        <InfoTip tip={f.tip}>{f.label}</InfoTip>
                        <span className="tabular font-semibold text-fg">{f.value == null ? "—" : fmtNum(f.value, 0)}</span>
                      </div>
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface">
                        <div
                          className="h-full rounded-full bg-accent"
                          style={{ width: `${f.value ?? 0}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="text-sm font-semibold">Price vs consensus target (1y)</div>
                {settings.yahooEnabled && chartError ? (
                  <Button size="sm" variant="ghost" onClick={() => setReloadKey((k) => k + 1)}>
                    Retry
                  </Button>
                ) : null}
              </div>
              {!settings.yahooEnabled ? (
                <div className="flex h-40 items-center justify-center rounded-lg border border-border text-xs text-muted">
                  Enable Yahoo Finance in Settings to load price history.
                </div>
              ) : series.length === 0 && chartLoading ? (
                <div className="flex h-40 items-center justify-center rounded-lg border border-border text-xs text-muted">
                  Loading chart…
                </div>
              ) : series.length === 0 ? (
                <div className="flex h-40 flex-col items-center justify-center gap-1 rounded-lg border border-bad/30 bg-bad/5 px-4 text-center text-xs text-bad">
                  <span>No chart data available for {symbol}.</span>
                  <span className="text-muted">
                    {chartError ? "Yahoo price history failed (often a temporary rate limit)." : "No analyst target history found."}
                  </span>
                  {chartError ? (
                    <Button size="sm" variant="secondary" className="mt-1" onClick={() => setReloadKey((k) => k + 1)}>
                      Retry
                    </Button>
                  ) : null}
                </div>
              ) : (
                <>
                  {chartError ? (
                    <div className="mb-2 rounded-md border border-warn/30 bg-warn/10 px-2 py-1 text-[11px] text-warn">
                      Price history unavailable — showing target history only.
                    </div>
                  ) : null}
                  <ErrorBoundary label="Couldn't render the chart">
                    <MultiLineChart series={series} height={200} />
                  </ErrorBoundary>
                </>
              )}
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="Trailing P/E" value={fmtNum(stock.trailingPE)} tip={GLOSSARY.trailingPE} />
              <Stat label="Forward P/E" value={fmtNum(stock.forwardPE)} tip={GLOSSARY.forwardPE} />
              <Stat label="Price / book" value={fmtNum(stock.priceToBook)} tip={GLOSSARY.priceToBook} />
              <Stat label="Price / sales" value={fmtNum(stock.priceToSales)} tip={GLOSSARY.priceToSales} />
              <Stat label="PEG ratio" value={fmtNum(stock.pegRatio)} tip={GLOSSARY.pegRatio} />
              <Stat label="EV / EBITDA" value={fmtNum(stock.enterpriseToEbitda)} tip={GLOSSARY.evEbitda} />
              <Stat
                label="FCF yield"
                value={stock.fcfYield != null ? pct1(stock.fcfYield) : "—"}
                tip={GLOSSARY.fcfYield}
              />
              <Stat label="EPS" value={fmtNum(stock.eps)} tip={GLOSSARY.eps} />
              <Stat
                label="Earnings growth"
                value={pct1(stock.earningsGrowth)}
                tone={(stock.earningsGrowth ?? 0) >= 0 ? "good" : "bad"}
                tip={GLOSSARY.earningsGrowth}
              />
              <Stat label="Revenue growth" value={pct1(stock.revenueGrowth)} tip={GLOSSARY.revenueGrowth} />
              <Stat label="Return on equity" value={pct1(stock.returnOnEquity)} tip={GLOSSARY.returnOnEquity} />
              <Stat label="Return on assets" value={pct1(stock.returnOnAssets)} tip={GLOSSARY.returnOnAssets} />
              <Stat label="Gross margin" value={pct1(stock.grossMargin)} tip={GLOSSARY.grossMargin} />
              <Stat label="Operating margin" value={pct1(stock.operatingMargin)} tip={GLOSSARY.operatingMargin} />
              <Stat label="Net margin" value={pct1(stock.netMargin)} tip={GLOSSARY.netMargin} />
              <Stat label="Debt / equity" value={fmtNum(stock.debtToEquity)} tip={GLOSSARY.debtToEquity} />
              <Stat label="Current ratio" value={fmtNum(stock.currentRatio)} tip={GLOSSARY.currentRatio} />
              <Stat
                label="Net debt / EBITDA"
                value={fmtNum(stock.netDebtToEbitda)}
                tip={GLOSSARY.netDebtToEbitda}
              />
              <Stat label="Interest cover" value={fmtNum(stock.interestCoverage)} tip={GLOSSARY.interestCoverage} />
              <Stat label="Free cash flow" value={fmtCompact(stock.freeCashFlow)} tip={GLOSSARY.freeCashFlow} />
              <Stat label="Volume" value={fmtCompact(stock.volume)} tip={GLOSSARY.volume} />
              <Stat label="Avg volume" value={fmtCompact(stock.avgVolume)} tip={GLOSSARY.avgVolume} />
              <Stat label="Industry" value={stock.industry ?? "—"} tip={GLOSSARY.industry} />
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <div>
                <div className="mb-2 text-sm font-semibold">Recent analyst actions (180d)</div>
                <div className="flex flex-col divide-y divide-border/60 rounded-lg border border-border">
                  {changes.length ? (
                    changes.map((c, i) => (
                      <div key={i} className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
                        <div>
                          <div className="font-medium">{c.firm}</div>
                          <div className="text-muted">
                            {c.from ? `${c.from} → ` : ""}
                            {c.to ?? c.action}
                            {c.toTarget != null ? (
                              <span className={c.fromTarget && c.toTarget > c.fromTarget ? "text-good" : c.fromTarget && c.toTarget < c.fromTarget ? "text-bad" : ""}>
                                {"  ·  "}
                                {c.fromTarget != null ? `${fmtMoney(c.fromTarget)} → ` : ""}
                                {fmtMoney(c.toTarget)}
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            tone={
                              c.priceTargetAction === "Raises" || c.action === "up"
                                ? "good"
                                : c.priceTargetAction === "Lowers" || c.action === "down"
                                  ? "bad"
                                  : "default"
                            }
                          >
                            {c.priceTargetAction ?? c.action}
                          </Badge>
                          <span className="text-muted">{timeAgo(c.date)}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="px-3 py-4 text-xs text-muted">No recent actions available.</div>
                  )}
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold">News</div>
                  {sentiment ? (
                    <span className="text-right text-[11px] text-muted">
                      {sentiment.source === "alphavantage" ? "Alpha Vantage" : "Finnhub"}
                      {sentiment.bullishPct != null
                        ? ` · ${sentiment.bullishPct.toFixed(0)}% bullish / ${(sentiment.bearishPct ?? 0).toFixed(0)}% bearish`
                        : ""}
                      {sentiment.articles ? ` · ${sentiment.articles} articles` : ""}
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-col divide-y divide-border/60 rounded-lg border border-border">
                  {sentiment?.top.length ? (
                    sentiment.top.map((a, i) => (
                      <a
                        key={i}
                        href={a.url}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-2 text-xs transition-colors hover:bg-surface-2"
                      >
                        <div className="font-medium">{a.title}</div>
                        <div className="mt-0.5 flex items-center gap-2 text-muted">
                          <span>
                            {a.source} · {a.time ? timeAgo(a.time) : ""}
                          </span>
                          <Badge tone={a.score >= 0.15 ? "good" : a.score <= -0.15 ? "bad" : "default"}>
                            {a.label}
                          </Badge>
                        </div>
                      </a>
                    ))
                  ) : news.length ? (
                    news.slice(0, 6).map((n, i) => (
                      <a
                        key={i}
                        href={n.link}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-2 text-xs transition-colors hover:bg-surface-2"
                      >
                        <div className="font-medium">{n.title}</div>
                        <div className="text-muted">
                          {n.publisher} · {n.publishedAt ? timeAgo(n.publishedAt) : ""}
                        </div>
                      </a>
                    ))
                  ) : (
                    <div className="px-3 py-4 text-xs text-muted">
                      {settings.alphaVantageApiKey || settings.finnhubApiKey
                        ? "No headlines available."
                        : "Add an Alpha Vantage or Finnhub key in Settings to score headlines."}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </Dialog>
  );
}
