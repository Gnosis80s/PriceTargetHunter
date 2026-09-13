# Price Target Hunter

A dark-mode-first web app that scans the market for stocks trading **below their
consensus analyst price target**, ranks them by upside, risk/reward and analyst
conviction, and surfaces the highest-conviction opportunities.

Built for the MVP as a **Vite + React + TypeScript + Tailwind** single-page app
with a **hybrid data layer**:

```
Yahoo Finance (no key, via dev proxy)  →  FMP (key)  →  Finnhub (key)  →  bundled demo data
```

Every provider is best-effort. If one fails or lacks price-target data the next
one is tried, and missing fields are merged in. If everything fails the app
falls back to a bundled offline dataset so the UI is never empty.

> For research only. Not investment advice.

---

## Features

- **Screener** — sortable table with upside %, risk/reward, target dispersion,
  analyst coverage, consensus, price-target momentum, composite score,
  **value / quality / growth / health factor scores** and market cap.
- **Signals** — target dispersion (agreement), price-target revision momentum,
  and a consensus trend built from stored snapshots.
- **Fundamentals factor block** — value, quality, growth and health scores
  (0–100) computed from valuation, profitability, growth and balance-sheet
  metrics, folded into the composite score with configurable weights
  (Settings → Score weights) and shown per-metric in the stock detail view.
- **Metric tooltips** — hover (or keyboard-focus) any financial metric for a
  plain-language explanation, so non-experts can interpret the numbers.
- **News sentiment** — per-article and aggregate bullish/bearish scores (Alpha
  Vantage, or Finnhub news-sentiment) shown in the stock detail view.
- **Universe presets** — Curated (~70) or **S&P 500 (~503)**, plus paste your own
  list. Results **stream in as they load**, with a stop button for long scans.
- **Filters** — min upside, min/max analysts, market-cap and price ranges,
  sector, minimum consensus rating, minimum risk/reward, maximum target
  dispersion, recent-upgrades-only.
- **Dashboard** — top opportunities, sector heat map of average upside, trending
  upgrades, KPI tiles.
- **Stock detail** — price vs consensus target chart with a target-history line
  built from dated analyst actions (shows on day one), plus a stored-snapshot
  line for longer timelines. Loading/error/retry states, ratings breakdown, key
  metrics, recent analyst actions and news headlines.
- **Watchlist** — save symbols, see upside change since you added them.
- **Alerts** — desktop notifications and configurable JSON webhooks when a
  watched name moves or a new high-upside name appears.
- **CSV export**, configurable auto-refresh, dark/light theme, offline cache.

---

## Quick start

```bash
cd price-target-hunter
npm install
npm run dev        # http://localhost:5173
```

