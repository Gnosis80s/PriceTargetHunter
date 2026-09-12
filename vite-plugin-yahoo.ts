import type { Plugin, Connect } from "vite";
import type { IncomingMessage, ServerResponse } from "node:http";

/**
 * Dev/preview-only Yahoo Finance proxy.
 *
 * Yahoo's quoteSummary endpoint requires a session cookie + "crumb" token and
 * does not send CORS headers, so a browser cannot call it directly. This
 * middleware does the cookie/crumb handshake on the server and exposes a clean
 * same-origin endpoint at:
 *
 *   /api/yahoo/quoteSummary?symbol=AAPL
 *   /api/yahoo/chart?symbol=AAPL&range=1y&interval=1d
 *   /api/yahoo/search?q=apple
 *
 * It is best-effort: if Yahoo changes its anti-bot behavior the app falls back
 * to the official FMP / Finnhub providers (configure keys in Settings).
 */

const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36";

const DEFAULT_MODULES = [
  "price",
  "summaryDetail",
  "defaultKeyStatistics",
  "financialData",
  "recommendationTrend",
  "upgradeDowngradeHistory",
  "summaryProfile",
  "earnings",
].join(",");

interface Auth {
  cookie: string;
  crumb: string;
  fetchedAt: number;
}

let auth: Auth | null = null;
let authPromise: Promise<Auth> | null = null;

function readSetCookies(res: Response): string {
  const anyHeaders = res.headers as Headers & { getSetCookie?: () => string[] };
  const list = typeof anyHeaders.getSetCookie === "function" ? anyHeaders.getSetCookie() : [];
  const raw = list.length ? list : (res.headers.get("set-cookie") ? [res.headers.get("set-cookie") as string] : []);
  return raw
    .map((c) => c.split(";")[0])
    .filter(Boolean)
    .join("; ");
}

async function handshake(): Promise<Auth> {
  const consent = await fetch("https://fc.yahoo.com/", {
    headers: { "User-Agent": UA, Accept: "*/*" },
    redirect: "manual",
  }).catch(() => null);
  const cookie = consent ? readSetCookies(consent) : "";

  const crumbRes = await fetch("https://query1.finance.yahoo.com/v1/test/getcrumb", {
    headers: { "User-Agent": UA, Cookie: cookie, Accept: "*/*" },
  });
  const crumb = (await crumbRes.text()).trim();
  if (!/^[A-Za-z0-9._~-]{4,}$/.test(crumb)) throw new Error("Yahoo crumb handshake failed (rate limited?)");

  return { cookie, crumb, fetchedAt: Date.now() };
}

async function getAuth(force = false): Promise<Auth> {
  if (!force && auth && Date.now() - auth.fetchedAt < 30 * 60 * 1000) return auth;
  if (!force && authPromise) return authPromise;
  authPromise = handshake()
    .then((a) => {
      auth = a;
      return a;
    })
    .finally(() => {
      authPromise = null;
    });
  return authPromise;
}

async function yahooFetch(path: string, force = false): Promise<{ status: number; body: string }> {
  const a = await getAuth(force);
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(`https://query1.finance.yahoo.com${path}${sep}crumb=${encodeURIComponent(a.crumb)}`, {
    headers: { "User-Agent": UA, Cookie: a.cookie, Accept: "application/json" },
  });
  return { status: res.status, body: await res.text() };
}

function sendJson(res: ServerResponse, status: number, body: string) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(body);
}

function requireSymbol(req: IncomingMessage, res: ServerResponse): string | null {
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
    if (url.pathname === "/api/yahoo/quoteSummary") {
      const symbol = requireSymbol(req, res);
      if (!symbol) return;
      const modules = (url.searchParams.get("modules") ?? DEFAULT_MODULES).replace(/[^a-zA-Z,]/g, "");
      let out = await yahooFetch(`/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${modules}&formatted=false`);
      if (out.status === 401 || out.status === 403) out = await yahooFetch(`/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${modules}&formatted=false`, true);
      sendJson(res, out.status, out.body);
      return;
    }

    if (url.pathname === "/api/yahoo/chart") {
      const symbol = requireSymbol(req, res);
      if (!symbol) return;
      const range = (url.searchParams.get("range") ?? "1y").replace(/[^0-9a-z]/gi, "");
      const interval = (url.searchParams.get("interval") ?? "1d").replace(/[^0-9a-z]/gi, "");
      let out = await yahooFetch(`/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`);
      if (out.status === 401 || out.status === 403) out = await yahooFetch(`/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`, true);
      sendJson(res, out.status, out.body);
      return;
    }

    if (url.pathname === "/api/yahoo/search") {
      const q = (url.searchParams.get("q") ?? "").replace(/[^a-zA-Z0-9 .\-]/g, "").slice(0, 40);
      const out = await yahooFetch(`/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=10&newsCount=5`);
      sendJson(res, out.status, out.body);
      return;
    }

    res.statusCode = 404;
    res.end("not found");
  } catch (err) {
    sendJson(res, 502, JSON.stringify({ error: String((err as Error).message ?? err) }));
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
