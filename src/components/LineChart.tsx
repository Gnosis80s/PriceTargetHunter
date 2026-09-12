import { useMemo } from "react";

export interface Series {
  name: string;
  color: string;
  points: { t: number; v: number }[];
}

function formatAxis(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 10000) return `${(v / 1000).toFixed(0)}k`;
  if (abs >= 1000) return `${(v / 1000).toFixed(1)}k`;
  if (abs >= 100) return v.toFixed(0);
  if (abs >= 10) return v.toFixed(1);
  return v.toFixed(2);
}

function formatDate(t: number, spanMs: number): string {
  const d = new Date(t);
  if (!Number.isFinite(t)) return "";
  if (spanMs > 300 * 864e5) return d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function MultiLineChart({ series, height = 180 }: { series: Series[]; height?: number }) {
  const { paths, yTicks, xTicks } = useMemo(() => {
    const all = series.flatMap((s) => s.points).filter((p) => Number.isFinite(p.t) && Number.isFinite(p.v));
    if (!all.length) return { paths: [], yTicks: [], xTicks: [] };

    const ys = all.map((p) => p.v);
    const xs = all.map((p) => p.t);
    const yMinV = Math.min(...ys);
    const yMaxV = Math.max(...ys);
    const xMin = Math.min(...xs);
    const xMax = Math.max(...xs);
    const pad = (yMaxV - yMinV) * 0.08 || Math.abs(yMaxV) * 0.05 || 1;
    const lo = yMinV - pad;
    const hi = yMaxV + pad;
    const W = 100;
    const H = 100;

    const paths = series
      .map((s) => ({
        color: s.color,
        name: s.name,
        coords: s.points
          .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.v))
          .map((p) => {
            const x = xMax === xMin ? W / 2 : ((p.t - xMin) / (xMax - xMin)) * W;
            const y = H - ((p.v - lo) / (hi - lo)) * H;
            return `${Number.isFinite(x) ? x.toFixed(3) : 0},${Number.isFinite(y) ? y.toFixed(3) : 0}`;
          }),
      }))
      .filter((p) => p.coords.length > 0)
      .map((p) => ({ ...p, d: "M" + p.coords.join(" L") }));

    const steps = 4;
    const yTicks = Array.from({ length: steps + 1 }, (_, i) => hi - ((hi - lo) * i) / steps);
    const span = xMax - xMin;
    const xTicks = Array.from({ length: steps + 1 }, (_, i) => {
      const t = xMin + (span * i) / steps;
      return { t, label: formatDate(t, span) };
    });

    return { paths, yTicks, xTicks };
  }, [series]);

  if (!paths.length) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg border border-border text-xs text-muted">
        No history available yet
      </div>
    );
  }

  const gridY = [0, 25, 50, 75, 100];

  return (
    <div className="w-full rounded-lg border border-border bg-bg/40 p-2">
      <div className="flex">
        <div
          className="flex w-14 shrink-0 flex-col justify-between pr-2 text-right text-[10px] leading-none text-muted tabular"
          style={{ height }}
        >
          {yTicks.map((v, i) => (
            <span key={i}>{formatAxis(v)}</span>
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            width="100%"
            height={height}
            style={{ display: "block", height, width: "100%" }}
          >
            {gridY.map((y) => (
              <line
                key={y}
                x1={0}
                x2={100}
                y1={y}
                y2={y}
                stroke="rgba(128,128,128,0.25)"
                strokeWidth={0.5}
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {paths.map((p) => (
              <path
                key={p.name}
                d={p.d}
                fill="none"
                stroke={p.color}
                strokeWidth={1.8}
                vectorEffect="non-scaling-stroke"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ))}
          </svg>
          <div className="mt-1 flex justify-between text-[10px] text-muted tabular">
            {xTicks.map((x, i) => (
              <span key={i} className={i === 0 ? "text-left" : i === xTicks.length - 1 ? "text-right" : "text-center"}>
                {x.label}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-muted">
        {paths.map((p) => (
          <span key={p.name} className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
            {p.name}
          </span>
        ))}
      </div>
    </div>
  );
}
