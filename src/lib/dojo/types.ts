/**
 * Core domain types for THE DOJO. Every quote carries provenance so the UI can
 * never present sample/mock values as live market data.
 */
export type AssetClass = "fx" | "polymarket";
export type DataOrigin = "sample" | "manual" | "live";
export type BinaryWindow = "5m" | "15m";

export interface MarketDef {
  id: string;
  symbol: string;
  name: string;
  assetClass: AssetClass;
  window?: BinaryWindow;
  underlying?: string;
  quoteCurrency: "USD" | "JPY";
  referenceSource: string;
  settlementRule: string;
  decimals: number;
  pipSize?: number;
  defaultFeePct: number;
  defaultVolPct: number;
}

export interface Provenance {
  origin: DataOrigin;
  source: string;
  fetchedAt: string; // ISO timestamp the value was produced/collected
}

export interface FxQuote {
  kind: "fx";
  marketId: string;
  bid: number;
  ask: number;
  mid: number;
  change24hPct: number;
  series: number[];
  provenance: Provenance;
}

export interface BinaryQuote {
  kind: "binary";
  marketId: string;
  yesBid: number;
  yesAsk: number;
  yesMid: number;
  strike: number;
  referencePrice: number;
  windowStart: string;
  windowEnd: string;
  liquidityUsd: number;
  volumeUsd: number;
  series: number[];
  provenance: Provenance;
}

export type Quote = FxQuote | BinaryQuote;

export interface Snapshot {
  id: string;
  schemaVersion: 1;
  createdAt: string;
  marketId: string;
  assetClass: AssetClass;
  origin: DataOrigin;
  contractPrice: number | null; // YES mid, 0–1 (binary only)
  bid: number | null;
  ask: number | null;
  referencePrice: number | null; // current underlying / FX spot
  strike: number | null;
  settlementTime: string | null;
  settlementRule: string;
  referenceSource: string;
  quoteTime: string | null;
  orderBook: string;
  feePct: number | null;
  volatilityPct: number | null;
  notes: string;
}

export type PositionSide = "YES" | "NO" | "LONG" | "SHORT";

export interface PaperPosition {
  id: string;
  marketId: string;
  assetClass: AssetClass;
  side: PositionSide;
  qty: number;
  entryPrice: number;
  feePct: number;
  entryFee: number; // USD
  openedAt: string;
  origin: DataOrigin;
  note: string;
  status: "open" | "closed";
  exitPrice?: number;
  exitFee?: number;
  closedAt?: string;
  closeReason?: "sold" | "resolved";
  resolvedOutcome?: "YES" | "NO";
}

export type HypothesisStatus = "draft" | "testing" | "supported" | "rejected";

export interface Hypothesis {
  id: string;
  title: string;
  statement: string;
  marketId: string | null;
  status: HypothesisStatus;
  priorPct: number | null;
  evidence: string;
  createdAt: string;
  updatedAt: string;
}

export interface Settings {
  privateAccess: boolean;
  bankrollUsd: number;
  maxStakePct: number;
  maxOpenExposurePct: number;
  dailyLossCapUsd: number;
  minEdgePp: number;
  staleAfterSecBinary: number;
  staleAfterSecFx: number;
  alertEmail: string;
  alertOnTrade: boolean;
  alertOnStale: boolean;
  alertOnDrawdown: boolean;
}