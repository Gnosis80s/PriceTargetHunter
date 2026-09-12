import { useMemo } from "react";

export interface Series {
  name: string;
  color: string;
  points: { t: number; v: number }[];
}

export function MultiLineChart({ series, height = 180 }: { series: Series[]; height?: number }) {
  const { paths, yMin, yMax, xMin, xMax } = useMemo(() => {
    const all = series.flatMap((s) => s.points);
    if (!all.length) {
      return { paths: [], yMin: 0, yMax: 0, xMin: 0, xMax: 0 };
    }
    const ys = all.map((p) => p.v);
    const xs = all.map((p) => p.t);
    const yMin = Math.min(...ys);
    const yMax = Math.max(...ys);
    const xMin = Math.min(...xs);
    const xMax = Math.max(...xs);
    const pad = (yMax - yMin) * 0.08 || 1;
    const lo = yMin - pad;
    const hi = yMax + pad;
    const W = 100;
    const H = 100;
    const paths = series.map((s) => ({
      color: s.color,
      name: s.name,
      d: s.points
        .map((p, i) => {
          const x = xMax === xMin ? W / 2 : ((p.t - xMin) / (xMax - xMin)) * W;
          const y = H - ((p.v - lo) / (hi - lo)) * H;
          return `${i === 0 ? "M" : "L"}${x.toFixed(3)},${y.toFixed(3)}`;
        })
        .join(" "),
    }));
    return { paths, yMin: lo, yMax: hi, xMin, xMax };
  }, [series]);

  if (!paths.length) {
    return <div className="flex h-40 items-center justify-center text-xs text-muted">No history yet</div>;
  }

  return (
    <div className="w-full">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ height, width: "100%" }}>
        {[0, 25, 50, 75, 100].map((y) => (
          <line key={y} x1={0} x2={100} y1={y} y2={y} stroke="var(--border)" strokeWidth={0.2} vectorEffect="non-scaling-stroke" />
        ))}
        {paths.map((p) => (
          <path
            key={p.name}
            d={p.d}
            fill="none"
            stroke={p.color}
            strokeWidth={1.6}
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
      </svg>
      <div className="mt-1 flex flex-wrap items-center justify-between text-[11px] text-muted">
        <div className="flex gap-3">
          {paths.map((p) => (
            <span key={p.name} className="inline-flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: p.color }} />
              {p.name}
            </span>
          ))}
        </div>
        <span className="tabular">
          {new Date(xMin).toLocaleDateString()} – {new Date(xMax).toLocaleDateString()} · {yMin.toFixed(2)}–{yMax.toFixed(2)}
        </span>
      </div>
    </div>
  );
}
