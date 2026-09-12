import { describe, expect, it } from "vitest";
import { aggregateAlphaVantage, aggregateFinnhub } from "./sentiment";

describe("aggregateAlphaVantage", () => {
  const feed = [
    {
      title: "Bullish note",
      url: "https://ex/1",
      source: "Source A",
      time_published: "20251201T120000",
      ticker_sentiment: [
        { ticker: "AAPL", relevance_score: "0.9", ticker_sentiment_score: "0.4", ticker_sentiment_label: "Bullish" },
      ],
    },
    {
      title: "Bearish note",
      url: "https://ex/2",
      source: "Source B",
      time_published: "20251202T120000",
      ticker_sentiment: [
        { ticker: "AAPL", relevance_score: "0.1", ticker_sentiment_score: "-0.4", ticker_sentiment_label: "Bearish" },
      ],
    },
    {
      title: "Other ticker",
      url: "https://ex/3",
      source: "Source C",
      time_published: "20251203T120000",
      ticker_sentiment: [
        { ticker: "MSFT", relevance_score: "1", ticker_sentiment_score: "0.6", ticker_sentiment_label: "Bullish" },
      ],
    },
  ];

  it("relevance-weights the sentiment for the requested ticker", () => {
    const result = aggregateAlphaVantage("AAPL", { feed });
    expect(result).not.toBeNull();
    expect(result!.score).toBeCloseTo(0.32, 4);
    expect(result!.articles).toBe(2);
    expect(result!.bullishPct).toBeCloseTo(50);
    expect(result!.bearishPct).toBeCloseTo(50);
    expect(result!.top).toHaveLength(2);
    expect(result!.source).toBe("alphavantage");
  });

  it("sorts headlines newest first", () => {
    const result = aggregateAlphaVantage("AAPL", { feed });
    expect(result!.top[0].title).toBe("Bearish note");
  });

  it("returns null when the ticker is absent", () => {
    expect(aggregateAlphaVantage("TSLA", { feed })).toBeNull();
  });
});

describe("aggregateFinnhub", () => {
  it("maps bullish/bearish percentages to a signed score", () => {
    const result = aggregateFinnhub({
      sentiment: { bullishPercent: 0.6, bearishPercent: 0.2 },
      buzz: { articlesInLastWeek: 20, buzz: 1.3 },
    });
    expect(result!.score).toBeCloseTo(0.4);
    expect(result!.label).toBe("Bullish");
    expect(result!.bullishPct).toBeCloseTo(60);
    expect(result!.articles).toBe(20);
    expect(result!.buzz).toBeCloseTo(1.3);
  });

  it("returns null without sentiment data", () => {
    expect(aggregateFinnhub({})).toBeNull();
  });
});
