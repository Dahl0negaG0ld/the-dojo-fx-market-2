import type { MarketDef, PaperPosition } from "./types";

/** Paper-trading math. All amounts are USD. No real orders are ever placed. */

export function directionOf(side: PaperPosition["side"]): 1 | -1 {
  return side === "SHORT" ? -1 : 1;
}

/** USD notional of a fill. Binary: qty × price. FX: base units valued in USD. */
export function notionalUsd(assetClass: PaperPosition["assetClass"], market: Pick<MarketDef, "quoteCurrency"> | undefined, qty: number, price: number): number {
  if (assetClass === "polymarket") return qty * price;
  if (market?.quoteCurrency === "JPY") return qty; // USD/JPY: base currency is USD
  return qty * price;
}

export function feeFor(notional: number, feePct: number): number {
  return Math.max(0, notional * (feePct / 100));
}

/** Gross P&L in USD between entry and exit price (before fees). */
export function grossPnl(p: Pick<PaperPosition, "assetClass" | "side" | "qty" | "entryPrice">, market: Pick<MarketDef, "quoteCurrency"> | undefined, exitPrice: number): number {
  const raw = (exitPrice - p.entryPrice) * p.qty * directionOf(p.side);
  if (p.assetClass === "fx" && market?.quoteCurrency === "JPY") return raw / exitPrice;
  return raw;
}

export function realizedPnl(p: PaperPosition, market: Pick<MarketDef, "quoteCurrency"> | undefined): number | null {
  if (p.status !== "closed" || p.exitPrice == null) return null;
  return grossPnl(p, market, p.exitPrice) - p.entryFee - (p.exitFee ?? 0);
}

/** Exit price for resolving a binary position: 1 if the held side wins, else 0. */
export function resolutionPrice(side: PaperPosition["side"], outcome: "YES" | "NO"): number {
  return side === outcome ? 1 : 0;
}

export interface EquityPoint {
  t: string;
  equity: number;
  drawdown: number; // ≤ 0, USD below running peak
}

export interface PortfolioStats {
  realized: number;
  fees: number;
  equity: number;
  maxDrawdown: number; // positive USD
  maxDrawdownPct: number; // 0–1
  wins: number;
  losses: number;
  winRate: number | null;
  openCount: number;
  openExposure: number;
  curve: EquityPoint[];
}

export function computeStats(positions: PaperPosition[], bankroll: number, getMarket: (id: string) => Pick<MarketDef, "quoteCurrency"> | undefined): PortfolioStats {
  const closed = positions
    .filter((p) => p.status === "closed" && p.closedAt)
    .sort((a, b) => Date.parse(a.closedAt!) - Date.parse(b.closedAt!));
  let equity = bankroll;
  let peak = bankroll;
  let maxDd = 0;
  let maxDdPct = 0;
  let wins = 0;
  let losses = 0;
  let fees = 0;
  const curve: EquityPoint[] = [{ t: "start", equity: bankroll, drawdown: 0 }];
  for (const p of closed) {
    const pnl = realizedPnl(p, getMarket(p.marketId)) ?? 0;
    fees += p.entryFee + (p.exitFee ?? 0);
    if (pnl > 0) wins++;
    else losses++;
    equity += pnl;
    peak = Math.max(peak, equity);
    const dd = peak - equity;
    if (dd > maxDd) maxDd = dd;
    if (peak > 0 && dd / peak > maxDdPct) maxDdPct = dd / peak;
    curve.push({ t: p.closedAt!, equity, drawdown: -dd });
  }
  const open = positions.filter((p) => p.status === "open");
  fees += open.reduce((s, p) => s + p.entryFee, 0);
  const openExposure = open.reduce((s, p) => s + notionalUsd(p.assetClass, getMarket(p.marketId), p.qty, p.entryPrice), 0);
  const realized = equity - bankroll;
  return {
    realized,
    fees,
    equity: equity - open.reduce((s, p) => s + p.entryFee, 0),
    maxDrawdown: maxDd,
    maxDrawdownPct: maxDdPct,
    wins,
    losses,
    winRate: wins + losses ? wins / (wins + losses) : null,
    openCount: open.length,
    openExposure,
    curve,
  };
}