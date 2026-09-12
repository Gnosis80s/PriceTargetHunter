import { describe, expect, it } from "vitest";
import type { TargetChange } from "./types";
import { runningTargetAverage } from "./history";

const DAY = 864e5;
const at = (daysAgo: number): number => Date.now() - daysAgo * DAY;

const change = (partial: Partial<TargetChange>): TargetChange => ({
  date: at(0),
  firm: "Firm",
  action: "main",
  ...partial,
});

describe("runningTargetAverage", () => {
  it("returns an empty series without target values", () => {
    expect(runningTargetAverage([change({ action: "up" })])).toEqual([]);
    expect(runningTargetAverage(undefined)).toEqual([]);
  });

  it("averages each firm's latest target after every revision", () => {
    const series = runningTargetAverage([
      change({ firm: "A", toTarget: 100, date: at(10) }),
      change({ firm: "B", toTarget: 200, date: at(8) }),
      change({ firm: "A", fromTarget: 100, toTarget: 120, date: at(4) }),
    ]);
    expect(series).toHaveLength(3);
    expect(series[0].v).toBeCloseTo(100);
    expect(series[1].v).toBeCloseTo(150);
    expect(series[2].v).toBeCloseTo(160);
  });

  it("is chronological regardless of input order", () => {
    const series = runningTargetAverage([
      change({ firm: "A", toTarget: 120, date: at(4) }),
      change({ firm: "B", toTarget: 200, date: at(8) }),
    ]);
    expect(series[0].t).toBeLessThan(series[1].t);
  });

  it("collapses multiple revisions on the same day", () => {
    const series = runningTargetAverage([
      change({ firm: "A", toTarget: 100, date: at(3) }),
      change({ firm: "B", toTarget: 200, date: at(3) }),
    ]);
    expect(series).toHaveLength(1);
    expect(series[0].v).toBeCloseTo(150);
  });

  it("falls back to the prior target when a new value is absent", () => {
    const series = runningTargetAverage([change({ firm: "A", fromTarget: 90, date: at(2) })]);
    expect(series[0].v).toBeCloseTo(90);
  });
});
