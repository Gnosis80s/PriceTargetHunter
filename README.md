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

- **Screener** — sortable table with upside %, risk/reward, analyst coverage,
  consensus, 90-day target momentum, composite score and market cap.
- **Filters** — min upside, min/max analysts, market-cap and price ranges,
  sector, minimum consensus rating, minimum risk/reward, recent-upgrades-only.
- **Dashboard** — top opportunities, sector heat map of average upside, trending
  upgrades, KPI tiles.
- **Stock detail** — price vs consensus target chart, historical target moves
  (built from locally stored snapshots), ratings breakdown, key metrics, recent
  analyst actions and news headlines.
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

The dev server includes a small Yahoo Finance proxy (`vite-plugin-yahoo.ts`) so
you do **not** need an API key to get started. Yahoo requires a session cookie +
"crumb" token and sends no CORS headers, so the proxy performs that handshake on
the server and exposes:

```
/api/yahoo/quoteSummary?symbol=AAPL
/api/yahoo/chart?symbol=AAPL&range=1y&interval=1d
/api/yahoo/search?q=AAPL
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

## Data sources

| Source | Key? | Endpoints used | Free-tier notes |
| --- | --- | --- | --- |
| **Yahoo Finance** | No | `quoteSummary` (price, targets, ratings, upgrades), `chart`, `search` | Unofficial, cookie+crumb. Rate-limit friendly usage only. |
| **Financial Modeling Prep** | Yes | `quote`, `profile`, `price-target-consensus`, `grades-consensus`, `price-target` | ~250 calls/day on free tier. Tries `/stable` then legacy `/api/v3`. |
| **Finnhub** | Yes | `quote`, `stock/price-target`, `stock/recommendation`, `stock/profile2`, `stock/upgrade-downgrade`, `stock/metric` | 60 calls/min. |

Get keys at <https://site.financialmodelingprep.com/developer/docs> and
<https://finnhub.io>. Paste them into **Settings → Data sources** (stored only in
your browser's `localStorage`).

### Rate limiting & caching

- A token-bucket limiter per provider (`src/lib/concurrency.ts`) plus a bounded
  worker pool (`mapLimit`, default 5 concurrent requests).
- Every symbol response is cached for **15 minutes** in `localStorage`
  (`src/lib/cache.ts`). The **Scan** button bypasses the cache; the initial load
  and auto-refresh respect it.
- Reduce **Settings → Concurrent requests** if you hit limits.

---

## How upside, risk/reward and score are computed

`src/lib/scoring.ts`:

```
Upside %        = (targetMean − price) / price × 100
Risk / reward   = (targetMean − price) / (price − targetLow)
Momentum        = #upgrades + #initiations − #downgrades over the last 90 days
```

Composite **score (0–100)**:

```
45%  upside score        (upside / 60%, capped)
20%  consensus score     (Strong Buy 1 → Strong Sell 5)
20%  momentum score      (50 ± recent upgrades)
15%  coverage score      (analyst count / 20, capped)
```

---

## Project structure

```
price-target-hunter/
├─ index.html
├─ vite.config.ts              # Vite + Tailwind + Yahoo proxy plugin
├─ vite-plugin-yahoo.ts        # dev/preview Yahoo cookie+crumb proxy
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
   │  └─ finnhub.ts            # Finnhub adapter
   ├─ lib/
   │  ├─ types.ts              # StockData, ScreenerRow, Filters, Settings…
   │  ├─ scoring.ts            # upside / risk-reward / momentum / score
   │  ├─ screener.ts           # applyFilters + sortRows
   │  ├─ cache.ts              # localStorage TTL cache
   │  ├─ concurrency.ts        # mapLimit + RateLimiter
   │  ├─ csv.ts                # CSV export
   │  ├─ defaults.ts           # default settings & filters
   │  └─ utils.ts              # formatting helpers
   ├─ data/
   │  ├─ universe.ts           # default ~70-symbol US universe
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

1. **Backend mode** — run a tiny server (Express/FastAPI) that implements the
   three `/api/yahoo/*` routes (see `vite-plugin-yahoo.ts`) and reverse-proxy it
   from your host. This keeps keyless Yahoo data working.
2. **Key-only mode** — configure FMP and/or Finnhub keys; the app works fully
   client-side against their CORS-enabled APIs.

---

## Roadmap

- Live universe discovery (Yahoo predefined screeners, FMP `stock-screener`)
  instead of the seeded list.
- Sector/industry enrichment for every row in a single batch call.
- Backtesting: historical accuracy of each analyst's targets.
- Local SQLite/IndexedDB snapshot history for longer target timelines.
- LLM-generated bull/bear summaries per name.
- Portfolio simulator ("buy today's top 10, expected upside").
- Electron/Tauri packaging and background alert daemon.
- International listings.
