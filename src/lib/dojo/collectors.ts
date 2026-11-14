import { generateSampleQuotes, SAMPLE_SOURCE } from "./sample";
import type { AssetClass, Quote } from "./types";

/**
 * Market collector contract. Future live collectors (FX feed, Polymarket CLOB)
 * should run server-side (server functions / scheduled jobs), store quotes in a
 * cloud database and return them here with provenance.origin = "live".
 */
export interface MarketCollector {
  id: string;
  label: string;
  assetClasses: AssetClass[];
  status: "active" | "not_configured";
  origin: "sample" | "live";
  description: string;
  fetchQuotes?: (opts: { seed: number; nowMs: number }) => Promise<Quote[]>;
}

export const COLLECTORS: MarketCollector[] = [
  {
    id: "sample",
    label: SAMPLE_SOURCE,
    assetClasses: ["fx", "polymarket"],
    status: "active",
    origin: "sample",
    description: "Synthetic quotes for interface testing. NOT LIVE.",
    fetchQuotes: async ({ seed, nowMs }) => generateSampleQuotes(seed, nowMs),
  },
  {
    id: "fx-live",
    label: "FX spot feed",
    assetClasses: ["fx"],
    status: "not_configured",
    origin: "live",
    description: "Requires a market-data provider key stored securely on the server.",
  },
  {
    id: "polymarket-clob",
    label: "Polymarket CLOB collector",
    assetClasses: ["polymarket"],
    status: "not_configured",
    origin: "live",
    description: "Planned scheduled server job reading public order books for crypto 5m/15m markets.",
  },
];

export function activeCollector(): MarketCollector {
  return COLLECTORS.find((c) => c.status === "active" && c.fetchQuotes)!;
}