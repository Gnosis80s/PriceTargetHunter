import type { StockData, TargetChange } from "../lib/types";

/**
 * Bundled offline dataset. Used by "Demo mode" and automatically as a last
 * resort when every live provider fails (e.g. no network / no API keys), so the
 * UI always has something to render. Figures are illustrative, not live.
 */
type Row = [
  symbol: string,
  name: string,
  sector: string,
  price: number,
  targetMean: number,
  targetHigh: number,
  targetLow: number,
  analysts: number,
  recMean: number,
  marketCapB: number,
  pe: number,
  changePct: number,
  ups: number,
  downs: number,
];

const ROWS: Row[] = [
  ["MRNA", "Moderna Inc.", "Health Care", 42.1, 96.5, 150, 30, 12, 1.9, 16, 9.1, -2.4, 4, 0],
  ["PYPL", "PayPal Holdings", "Financials", 64.8, 92.4, 120, 55, 31, 2.1, 66, 14.2, 1.1, 6, 1],
  ["INTC", "Intel Corporation", "Technology", 21.4, 29.8, 42, 18, 33, 2.6, 91, 21.0, -1.8, 5, 3],
  ["NKE", "Nike Inc.", "Consumer Discretionary", 63.2, 84.1, 110, 58, 27, 2.2, 94, 18.4, 0.7, 4, 2],
  ["BA", "Boeing Company", "Industrials", 148.5, 197.3, 260, 120, 22, 2.4, 111, 30.5, -0.9, 3, 1],
  ["SNOW", "Snowflake Inc.", "Technology", 118.9, 156.2, 220, 105, 34, 2.0, 39, 160.0, 2.6, 7, 1],
  ["SBUX", "Starbucks Corporation", "Consumer Discretionary", 78.4, 99.7, 125, 70, 29, 2.3, 89, 22.1, 1.4, 5, 2],
  ["PFE", "Pfizer Inc.", "Health Care", 25.1, 31.6, 45, 22, 19, 2.5, 142, 17.8, 0.3, 3, 1],
  ["DIS", "Walt Disney Company", "Communication Services", 92.3, 116.4, 145, 80, 26, 2.1, 168, 20.3, 1.9, 6, 2],
  ["AMD", "Advanced Micro Devices", "Technology", 142.7, 178.9, 250, 110, 38, 2.0, 231, 45.2, 3.2, 8, 1],
  ["META", "Meta Platforms", "Communication Services", 512.4, 630.5, 800, 450, 45, 1.7, 1300, 24.6, 1.2, 9, 0],
  ["TSLA", "Tesla Inc.", "Consumer Discretionary", 244.8, 268.3, 450, 120, 40, 2.8, 780, 62.4, -3.1, 3, 5],
  ["UBER", "Uber Technologies", "Technology", 71.2, 89.6, 105, 58, 37, 1.9, 149, 28.7, 2.1, 7, 1],
  ["GOOGL", "Alphabet Inc.", "Communication Services", 168.3, 205.7, 240, 150, 44, 1.6, 2050, 22.4, 0.9, 8, 0],
  ["AMZN", "Amazon.com Inc.", "Consumer Discretionary", 184.6, 226.4, 270, 160, 48, 1.5, 1920, 34.8, 1.7, 10, 1],
  ["NVDA", "NVIDIA Corporation", "Technology", 118.4, 142.1, 200, 100, 52, 1.5, 2900, 48.9, 4.3, 12, 1],
  ["MSFT", "Microsoft Corporation", "Technology", 418.9, 495.2, 600, 380, 50, 1.6, 3110, 34.2, 0.8, 9, 1],
  ["AAPL", "Apple Inc.", "Technology", 228.5, 248.9, 300, 190, 42, 1.9, 3460, 35.1, 0.4, 6, 2],
  ["CRM", "Salesforce Inc.", "Technology", 268.4, 312.7, 400, 210, 35, 2.1, 259, 44.3, 1.5, 5, 2],
  ["ORCL", "Oracle Corporation", "Technology", 168.2, 186.4, 220, 140, 24, 2.2, 462, 38.7, 1.1, 4, 1],
  ["JPM", "JPMorgan Chase", "Financials", 224.7, 246.8, 285, 195, 21, 2.4, 632, 12.8, 0.6, 3, 2],
  ["XOM", "Exxon Mobil", "Energy", 114.3, 128.5, 150, 100, 22, 2.7, 452, 13.9, -0.5, 2, 3],
  ["COP", "ConocoPhillips", "Energy", 106.8, 132.4, 165, 95, 25, 2.1, 124, 11.2, 1.8, 6, 1],
  ["LLY", "Eli Lilly & Co.", "Health Care", 812.4, 940.6, 1100, 700, 24, 1.8, 773, 58.4, 2.2, 5, 0],
  ["UNH", "UnitedHealth Group", "Health Care", 486.2, 572.8, 660, 420, 23, 2.0, 447, 19.8, 1.3, 6, 1],
  ["FCX", "Freeport-McMoRan", "Materials", 42.6, 54.2, 70, 36, 18, 2.2, 61, 16.4, 2.8, 4, 1],
  ["NEE", "NextEra Energy", "Utilities", 71.8, 88.3, 105, 62, 19, 2.1, 147, 20.6, 1.1, 5, 0],
  ["AMT", "American Tower", "Real Estate", 198.4, 248.6, 300, 175, 20, 1.9, 93, 28.4, 0.9, 4, 1],
  ["PLD", "Prologis Inc.", "Real Estate", 112.6, 134.8, 160, 100, 18, 2.0, 104, 24.2, 1.4, 3, 1],
  ["WMT", "Walmart Inc.", "Consumer Staples", 78.9, 88.4, 100, 70, 31, 2.0, 635, 27.8, 0.5, 7, 1],
];

