import type { MarketDef, Settings, Snapshot } from "./types";

/** Standard normal CDF (Abramowitz–Stegun 7.1.26). */
export function normCdf(x: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(x) / Math.SQRT2);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-(x * x) / 2);
  return x >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}

/** P(S_T >= K) under a driftless lognormal model. Returns null if inputs are invalid. */
export function probAbove(spot: number, strike: number, volPct: number, tYears: number): number | null {
  if (!(spot > 0) || !(strike > 0) || !(volPct > 0) || !(tYears > 0)) return null;
  const sigma = volPct / 100;
  const d2 = (Math.log(spot / strike) - 0.5 * sigma * sigma * tYears) / (sigma * Math.sqrt(tYears));
  return normCdf(d2);
}

/** Fee-adjusted breakeven probability for buying a binary contract at `price` (0–1). */
export function feeAdjustedBreakeven(price: number, feePct: number): number {
  return price * (1 + feePct / 100);
}

export type Verdict = "TRADE" | "WATCH" | "PASS";

export interface Review {
  verdict: Verdict;
  verdictReasons: string[];
  missing: string[];
  warnings: string[];
  bull: string[];
  bear: string[];
  fair: { p: number; low: number; high: number } | null;
  breakeven: { yes: number; no: number } | null;
  implied: number | null;
  bestSide: { side: "YES" | "NO"; edge: number; conservativeEdge: number } | null;
  quoteAgeSec: number | null;
  stale: boolean;
  minutesToSettlement: number | null;
}

const pp = (x: number) => `${(x * 100).toFixed(1)}pp`;
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

