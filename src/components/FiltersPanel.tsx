import type { Filters } from "../lib/types";
import { Button, Field, Input, Select, Switch } from "./ui";

export function FiltersPanel({
  filters,
  sectors,
  onChange,
  onReset,
}: {
  filters: Filters;
  sectors: string[];
  onChange: (patch: Partial<Filters>) => void;
  onReset: () => void;
}) {
  const num = (v: string, fallback: number) => (v === "" ? fallback : Number(v));

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">Filters</div>
        <Button size="sm" variant="ghost" onClick={onReset}>
          Reset
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Min upside %">
          <Input
            type="number"
            value={filters.minUpside}
            onChange={(e) => onChange({ minUpside: num(e.target.value, 0) })}
          />
        </Field>
        <Field label="Min risk/reward">
          <Input
            type="number"
            step="0.1"
            value={filters.minRiskReward}
            onChange={(e) => onChange({ minRiskReward: num(e.target.value, 0) })}
          />
        </Field>
        <Field label="Min analysts">
          <Input
            type="number"
            value={filters.minAnalysts}
            onChange={(e) => onChange({ minAnalysts: num(e.target.value, 0) })}
          />
        </Field>
        <Field label="Max analysts">
          <Input
            type="number"
            value={filters.maxAnalysts}
            onChange={(e) => onChange({ maxAnalysts: num(e.target.value, 999) })}
          />
        </Field>
        <Field label="Min market cap ($B)">
          <Input
            type="number"
            value={filters.minMarketCapB}
            onChange={(e) => onChange({ minMarketCapB: num(e.target.value, 0) })}
          />
        </Field>
        <Field label="Max market cap ($B)">
          <Input
            type="number"
            value={filters.maxMarketCapB}
            onChange={(e) => onChange({ maxMarketCapB: num(e.target.value, 1_000_000) })}
          />
        </Field>
        <Field label="Min price">
          <Input
            type="number"
            value={filters.minPrice}
            onChange={(e) => onChange({ minPrice: num(e.target.value, 0) })}
          />
        </Field>
        <Field label="Max price">
          <Input
            type="number"
            value={filters.maxPrice}
            onChange={(e) => onChange({ maxPrice: num(e.target.value, 1_000_000) })}
          />
        </Field>
      </div>

      <Field label="Consensus at least">
        <Select
          value={filters.minRecommendation}
          onChange={(e) => onChange({ minRecommendation: Number(e.target.value) })}
        >
          <option value={5}>Any</option>
          <option value={3}>Hold or better</option>
          <option value={2.5}>Buy or better</option>
          <option value={1.8}>Strong buy only</option>
        </Select>
      </Field>

      <div className="flex flex-col gap-1.5">
        <div className="text-xs font-medium text-muted">Sectors</div>
        <div className="flex max-h-44 flex-col gap-1 overflow-y-auto pr-1">
          {sectors.map((s) => {
            const active = filters.sectors.includes(s);
            return (
              <button
                key={s}
                onClick={() =>
                  onChange({
                    sectors: active ? filters.sectors.filter((x) => x !== s) : [...filters.sectors, s],
                  })
                }
                className={`rounded-md px-2 py-1 text-left text-xs transition-colors ${
                  active ? "bg-accent/15 text-accent" : "text-muted hover:bg-surface-2 hover:text-fg"
                }`}
              >
                {s}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-border pt-3">
        <label className="flex items-center justify-between gap-2 text-xs">
          <span>Only stocks with targets</span>
          <Switch checked={filters.onlyWithTargets} onChange={(v) => onChange({ onlyWithTargets: v })} />
        </label>
        <label className="flex items-center justify-between gap-2 text-xs">
          <span>Only recent net upgrades</span>
          <Switch checked={filters.onlyRecentUpgrades} onChange={(v) => onChange({ onlyRecentUpgrades: v })} />
        </label>
      </div>
    </div>
  );
}