function makeChanges(ups: number, downs: number): TargetChange[] {
  const firms = ["Morgan Stanley", "Goldman Sachs", "Jefferies", "BofA", "Wedbush", "Barclays", "UBS", "Citi"];
  const out: TargetChange[] = [];
  const now = Date.now();
  let d = 3;
  for (let i = 0; i < ups; i++) {
    out.push({ date: now - d * 864e5, firm: firms[i % firms.length], action: "up", to: "Buy" });
    d += 6 + (i % 3) * 2;
  }
  d = 8;
  for (let i = 0; i < downs; i++) {
    out.push({ date: now - d * 864e5, firm: firms[(i + 3) % firms.length], action: "down", to: "Hold" });
    d += 9;
  }
  return out;
}

export function demoData(): StockData[] {
  return ROWS.map((r) => {
    const [symbol, name, sector, price, targetMean, targetHigh, targetLow, analysts, recMean, marketCapB, pe, changePct, ups, downs] = r;
    return {
      symbol,
      name,
      sector,
      currency: "USD",
      price,
      previousClose: price / (1 + changePct / 100),
      changePct,
      marketCap: marketCapB * 1e9,
      volume: Math.round(8_000_000 + analysts * 250_000),
      avgVolume: Math.round(9_000_000 + analysts * 300_000),
      targetMean,
      targetMedian: targetMean,
      targetHigh,
      targetLow,
      analystCount: analysts,
      recommendationMean: recMean,
      strongBuy: Math.max(2, Math.round(analysts * (5 - recMean) * 0.28)),
      buy: Math.round(analysts * 0.4),
      hold: Math.round(analysts * 0.3),
      sell: Math.max(0, Math.round(analysts * 0.05)),
      strongSell: 0,
      trailingPE: pe,
      forwardPE: pe * 0.85,
      eps: price / pe,
      earningsGrowth: 0.04 + (ups % 5) * 0.03,
      revenueGrowth: 0.02 + (ups % 4) * 0.04,
      targetChanges: makeChanges(ups, downs),
      source: "demo",
      fetchedAt: Date.now(),
    };
  });
}
