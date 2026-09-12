import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function fmtNum(v: number | undefined | null, digits = 2): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function fmtPct(v: number | undefined | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}

export function fmtMoney(v: number | undefined | null, currency = "USD"): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const sym = currency === "USD" ? "$" : "";
  return `${sym}${fmtNum(v)}`;
}

export function fmtCompact(v: number | undefined | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const abs = Math.abs(v);
  if (abs >= 1e12) return `${(v / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return v.toFixed(0);
}

export function recLabel(key?: string, mean?: number): string {
  const normalized = key?.toLowerCase();
  if (normalized && normalized !== "none") return normalized.replace(/_/g, " ");
  if (mean == null) return "—";
  if (mean <= 1.5) return "strong buy";
  if (mean <= 2.5) return "buy";
  if (mean <= 3.5) return "hold";
  if (mean <= 4.5) return "sell";
  return "strong sell";
}

export function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
