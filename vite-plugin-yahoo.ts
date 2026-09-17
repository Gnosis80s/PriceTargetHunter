import type { Plugin, Connect } from "vite";
import type { IncomingMessage, ServerResponse } from "node:http";

/**
 * Dev/preview Yahoo Finance proxy backed by the "yahoo-finance2" library.
 *
 * The browser cannot call Yahoo directly (no CORS headers, cookie + crumb
 * handshake required). yahoo-finance2 handles cookies, crumbs, validation,
 * retries and request queueing, so this middleware just exposes clean,
 * same-origin endpoints:
 *
 *   /api/yahoo/quoteSummary?symbol=AAPL&modules=price,financialData,...
 *   /api/yahoo/chart?symbol=AAPL&range=1y&interval=1d
 *   /api/yahoo/search?q=apple
 *   /api/yahoo/quote?symbols=AAPL,MSFT
 *
 * https://github.com/gadicc/node-yahoo-finance2
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
let clientPromise: Promise<any> | null = null;

function getClient(): Promise<any> {
  if (!clientPromise) {
    clientPromise = (async () => {
      const mod = await import("yahoo-finance2");
      const YahooFinance = mod.default;
      return new YahooFinance({
        suppressNotices: ["yahooSurvey", "ripHistorical"],
        versionCheck: false,
      });
    })();
  }
  return clientPromise;
}

const DEFAULT_MODULES = [
  "price",
  "summaryDetail",
  "defaultKeyStatistics",
  "financialData",
  "recommendationTrend",
  "upgradeDowngradeHistory",
  "summaryProfile",
  "earnings",
  "earningsTrend",
].join(",");

const RANGE_DAYS: Record<string, number> = {
  "1d": 1,
  "5d": 5,
  "1mo": 30,
  "3mo": 90,
  "6mo": 180,
  "1y": 365,
  "2y": 730,
  "5y": 1825,
  "10y": 3650,
};

const INTERVALS = new Set(["1m", "2m", "5m", "15m", "30m", "60m", "90m", "1h", "1d", "5d", "1wk", "1mo", "3mo"]);

function rangeToPeriod1(range: string): Date {
  const now = new Date();
  if (range === "ytd") return new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  if (range === "max") return new Date("1970-01-01T00:00:00Z");
  const days = RANGE_DAYS[range] ?? 365;
  return new Date(now.getTime() - days * 864e5);
}

function sendJson(res: ServerResponse, status: number, body: string) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(body);
}

function readSymbol(req: IncomingMessage, res: ServerResponse): string | null {
  const url = new URL(req.url ?? "", "http://localhost");
  const symbol = (url.searchParams.get("symbol") ?? "").trim().toUpperCase();
  if (!/^[A-Z0-9.\-^=]{1,15}$/.test(symbol)) {
    sendJson(res, 400, JSON.stringify({ error: "invalid symbol" }));
    return null;
  }
  return symbol;
}

async function handle(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? "", "http://localhost");
  try {
    const yf = await getClient();

    if (url.pathname === "/api/yahoo/quoteSummary") {
      const symbol = readSymbol(req, res);
      if (!symbol) return;
      const modules = (url.searchParams.get("modules") ?? DEFAULT_MODULES)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const result = await yf.quoteSummary(symbol, { modules, formatted: false }, { validateResult: false });
      sendJson(res, 200, JSON.stringify(result));
      return;
    }

    if (url.pathname === "/api/yahoo/chart") {
      const symbol = readSymbol(req, res);
      if (!symbol) return;
      const range = (url.searchParams.get("range") ?? "1y").replace(/[^0-9a-z]/gi, "");
      const requested = (url.searchParams.get("interval") ?? "1d").replace(/[^0-9a-z]/gi, "");
      const interval = INTERVALS.has(requested) ? requested : "1d";
      const result = await yf.chart(symbol, { period1: rangeToPeriod1(range), interval }, { validateResult: false });
      sendJson(res, 200, JSON.stringify(result));
      return;
    }

    if (url.pathname === "/api/yahoo/search") {
      const q = (url.searchParams.get("q") ?? "").replace(/[^a-zA-Z0-9 .\-]/g, "").slice(0, 40);
      const result = await yf.search(q, { quotesCount: 10, newsCount: 8 }, { validateResult: false });
      sendJson(res, 200, JSON.stringify(result));
      return;
    }

    if (url.pathname === "/api/yahoo/quote") {
      const symbols = (url.searchParams.get("symbols") ?? "")
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter((s) => /^[A-Z0-9.\-^=]{1,15}$/.test(s))
        .slice(0, 50);
      if (!symbols.length) {
        sendJson(res, 400, JSON.stringify({ error: "invalid symbols" }));
        return;
      }
      const result = await yf.quote(symbols, { return: "array" }, { validateResult: false });
      sendJson(res, 200, JSON.stringify(result));
      return;
    }

    res.statusCode = 404;
    res.end("not found");
  } catch (err) {
    const message = (err as Error)?.message ?? String(err);
    console.warn(`[yahoo-proxy] ${url.pathname}: ${message}`);
    sendJson(res, 502, JSON.stringify({ error: message }));
  }
}

function middleware(): Connect.NextHandleFunction {
  return (req, res, next) => {
    if (req.url?.startsWith("/api/yahoo/")) {
      void handle(req, res);
      return;
    }
    next();
  };
}

export function yahooProxy(): Plugin {
  return {
    name: "yahoo-finance-proxy",
    configureServer(server) {
      server.middlewares.use(middleware());
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware());
    },
  };
}
