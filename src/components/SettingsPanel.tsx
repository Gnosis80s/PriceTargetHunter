import { useEffect, useState } from "react";
import { useApp } from "../store/AppStore";
import { DEFAULT_SETTINGS } from "../lib/defaults";
import type { ScoreWeights } from "../lib/types";
import { GLOSSARY } from "../lib/glossary";
import { UNIVERSE_PRESETS } from "../data/presets";
import { Button, Card, CardHeader, Field, Input, Select, Switch } from "./ui";
import { ensureNotificationPermission } from "../hooks/useScreener";

const WEIGHT_FIELDS: { key: keyof ScoreWeights; label: string; tip: string }[] = [
  { key: "upside", label: "Upside", tip: GLOSSARY.upside },
  { key: "consensus", label: "Consensus", tip: GLOSSARY.consensus },
  { key: "momentum", label: "Momentum", tip: GLOSSARY.momentum },
  { key: "coverage", label: "Coverage", tip: GLOSSARY.analysts },
  { key: "agreement", label: "Agreement", tip: GLOSSARY.dispersion },
  { key: "value", label: "Value", tip: GLOSSARY.valueFactor },
  { key: "quality", label: "Quality", tip: GLOSSARY.qualityFactor },
  { key: "growth", label: "Growth", tip: GLOSSARY.growthFactor },
  { key: "health", label: "Health", tip: GLOSSARY.healthFactor },
];

