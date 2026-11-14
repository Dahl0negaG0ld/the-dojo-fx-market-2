import { MARKETS, windowMs } from "./markets";
import { probAbove } from "./analysis";
import type { BinaryQuote, FxQuote, Quote } from "./types";

/**
 * SAMPLE generator. Produces clearly-labelled mock quotes for UI development.
 * Values are synthetic and must never be treated as live signals.
 */
export const SAMPLE_SOURCE = "Built-in sample generator (synthetic)";

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gauss(rand: () => number) {
  const u = Math.max(rand(), 1e-9);
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

const FX_BASE: Record<string, number> = {
  "fx-eurusd": 1.085,
  "fx-usdjpy": 151.2,
  "fx-gbpusd": 1.27,
  "fx-audusd": 0.655,
};
const CRYPTO_BASE: Record<string, number> = { BTC: 95000, ETH: 3400, SOL: 180, XRP: 0.62 };

function walk(rand: () => number, start: number, stepPct: number, n: number) {
  const out = [start];
  for (let i = 1; i < n; i++) out.push(out[i - 1] * (1 + gauss(rand) * stepPct));
  return out;
}

const round = (v: number, d: number) => Number(v.toFixed(d));

export function generateSampleQuotes(seed: number, nowMs: number): Quote[] {
  const rand = mulberry32(seed);
  const fetchedAt = new Date(nowMs).toISOString();
  const provenance = { origin: "sample" as const, source: SAMPLE_SOURCE, fetchedAt };

  return MARKETS.map((m): Quote => {
    if (m.assetClass === "fx") {
      const base = FX_BASE[m.id] * (1 + gauss(rand) * 0.002);
      const series = walk(rand, base, 0.0006, 48).map((v) => round(v, m.decimals));
      const mid = series[series.length - 1];
      const halfSpread = (m.pipSize ?? 0.0001) * (0.4 + rand() * 0.6);
      const q: FxQuote = {
        kind: "fx",
        marketId: m.id,
        bid: round(mid - halfSpread, m.decimals),
        ask: round(mid + halfSpread, m.decimals),
        mid,
        change24hPct: round(((mid - series[0]) / series[0]) * 100, 3),
        series,
        provenance,
      };
      return q;
    }
    const w = windowMs(m.window ?? "15m");
    const windowEndMs = Math.ceil(nowMs / w) * w;
    const windowStartMs = windowEndMs - w;
    const base = CRYPTO_BASE[m.underlying ?? "BTC"] * (1 + gauss(rand) * 0.01);
    const series = walk(rand, base, 0.0008, 40).map((v) => round(v, m.decimals));
    const strike = series[0];
    const ref = series[series.length - 1];
    const tYears = Math.max(windowEndMs - nowMs, 1000) / (365 * 24 * 3600 * 1000);
    const model = probAbove(ref, strike, m.defaultVolPct, tYears) ?? 0.5;
    const noisy = Math.min(0.97, Math.max(0.03, model + gauss(rand) * 0.04));
    const yesMid = round(noisy, 2);
    const q: BinaryQuote = {
      kind: "binary",
      marketId: m.id,
      yesMid,
      yesBid: round(Math.max(0.01, yesMid - 0.01), 2),
      yesAsk: round(Math.min(0.99, yesMid + 0.01), 2),
      strike,
      referencePrice: ref,
      windowStart: new Date(windowStartMs).toISOString(),
      windowEnd: new Date(windowEndMs).toISOString(),
      liquidityUsd: Math.round(5000 + rand() * 60000),
      volumeUsd: Math.round(2000 + rand() * 150000),
      series,
      provenance,
    };
    return q;
  });
}