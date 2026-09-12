import { describe, expect, it } from "vitest";
import { toRow } from "./scoring";
import { toCsv } from "./csv";

describe("toCsv", () => {
  it("includes a header row and escapes commas and quotes", () => {
    const csv = toCsv(
      [
        toRow({
          symbol: "AAA",
          name: 'Acme, "The" Corp',
          price: 100,
          targetMean: 120,
          source: "demo",
          fetchedAt: Date.now(),
        }),
      ],
    );
    const [header, line] = csv.split("\n");
    expect(header).toContain("Upside %");
    expect(header).toContain("Dispersion %");
    expect(line).toContain('"Acme, ""The"" Corp"');
  });
});