export function analyzeSnapshot(
  s: Snapshot,
  market: MarketDef | undefined,
  settings: Pick<Settings, "minEdgePp" | "staleAfterSecBinary" | "staleAfterSecFx">,
  nowMs: number,
): Review {
  const missing: string[] = [];
  const warnings: string[] = [];
  const bull: string[] = [];
  const bear: string[] = [];
  const verdictReasons: string[] = [];

  const isBinary = s.assetClass === "polymarket";
  const price = s.ask ?? s.contractPrice;
  if (s.contractPrice == null && s.ask == null) missing.push(isBinary ? "Contract price (YES mid or ask)" : "Tradable contract price (FX snapshots need a binary/strike contract price to evaluate)");
  if (s.referencePrice == null) missing.push("Current reference price");
  if (s.strike == null) missing.push("Strike / price to beat");
  if (!s.settlementTime) missing.push("Settlement time");
  if (!s.quoteTime) missing.push("Quote timestamp");
  if (s.volatilityPct == null) missing.push("Volatility assumption");
  if (s.feePct == null) missing.push("Fee rate");
  if (!s.referenceSource.trim()) missing.push("Reference source");
  if (!s.orderBook.trim()) missing.push("Order book depth (optional, but fills may differ)");

  const quoteAgeSec = s.quoteTime ? Math.max(0, (nowMs - Date.parse(s.quoteTime)) / 1000) : null;
  const staleLimit = isBinary ? settings.staleAfterSecBinary : settings.staleAfterSecFx;
  const stale = quoteAgeSec != null && quoteAgeSec > staleLimit;
  if (stale) warnings.push(`Stale quote: ${Math.round(quoteAgeSec!)}s old (limit ${staleLimit}s). Re-capture before acting.`);

  const settleMs = s.settlementTime ? Date.parse(s.settlementTime) : NaN;
  const minutesToSettlement = Number.isFinite(settleMs) ? (settleMs - nowMs) / 60000 : null;
  const expired = minutesToSettlement != null && minutesToSettlement <= 0;
  if (expired) warnings.push("Settlement time has passed. This contract is no longer tradable.");

  if (s.origin === "sample") warnings.push("Inputs are SAMPLE data (NOT LIVE). Any result is illustrative only and can never produce TRADE.");
  if (market && s.referenceSource.trim() && market.referenceSource !== s.referenceSource.trim()) {
    warnings.push(`Reference source differs from the market's settlement source (${market.referenceSource}).`);
  }

  // Independent fair probability — only when every model input is present.
  let fair: Review["fair"] = null;
  const critical = [s.referencePrice, s.strike, s.volatilityPct].every((v) => v != null) && minutesToSettlement != null;
  if (critical && !expired) {
    const t = minutesToSettlement! / (365 * 24 * 60);
    const p = probAbove(s.referencePrice!, s.strike!, s.volatilityPct!, t);
    const a = probAbove(s.referencePrice!, s.strike!, s.volatilityPct! * 0.75, t);
    const b = probAbove(s.referencePrice!, s.strike!, s.volatilityPct! * 1.25, t);
    if (p != null && a != null && b != null) fair = { p, low: Math.min(a, b, p), high: Math.max(a, b, p) };
  }

  let breakeven: Review["breakeven"] = null;
  let bestSide: Review["bestSide"] = null;
  if (price != null && s.feePct != null) {
    const noPrice = 1 - (s.bid ?? s.contractPrice ?? price);
    breakeven = { yes: feeAdjustedBreakeven(price, s.feePct), no: feeAdjustedBreakeven(noPrice, s.feePct) };
    if (fair) {
      const yesEdge = fair.p - breakeven.yes;
      const noEdge = 1 - fair.p - breakeven.no;
      bestSide =
        yesEdge >= noEdge
          ? { side: "YES", edge: yesEdge, conservativeEdge: fair.low - breakeven.yes }
          : { side: "NO", edge: noEdge, conservativeEdge: 1 - fair.high - breakeven.no };
    }
  }

  // Evidence lists derived only from supplied numbers.
  if (fair && breakeven && bestSide) {
    const be = bestSide.side === "YES" ? breakeven.yes : breakeven.no;
    const fp = bestSide.side === "YES" ? fair.p : 1 - fair.p;
    (bestSide.edge > 0 ? bull : bear).push(`Model fair ${pct(fp)} vs fee-adjusted breakeven ${pct(be)} on ${bestSide.side} → ${bestSide.edge >= 0 ? "+" : ""}${pp(bestSide.edge)} point edge.`);
    if (bestSide.conservativeEdge > 0) bull.push(`Edge survives the low end of the volatility band (${pp(bestSide.conservativeEdge)} conservative).`);
    else bear.push(`Edge does not survive ±25% volatility uncertainty (conservative ${pp(bestSide.conservativeEdge)}).`);
    if (s.feePct != null && price != null) bear.push(`Fees consume ${pp(price * (s.feePct / 100))} of probability on YES.`);
  }
  if (s.referencePrice != null && s.strike != null && minutesToSettlement != null && !expired) {
    const dist = (s.referencePrice - s.strike) / s.strike;
    const line = `Reference is ${Math.abs(dist * 100).toFixed(3)}% ${dist >= 0 ? "above" : "below"} strike with ${minutesToSettlement.toFixed(1)} min to settlement.`;
    (dist >= 0 ? bull : bear).push(line);
    if (minutesToSettlement < 2) bear.push("Under 2 minutes remain — microstructure noise and oracle timing dominate.");
  }
  if (s.bid != null && s.ask != null) {
    const spread = s.ask - s.bid;
    if (isBinary) (spread <= 0.02 ? bull : bear).push(`Spread ${pp(spread)} ${spread <= 0.02 ? "is tight" : "is wide — expect slippage"}.`);
  }
  if (!s.orderBook.trim()) bear.push("No order book depth supplied; realistic fill size is unknown.");
  if (s.volatilityPct != null) bear.push(`Volatility ${s.volatilityPct}% is a user assumption, not an observed value.`);
  if (stale) bear.push("Quote is stale; the market may have moved.");

  // Verdict — defaults to PASS.
  let verdict: Verdict = "PASS";
  const hardMissing = missing.filter((m) => !m.startsWith("Order book"));
  if (hardMissing.length) verdictReasons.push(`Insufficient data: ${hardMissing.length} required input(s) missing.`);
  else if (expired) verdictReasons.push("Contract has settled or expired.");
  else if (stale) verdictReasons.push("Quote is stale.");
  else if (!fair || !bestSide) verdictReasons.push("Could not compute a fair estimate from the inputs.");
  else if (bestSide.conservativeEdge >= settings.minEdgePp / 100) {
    verdict = "TRADE";
    verdictReasons.push(`Conservative edge ${pp(bestSide.conservativeEdge)} ≥ minimum ${settings.minEdgePp}pp on ${bestSide.side}.`);
  } else if (bestSide.edge > 0) {
    verdict = "WATCH";
    verdictReasons.push(`Positive point edge (${pp(bestSide.edge)}) but not robust to uncertainty / below ${settings.minEdgePp}pp minimum.`);
  } else {
    verdictReasons.push("No positive edge after fees.");
  }
  if (verdict === "TRADE" && s.origin === "sample") {
    verdict = "WATCH";
    verdictReasons.push("Capped at WATCH: SAMPLE inputs cannot produce a TRADE signal.");
  }

  return {
    verdict,
    verdictReasons,
    missing,
    warnings,
    bull,
    bear,
    fair,
    breakeven,
    implied: s.contractPrice,
    bestSide,
    quoteAgeSec,
    stale,
    minutesToSettlement,
  };
}