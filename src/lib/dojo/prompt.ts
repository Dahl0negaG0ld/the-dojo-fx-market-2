import { getMarket } from "./markets";
import { fmtAge } from "./format";
import type { Snapshot } from "./types";

const ORIGIN_LABEL = {
  sample: "SAMPLE — synthetic, NOT LIVE",
  manual: "MANUAL — entered by user, unverified",
  live: "LIVE — collected by a configured feed",
} as const;

const v = (x: number | null | undefined) => (x == null ? "NOT PROVIDED" : String(x));

export function snapshotToJson(s: Snapshot, nowMs: number): string {
  const market = getMarket(s.marketId);
  const quoteAgeSec = s.quoteTime ? Math.round((nowMs - Date.parse(s.quoteTime)) / 1000) : null;
  return JSON.stringify(
    {
      app: "THE DOJO: FX MARKET LAB",
      schemaVersion: s.schemaVersion,
      exportedAt: new Date(nowMs).toISOString(),
      dataOrigin: s.origin,
      isLive: s.origin === "live",
      quoteAgeSecAtExport: quoteAgeSec,
      market: { id: s.marketId, symbol: market?.symbol, name: market?.name, assetClass: s.assetClass },
      snapshot: s,
    },
    null,
    2,
  );
}

export function snapshotToPrompt(s: Snapshot, nowMs: number): string {
  const m = getMarket(s.marketId);
  const age = s.quoteTime ? fmtAge((nowMs - Date.parse(s.quoteTime)) / 1000) : "UNKNOWN";
  const book = s.orderBook.trim() || "NOT PROVIDED";
  return [
    "THE DOJO — MARKET SNAPSHOT FOR REVIEW",
    "=====================================",
    `Data origin: ${ORIGIN_LABEL[s.origin]}`,
    `Market: ${m?.symbol ?? s.marketId} (${m?.name ?? "unknown"}) — ${s.assetClass === "fx" ? "FX spot" : "Polymarket binary"}`,
    `Snapshot created: ${s.createdAt}`,
    `Quote time: ${s.quoteTime ?? "NOT PROVIDED"} (age at export: ${age})`,
    "",
    "PRICES",
    `- Contract price (YES mid, 0–1): ${v(s.contractPrice)}`,
    `- Bid / Ask: ${v(s.bid)} / ${v(s.ask)}`,
    `- Reference price (underlying/spot): ${v(s.referencePrice)}`,
    `- Strike / price to beat: ${v(s.strike)}`,
    "",
    "SETTLEMENT",
    `- Settlement time: ${s.settlementTime ?? "NOT PROVIDED"}`,
    `- Settlement rule: ${s.settlementRule || "NOT PROVIDED"}`,
    `- Reference source: ${s.referenceSource || "NOT PROVIDED"}`,
    "",
    "COSTS & ASSUMPTIONS",
    `- Fee rate: ${s.feePct == null ? "NOT PROVIDED" : `${s.feePct}% of notional per fill`}`,
    `- Volatility assumption (annualized): ${s.volatilityPct == null ? "NOT PROVIDED" : `${s.volatilityPct}%`}`,
    "",
    "ORDER BOOK",
    book,
    "",
    `NOTES: ${s.notes || "none"}`,
    "",
    "INSTRUCTIONS FOR REVIEWER",
    "- Act as a skeptical risk reviewer. Do not invent or assume any value marked NOT PROVIDED.",
    "- Give: bull case, bear case, missing data, fee-adjusted breakeven, your independent fair probability with an uncertainty range.",
    "- Flag stale quotes and reference-source mismatches.",
    "- Conclude TRADE / WATCH / PASS. Default to PASS when data is insufficient.",
    ...(s.origin === "sample" ? ["- This snapshot uses SAMPLE data: treat as an exercise only, never as a live signal."] : []),
  ].join("\n");
}