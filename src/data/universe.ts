/**
 * Seed universe. The MVP screens a curated list of liquid US names so that a
 * scan finishes in a reasonable number of API calls. Add/remove symbols from
 * the Settings panel; the list is persisted locally.
 *
 * A future iteration can swap this for a live screener:
 *   - Yahoo:  /v1/finance/screener/predefined/saved?scrIds=most_actives
 *   - FMP:    /api/v3/stock-screener?marketCapMoreThan=2000000000&isActivelyTrading=true
 */
export interface UniverseEntry {
  symbol: string;
  name: string;
  sector: string;
}

export const DEFAULT_UNIVERSE: UniverseEntry[] = [
  { symbol: "AAPL", name: "Apple Inc.", sector: "Technology" },
  { symbol: "MSFT", name: "Microsoft Corporation", sector: "Technology" },
  { symbol: "NVDA", name: "NVIDIA Corporation", sector: "Technology" },
  { symbol: "AMD", name: "Advanced Micro Devices", sector: "Technology" },
  { symbol: "AVGO", name: "Broadcom Inc.", sector: "Technology" },
  { symbol: "ORCL", name: "Oracle Corporation", sector: "Technology" },
  { symbol: "CRM", name: "Salesforce Inc.", sector: "Technology" },
  { symbol: "ADBE", name: "Adobe Inc.", sector: "Technology" },
  { symbol: "INTC", name: "Intel Corporation", sector: "Technology" },
  { symbol: "QCOM", name: "Qualcomm Inc.", sector: "Technology" },
  { symbol: "MU", name: "Micron Technology", sector: "Technology" },
  { symbol: "TSM", name: "Taiwan Semiconductor", sector: "Technology" },
  { symbol: "ASML", name: "ASML Holding", sector: "Technology" },
  { symbol: "SNOW", name: "Snowflake Inc.", sector: "Technology" },
  { symbol: "PLTR", name: "Palantir Technologies", sector: "Technology" },
  { symbol: "UBER", name: "Uber Technologies", sector: "Technology" },
  { symbol: "GOOGL", name: "Alphabet Inc.", sector: "Communication Services" },
  { symbol: "META", name: "Meta Platforms", sector: "Communication Services" },
  { symbol: "NFLX", name: "Netflix Inc.", sector: "Communication Services" },
  { symbol: "DIS", name: "Walt Disney Company", sector: "Communication Services" },
  { symbol: "TMUS", name: "T-Mobile US", sector: "Communication Services" },
  { symbol: "AMZN", name: "Amazon.com Inc.", sector: "Consumer Discretionary" },
  { symbol: "TSLA", name: "Tesla Inc.", sector: "Consumer Discretionary" },
  { symbol: "HD", name: "Home Depot", sector: "Consumer Discretionary" },
  { symbol: "NKE", name: "Nike Inc.", sector: "Consumer Discretionary" },
  { symbol: "SBUX", name: "Starbucks Corporation", sector: "Consumer Discretionary" },
  { symbol: "MCD", name: "McDonald's Corporation", sector: "Consumer Discretionary" },
  { symbol: "BKNG", name: "Booking Holdings", sector: "Consumer Discretionary" },
  { symbol: "ABNB", name: "Airbnb Inc.", sector: "Consumer Discretionary" },
  { symbol: "WMT", name: "Walmart Inc.", sector: "Consumer Staples" },
  { symbol: "COST", name: "Costco Wholesale", sector: "Consumer Staples" },
  { symbol: "PG", name: "Procter & Gamble", sector: "Consumer Staples" },
  { symbol: "KO", name: "Coca-Cola Company", sector: "Consumer Staples" },
  { symbol: "PEP", name: "PepsiCo Inc.", sector: "Consumer Staples" },
  { symbol: "JPM", name: "JPMorgan Chase", sector: "Financials" },
  { symbol: "BAC", name: "Bank of America", sector: "Financials" },
  { symbol: "GS", name: "Goldman Sachs", sector: "Financials" },
  { symbol: "MS", name: "Morgan Stanley", sector: "Financials" },
  { symbol: "V", name: "Visa Inc.", sector: "Financials" },
  { symbol: "MA", name: "Mastercard Inc.", sector: "Financials" },
  { symbol: "PYPL", name: "PayPal Holdings", sector: "Financials" },
  { symbol: "BRK-B", name: "Berkshire Hathaway", sector: "Financials" },
  { symbol: "UNH", name: "UnitedHealth Group", sector: "Health Care" },
  { symbol: "JNJ", name: "Johnson & Johnson", sector: "Health Care" },
  { symbol: "LLY", name: "Eli Lilly & Co.", sector: "Health Care" },
  { symbol: "PFE", name: "Pfizer Inc.", sector: "Health Care" },
  { symbol: "MRK", name: "Merck & Co.", sector: "Health Care" },
  { symbol: "ABBV", name: "AbbVie Inc.", sector: "Health Care" },
  { symbol: "AMGN", name: "Amgen Inc.", sector: "Health Care" },
  { symbol: "MRNA", name: "Moderna Inc.", sector: "Health Care" },
  { symbol: "XOM", name: "Exxon Mobil", sector: "Energy" },
  { symbol: "CVX", name: "Chevron Corporation", sector: "Energy" },
  { symbol: "COP", name: "ConocoPhillips", sector: "Energy" },
  { symbol: "SLB", name: "Schlumberger", sector: "Energy" },
  { symbol: "CAT", name: "Caterpillar Inc.", sector: "Industrials" },
  { symbol: "BA", name: "Boeing Company", sector: "Industrials" },
  { symbol: "GE", name: "GE Aerospace", sector: "Industrials" },
  { symbol: "HON", name: "Honeywell International", sector: "Industrials" },
  { symbol: "UPS", name: "United Parcel Service", sector: "Industrials" },
  { symbol: "DE", name: "Deere & Company", sector: "Industrials" },
  { symbol: "LIN", name: "Linde plc", sector: "Materials" },
  { symbol: "FCX", name: "Freeport-McMoRan", sector: "Materials" },
  { symbol: "NEM", name: "Newmont Corporation", sector: "Materials" },
  { symbol: "NEE", name: "NextEra Energy", sector: "Utilities" },
  { symbol: "DUK", name: "Duke Energy", sector: "Utilities" },
  { symbol: "SO", name: "Southern Company", sector: "Utilities" },
  { symbol: "AMT", name: "American Tower", sector: "Real Estate" },
  { symbol: "PLD", name: "Prologis Inc.", sector: "Real Estate" },
  { symbol: "SPG", name: "Simon Property Group", sector: "Real Estate" },
];

export const ALL_SECTORS = Array.from(new Set(DEFAULT_UNIVERSE.map((u) => u.sector))).sort();

export function defaultSymbols(): string[] {
  return DEFAULT_UNIVERSE.map((u) => u.symbol);
}
