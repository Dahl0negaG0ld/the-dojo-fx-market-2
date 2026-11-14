import type { MarketDef } from "./types";

/** Static market catalog. Collectors map their feeds onto these ids. */
export const MARKETS: MarketDef[] = [
  { id: "fx-eurusd", symbol: "EUR/USD", name: "Euro / US Dollar", assetClass: "fx", quoteCurrency: "USD", referenceSource: "Interbank composite (not connected)", settlementRule: "Spot mid at settlement time", decimals: 5, pipSize: 0.0001, defaultFeePct: 0.002, defaultVolPct: 7 },
  { id: "fx-usdjpy", symbol: "USD/JPY", name: "US Dollar / Japanese Yen", assetClass: "fx", quoteCurrency: "JPY", referenceSource: "Interbank composite (not connected)", settlementRule: "Spot mid at settlement time", decimals: 3, pipSize: 0.01, defaultFeePct: 0.002, defaultVolPct: 9 },
  { id: "fx-gbpusd", symbol: "GBP/USD", name: "British Pound / US Dollar", assetClass: "fx", quoteCurrency: "USD", referenceSource: "Interbank composite (not connected)", settlementRule: "Spot mid at settlement time", decimals: 5, pipSize: 0.0001, defaultFeePct: 0.002, defaultVolPct: 8 },
  { id: "fx-audusd", symbol: "AUD/USD", name: "Australian Dollar / US Dollar", assetClass: "fx", quoteCurrency: "USD", referenceSource: "Interbank composite (not connected)", settlementRule: "Spot mid at settlement time", decimals: 5, pipSize: 0.0001, defaultFeePct: 0.002, defaultVolPct: 10 },
  { id: "pm-btc-5m", symbol: "BTC ↑↓ 5m", name: "Bitcoin Up or Down — 5 minute", assetClass: "polymarket", window: "5m", underlying: "BTC", quoteCurrency: "USD", referenceSource: "Chainlink BTC/USD data stream", settlementRule: "YES if BTC/USD at window end ≥ price at window start", decimals: 2, defaultFeePct: 1, defaultVolPct: 50 },
  { id: "pm-btc-15m", symbol: "BTC ↑↓ 15m", name: "Bitcoin Up or Down — 15 minute", assetClass: "polymarket", window: "15m", underlying: "BTC", quoteCurrency: "USD", referenceSource: "Chainlink BTC/USD data stream", settlementRule: "YES if BTC/USD at window end ≥ price at window start", decimals: 2, defaultFeePct: 1, defaultVolPct: 50 },
  { id: "pm-eth-5m", symbol: "ETH ↑↓ 5m", name: "Ethereum Up or Down — 5 minute", assetClass: "polymarket", window: "5m", underlying: "ETH", quoteCurrency: "USD", referenceSource: "Chainlink ETH/USD data stream", settlementRule: "YES if ETH/USD at window end ≥ price at window start", decimals: 2, defaultFeePct: 1, defaultVolPct: 65 },
  { id: "pm-eth-15m", symbol: "ETH ↑↓ 15m", name: "Ethereum Up or Down — 15 minute", assetClass: "polymarket", window: "15m", underlying: "ETH", quoteCurrency: "USD", referenceSource: "Chainlink ETH/USD data stream", settlementRule: "YES if ETH/USD at window end ≥ price at window start", decimals: 2, defaultFeePct: 1, defaultVolPct: 65 },
  { id: "pm-sol-15m", symbol: "SOL ↑↓ 15m", name: "Solana Up or Down — 15 minute", assetClass: "polymarket", window: "15m", underlying: "SOL", quoteCurrency: "USD", referenceSource: "Chainlink SOL/USD data stream", settlementRule: "YES if SOL/USD at window end ≥ price at window start", decimals: 2, defaultFeePct: 1, defaultVolPct: 85 },
  { id: "pm-xrp-15m", symbol: "XRP ↑↓ 15m", name: "XRP Up or Down — 15 minute", assetClass: "polymarket", window: "15m", underlying: "XRP", quoteCurrency: "USD", referenceSource: "Chainlink XRP/USD data stream", settlementRule: "YES if XRP/USD at window end ≥ price at window start", decimals: 4, defaultFeePct: 1, defaultVolPct: 90 },
];

const BY_ID = new Map(MARKETS.map((m) => [m.id, m]));

export function getMarket(id: string): MarketDef | undefined {
  return BY_ID.get(id);
}

export function windowMs(w: "5m" | "15m"): number {
  return (w === "5m" ? 5 : 15) * 60_000;
}