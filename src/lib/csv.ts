import type { ScreenerRow } from "./types";

const COLUMNS: { key: keyof ScreenerRow; label: string }[] = [
  { key: "symbol", label: "Symbol" },
  { key: "name", label: "Name" },
  { key: "sector", label: "Sector" },
  { key: "price", label: "Price" },
  { key: "targetMean", label: "Target Mean" },
  { key: "targetMedian", label: "Target Median" },
  { key: "targetHigh", label: "Target High" },
  { key: "targetLow", label: "Target Low" },
  { key: "upsidePct", label: "Upside %" },
  { key: "riskReward", label: "Risk/Reward" },
  { key: "dispersion", label: "Dispersion %" },
  { key: "analystCount", label: "Analysts" },
  { key: "recommendationMean", label: "Rec Mean" },
  { key: "recommendationKey", label: "Consensus" },
  { key: "momentum", label: "Momentum" },
  { key: "targetMomentumPct", label: "Target Momentum %" },
  { key: "confidenceScore", label: "Confidence" },
  { key: "estimateMomentumScore", label: "Estimate Momentum" },
  { key: "priceTrendScore", label: "Price Trend" },
  { key: "riskScore", label: "Risk Score" },
  { key: "earningsInDays", label: "Earnings In (days)" },
  { key: "epsRevisionPct", label: "EPS Revision %" },
  { key: "pctFrom52wHigh", label: "% From 52w High" },
  { key: "pctVs200d", label: "Price vs 200d" },
  { key: "score", label: "Score" },
  { key: "valueScore", label: "Value Score" },
  { key: "qualityScore", label: "Quality Score" },
  { key: "growthScore", label: "Growth Score" },
  { key: "healthScore", label: "Health Score" },
  { key: "marketCap", label: "Market Cap" },
  { key: "trailingPE", label: "Trailing P/E" },
  { key: "forwardPE", label: "Forward P/E" },
  { key: "source", label: "Source" },
];

function escape(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: ScreenerRow[]): string {
  const head = COLUMNS.map((c) => c.label).join(",");
  const body = rows.map((r) => COLUMNS.map((c) => escape(r[c.key])).join(",")).join("\n");
  return `${head}\n${body}`;
}

export function downloadCsv(filename: string, rows: ScreenerRow[]): void {
  const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