The dev server includes a Yahoo Finance proxy (`vite-plugin-yahoo.ts`) so you do
**not** need an API key to get started. Yahoo sends no CORS headers and needs a
session cookie + "crumb" token, so the proxy does the work server-side using the
[`yahoo-finance2`](https://github.com/gadicc/node-yahoo-finance2) library
(cookies, crumb, validation, retries and request queueing handled for you) and
exposes:

```
/api/yahoo/quoteSummary?symbol=AAPL&modules=price,financialData,...
/api/yahoo/chart?symbol=AAPL&range=1y&interval=1d
/api/yahoo/search?q=AAPL
/api/yahoo/quote?symbols=AAPL,MSFT,NVDA
```

If Yahoo is rate-limiting your IP (or you are offline), the app automatically
shows the bundled demo dataset. Put FMP / Finnhub keys in **Settings** for a
second and third live source.

```bash
npm run typecheck  # tsc --noEmit
npm run build      # production build to dist/
npm run preview    # serve the production build (proxy still active)
```

---

## Desktop launcher (Omarchy)

Launch it from the **Omarchy Apps menu** like any other app:

```bash
./install.sh
```

This installs:

| Path | Purpose |
| --- | --- |
| `~/.local/bin/price-target-hunter` | launcher script |
| `~/.local/share/applications/price-target-hunter.desktop` | Apps menu entry |
| `~/.local/share/icons/hicolor/scalable/apps/price-target-hunter.svg` | themed icon |
| `~/.config/price-target-hunter/home` | remembers this checkout's location |

The launcher starts the Vite dev server in the background (port `5199`, logging
to `~/.local/state/price-target-hunter/server.log`) and opens the UI via
`omarchy-launch-webapp`. The server stays up for fast relaunches:

```bash
price-target-hunter            # launch
price-target-hunter --stop     # stop the background server
price-target-hunter --restart  # restart then relaunch
PTH_PORT=6000 price-target-hunter   # use a different port
```

If the checkout moves, re-run `./install.sh` (or set `PRICE_TARGET_HUNTER_HOME`).

---

## Data sources

| Source | Key? | Endpoints used | Free-tier notes |
| --- | --- | --- | --- |
| **Yahoo Finance** | No | `quoteSummary` (price, targets, ratings, upgrades), `chart`, `search`, `quote` — via [`yahoo-finance2`](https://github.com/gadicc/node-yahoo-finance2) | Unofficial. Cookie/crumb, retries and queueing handled by the library. Rate-limit friendly usage only. |
| **Financial Modeling Prep** | Yes | `quote`, `profile`, `price-target-consensus`, `grades-consensus`, `price-target` | ~250 calls/day on free tier. Tries `/stable` then legacy `/api/v3`. |
| **Finnhub** | Yes | `quote`, `stock/price-target`, `stock/recommendation`, `stock/profile2`, `stock/upgrade-downgrade`, `stock/metric`, `news-sentiment` | 60 calls/min. |
| **Alpha Vantage** | Yes | `NEWS_SENTIMENT` (per-article ticker sentiment) | Optional. ~25 calls/day free — used on demand in the detail view, cached 6h. |

Get keys at <https://site.financialmodelingprep.com/developer/docs>,
<https://finnhub.io>, and <https://www.alphavantage.co/support/#api-key>. Paste
them into **Settings → Data sources** (stored only in your browser's
`localStorage`). News sentiment uses Alpha Vantage when its key is set, and
falls back to Finnhub's `news-sentiment` endpoint otherwise.

### Rate limiting & caching

- A token-bucket limiter per provider (`src/lib/concurrency.ts`, ~300/min for
  Yahoo) plus a bounded worker pool (`mapLimit`, default 5 concurrent requests).
- Every symbol response is cached for **15 minutes** in `localStorage`
  (`src/lib/cache.ts`). The **Scan** button bypasses the cache; the initial load
  and auto-refresh respect it.
- Roughly: S&P 500 (~503 names) takes ~1.5–2.5 min from cold, seconds when
  cached. Results appear as they load; use the stop button to halt a scan.
- Reduce **Settings → Concurrent requests** if you hit limits.

---

## Signals, upside and scoring

`src/lib/scoring.ts`:

```
Upside %          = (targetMean − price) / price × 100
Risk / reward     = (targetMean − price) / (price − targetLow)
Dispersion %      = (targetHigh − targetLow) / targetMean × 100   (uncertainty)
Target Δ %        = average % change of analyst price targets (90d)
Momentum          = Σ price-target revisions (a 5% raise ≈ +1) ± grade changes (90d)
```

Price-target revisions dominate momentum; grade-only changes fall back to ±1.
Older than 90 days is ignored and a single revision is capped at ±3.

Composite **score (0–100)** — a weighted blend of nine components, all
normalised to 0–100. Missing metrics are dropped and the remaining weights
renormalised, so a gap never silently drags the score down:

```
target / analyst factors (default 70%)
  30%  upside score        (upside / 60%, capped)
  12%  consensus score     (Strong Buy 1 → Strong Sell 5)
  12%  momentum score      (50 ± recent target revisions)
   8%  coverage score      (analyst count / 20, capped)
   8%  agreement score     (100 − dispersion × 0.8)

fundamentals factors (default 30%)
  10%  value score         (P/E, P/B, P/S, EV/EBITDA, PEG, FCF yield, dividend yield)
  10%  quality score       (ROE, ROA, gross / operating / net margin)
   6%  growth score        (revenue, earnings and EPS growth)
   4%  health score        (debt/equity, current ratio, net-debt/EBITDA, interest cover, FCF)
```

All nine weights are **configurable in Settings → Score weights** (relative,
normalised by their sum). Fundamentals are sourced from Yahoo `financialData` /
`defaultKeyStatistics`, Finnhub `stock/metric` and FMP `ratios-ttm` /
`key-metrics-ttm` / `financial-growth`; whichever provider supplies a field
wins, and absent fields simply drop out of that factor.

The screener surfaces `Disp` (dispersion), `Tgt Δ` (target momentum) and the
four factor scores (`Val`, `Qual`, `Grw`, `Hlth`) — all sortable — plus a
**Max dispersion** filter, and a **Consensus trend (30d)** in the detail view
computed from locally stored snapshots. Providers are retried with exponential
backoff, and failed symbols can be inspected (with per-provider reasons) from
the banner above the results.

Unit tests cover scoring, momentum, filters and CSV export:

```bash
npm test   # vitest
```

---

## Project structure

```
price-target-hunter/
├─ index.html
├─ vite.config.ts              # Vite + Tailwind + Yahoo proxy plugin
├─ vite-plugin-yahoo.ts        # dev/preview Yahoo proxy (yahoo-finance2)
└─ src/
   ├─ main.tsx                 # React entry
   ├─ App.tsx                  # Shell, tabs, scan controls, export
   ├─ index.css                # Tailwind v4 theme tokens (dark/light)
   ├─ components/
   │  ├─ ui.tsx                # Button, Card, Input, Badge, Dialog, Switch…
   │  ├─ Dashboard.tsx         # KPIs, top opportunities, sector heat map
   │  ├─ ScreenerTable.tsx     # sortable results table
   │  ├─ FiltersPanel.tsx      # filter controls
   │  ├─ StockDetail.tsx       # detail dialog (charts, ratings, news)
   │  ├─ WatchlistView.tsx     # saved symbols + change since added
   │  ├─ SettingsPanel.tsx     # sources, keys, alerts, universe
   │  └─ LineChart.tsx         # dependency-free SVG multi-line chart
   ├─ hooks/
   │  ├─ useScreener.ts        # scan orchestration, auto-refresh, alerts
   │  └─ usePersistentState.ts # localStorage-backed useState
   ├─ providers/
   │  ├─ index.ts              # hybrid orchestration + fallback + merge
   │  ├─ yahoo.ts              # Yahoo Finance adapter
   │  ├─ fmp.ts                # Financial Modeling Prep adapter
   │  ├─ finnhub.ts            # Finnhub adapter
   │  └─ sentiment.ts          # news sentiment (Alpha Vantage / Finnhub)
   ├─ lib/
    │  ├─ types.ts              # StockData, ScreenerRow, Filters, Settings…
    │  ├─ scoring.ts            # upside / risk-reward / momentum / factors / score
    │  ├─ glossary.ts           # plain-language metric explanations (tooltips)
    │  ├─ history.ts            # target-history series from analyst actions
   │  ├─ screener.ts           # applyFilters + sortRows
   │  ├─ cache.ts              # localStorage TTL cache
   │  ├─ concurrency.ts        # mapLimit + RateLimiter
   │  ├─ csv.ts                # CSV export
   │  ├─ defaults.ts           # default settings & filters
   │  └─ utils.ts              # formatting helpers
    ├─ data/
    │  ├─ universe.ts           # curated ~70-symbol list + UniverseEntry type
    │  ├─ sp500.ts              # bundled S&P 500 constituents (~503)
    │  ├─ presets.ts            # universe presets (Curated / S&P 500)
    │  └─ demo.ts               # offline sample dataset
    └─ store/AppStore.tsx       # settings / watchlist / snapshots context
```

Data model highlights (`src/lib/types.ts`): `StockData` is the canonical,
provider-agnostic record; `ScreenerRow` adds computed `upsidePct`, `riskReward`,
`momentum`, `score`. `TargetSnapshot` powers the historical target chart.

---

## UI wireframe

```
┌─────────────────────────────────────────────────────────────────────┐
│ ◎ Price Target Hunter   Dashboard Screener Watchlist Settings        │
│        Updated 2m ago · 70/70 loaded        [Export CSV] [Scan] [☀]  │
│─────────────────────────────────────────────────────────────────────│
│  Stocks w/ targets   Avg upside   High conviction   Last scan        │
│        58               +27.4%          12            2m ago         │
│ ┌───────────────────────────────┐ ┌────────────────────────────────┐ │
│ │ Top opportunities             │ │ Sector heat map                │ │
│ │ 1 MRNA   12 analysts  +129%   │ │ Health Care +62%  Tech +41%    │ │
│ │ 2 PYPL   31 analysts  +42%    │ │ Financials +34%   Energy +18%  │ │
│ │ …                             │ └────────────────────────────────┘ │
│ └───────────────────────────────┘                                    │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ Trending upgrades:  NVDA +12  AMD +7  AMZN +10 …                 │ │
│ └─────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

Screener tab = filter sidebar (left) + results table. Clicking a row opens the
detail dialog with the 1-year price/target chart, ratings bar, metrics, analyst
actions and news.

---

## Alerts & webhooks

Enable **Settings → Alerts → Desktop notifications** (the app requests browser
permission). Set the upside threshold for "new high-upside" alerts. A watched
symbol triggers an alert when its upside moves by 5+ percentage points.

Webhooks receive:

```json
{ "type": "alert", "message": "MRNA entered high-upside screen at +129.2%", "at": 1730000000000 }
```

Slack, Discord and Telegram-via-bot-API endpoints accept this JSON shape.

---

## Deploying / production notes

The Yahoo proxy runs in Vite's dev and preview servers. For a static deploy you
have two options:

1. **Backend mode** — run a tiny Node server (Express/Hono/Fastify) that mounts
   the same routes (see `vite-plugin-yahoo.ts`, which is portable — it just needs
   `yahoo-finance2`) and reverse-proxy it from your host. `yahoo-finance2` is
   server-side only and cannot ship to the browser, so this keeps keyless Yahoo
   data working.
2. **Key-only mode** — configure FMP and/or Finnhub keys; the app works fully
   client-side against their CORS-enabled APIs.

---

## Roadmap

- Live universe discovery (Yahoo predefined screeners, FMP `stock-screener`) and
  auto-refresh of index membership instead of bundled constituent lists.
- Sector/industry enrichment for every row in a single batch call.
- Backtesting: historical accuracy of each analyst's targets.
- Local SQLite/IndexedDB snapshot history for longer target timelines.
- LLM-generated bull/bear summaries per name.
- Portfolio simulator ("buy today's top 10, expected upside").
- Electron/Tauri packaging and background alert daemon.
- International listings.
