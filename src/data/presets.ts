import { DEFAULT_UNIVERSE } from "./universe";
import { SP500_UNIVERSE } from "./sp500";

export interface UniversePreset {
  id: string;
  label: string;
  description: string;
  symbols: string[];
}

export const UNIVERSE_PRESETS: UniversePreset[] = [
  {
    id: "curated",
    label: "Curated",
    description: `${DEFAULT_UNIVERSE.length} liquid large caps`,
    symbols: DEFAULT_UNIVERSE.map((u) => u.symbol),
  },
  {
    id: "sp500",
    label: "S&P 500",
    description: `${SP500_UNIVERSE.length} US large caps`,
    symbols: SP500_UNIVERSE.map((u) => u.symbol),
  },
];

export function presetById(id: string): UniversePreset | undefined {
  return UNIVERSE_PRESETS.find((p) => p.id === id);
}

export function defaultPresetSymbols(): string[] {
  return presetById("sp500")?.symbols ?? DEFAULT_UNIVERSE.map((u) => u.symbol);
}