export function SettingsPanel() {
  const { settings, updateSettings, resetSettings } = useApp();
  const [universeText, setUniverseText] = useState(settings.universe.join(", "));

  useEffect(() => {
    setUniverseText(settings.universe.join(", "));
  }, [settings.universe]);

  const saveUniverse = () => {
    const symbols = Array.from(
      new Set(
        universeText
          .split(/[\s,;]+/)
          .map((s) => s.trim().toUpperCase())
          .filter(Boolean),
      ),
    );
    if (symbols.length) updateSettings({ universe: symbols, universePreset: "custom" });
  };

  const applyPreset = (id: string, symbols: string[]) => {
    setUniverseText(symbols.join(", "));
    updateSettings({ universe: symbols, universePreset: id });
  };

  const estMinutes = Math.max(1, Math.round(settings.universe.length / 300));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader title="Appearance & data" subtitle="Theme and refresh behavior" />
        <div className="flex flex-col gap-4 p-4">
          <Field label="Theme">
            <Select
              value={settings.theme}
              onChange={(e) => updateSettings({ theme: e.target.value as "dark" | "light" })}
            >
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </Select>
          </Field>
          <label className="flex items-center justify-between text-sm">
            <span>Auto refresh</span>
            <Switch checked={settings.autoRefresh} onChange={(v) => updateSettings({ autoRefresh: v })} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Refresh interval (min)">
              <Input
                type="number"
                min={1}
                value={settings.refreshMinutes}
                onChange={(e) => updateSettings({ refreshMinutes: Number(e.target.value) || 15 })}
              />
            </Field>
            <Field label="Concurrent requests" hint="Lower if you hit rate limits">
              <Input
                type="number"
                min={1}
                max={12}
                value={settings.concurrency}
                onChange={(e) => updateSettings({ concurrency: Number(e.target.value) || 5 })}
              />
            </Field>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Score weights" subtitle="Relative weight of each factor in the 0–100 score" />
        <div className="flex flex-col gap-3 p-4">
          <div className="grid grid-cols-3 gap-3">
            {WEIGHT_FIELDS.map((f) => (
              <Field key={f.key} label={f.label} tip={f.tip}>
                <Input
                  type="number"
                  min={0}
                  value={settings.scoreWeights[f.key]}
                  onChange={(e) =>
                    updateSettings({
                      scoreWeights: {
                        ...settings.scoreWeights,
                        [f.key]: Math.max(0, Number(e.target.value) || 0),
                      },
                    })
                  }
                />
              </Field>
            ))}
          </div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] text-muted">
              Weights are relative — they are normalised by their sum, so they need not add to 100.
            </p>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => updateSettings({ scoreWeights: DEFAULT_SETTINGS.scoreWeights })}
            >
              Reset weights
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Data sources" subtitle="Hybrid: Yahoo (no key) → FMP → Finnhub" />
        <div className="flex flex-col gap-4 p-4">
          <label className="flex items-center justify-between text-sm">
            <span>
              Yahoo Finance <span className="text-xs text-muted">(via dev proxy, no key)</span>
            </span>
            <Switch checked={settings.yahooEnabled} onChange={(v) => updateSettings({ yahooEnabled: v })} />
          </label>
          <Field label="Financial Modeling Prep API key" hint="Optional. Used as fallback / to fill missing targets.">
            <Input
              type="password"
              placeholder="fmp api key"
              value={settings.fmpApiKey}
              onChange={(e) => updateSettings({ fmpApiKey: e.target.value })}
            />
          </Field>
          <Field label="Finnhub API key" hint="Optional. Used as a final fallback.">
            <Input
              type="password"
              placeholder="finnhub api key"
              value={settings.finnhubApiKey}
              onChange={(e) => updateSettings({ finnhubApiKey: e.target.value })}
            />
          </Field>
          <Field
            label="Alpha Vantage API key (news sentiment)"
            hint="Optional. Adds per-article sentiment to the stock detail view. ~25 req/day free."
          >
            <Input
              type="password"
              placeholder="alphavantage api key"
              value={settings.alphaVantageApiKey}
              onChange={(e) => updateSettings({ alphaVantageApiKey: e.target.value })}
            />
          </Field>
          <label className="flex items-center justify-between text-sm">
            <span>
              Offline demo fallback <span className="text-xs text-muted">(bundled sample data)</span>
            </span>
            <Switch checked={settings.demoFallback} onChange={(v) => updateSettings({ demoFallback: v })} />
          </label>
        </div>
      </Card>

      <Card>
        <CardHeader title="Alerts" subtitle="Desktop notifications and webhooks" />
        <div className="flex flex-col gap-4 p-4">
          <label className="flex items-center justify-between text-sm">
            <span>Desktop notifications</span>
            <Switch
              checked={settings.notifications}
              onChange={async (v) => {
                if (v) await ensureNotificationPermission();
                updateSettings({ notifications: v });
              }}
            />
          </label>
          <Field label="Alert when upside reaches (%)">
            <Input
              type="number"
              value={settings.alertMinNewUpside}
              onChange={(e) => updateSettings({ alertMinNewUpside: Number(e.target.value) || 30 })}
            />
          </Field>
          <Field label="Webhook URL" hint="POSTs JSON alerts (Slack/Telegram/Discord compatible).">
            <Input
              type="url"
              placeholder="https://hooks.example.com/..."
              value={settings.webhookUrl}
              onChange={(e) => updateSettings({ webhookUrl: e.target.value })}
            />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Universe"
          subtitle={`${settings.universe.length} symbols screened · full scan ≈ ${estMinutes} min`}
        />
        <div className="flex flex-col gap-3 p-4">
          <div className="flex flex-wrap gap-2">
            {UNIVERSE_PRESETS.map((p) => (
              <Button
                key={p.id}
                size="sm"
                variant={settings.universePreset === p.id ? "primary" : "secondary"}
                title={p.description}
                onClick={() => applyPreset(p.id, p.symbols)}
              >
                {p.label}
              </Button>
            ))}
            {settings.universePreset === "custom" ? (
              <Button size="sm" variant="primary" disabled>
                Custom
              </Button>
            ) : null}
          </div>
          <textarea
            className="min-h-32 w-full rounded-md border border-border bg-bg p-2.5 text-xs text-fg focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
            value={universeText}
            onChange={(e) => setUniverseText(e.target.value)}
            spellCheck={false}
          />
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" size="sm" onClick={saveUniverse}>
              Save universe
            </Button>
            <Button size="sm" onClick={() => applyPreset("sp500", UNIVERSE_PRESETS[1].symbols)}>
              Load S&P 500
            </Button>
            <Button
              variant="danger"
              size="sm"
              className="ml-auto"
              onClick={() => {
                if (confirm("Reset all settings to defaults?")) resetSettings();
              }}
            >
              Reset settings
            </Button>
          </div>
          <p className="text-[11px] text-muted">
            Symbols are comma/space separated. Large universes take longer; results stream in as they
            load, and you can stop a scan from the header. Default: {DEFAULT_SETTINGS.universe.length} names.
          </p>
        </div>
      </Card>
    </div>
  );
}
