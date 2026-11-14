import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from "recharts";
import { AlertTriangle, Camera, RefreshCw, Search, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { PageHeader } from "@/components/dojo/PageHeader";
import { DataTag, ProvenanceBar, Tag } from "@/components/dojo/DataTag";
import { Sparkline } from "@/components/dojo/Sparkline";
import { activeCollector, COLLECTORS } from "@/lib/dojo/collectors";
import { getMarket } from "@/lib/dojo/markets";
import { fmtAge, fmtNum } from "@/lib/dojo/format";
import { useNow } from "@/hooks/use-now";
import type { BinaryQuote, FxQuote, Quote } from "@/lib/dojo/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Scanner — The Dojo: FX Market Lab" },
      { name: "description", content: "Scan FX majors and Polymarket crypto 5m/15m markets with clearly labelled data provenance." },
      { property: "og:title", content: "Scanner — The Dojo: FX Market Lab" },
      { property: "og:description", content: "Scan FX majors and Polymarket crypto 5m/15m markets with clearly labelled data provenance." },
    ],
  }),
  component: Scanner,
});

type ClassFilter = "all" | "fx" | "polymarket";
type WindowFilter = "all" | "5m" | "15m";
type SortKey = "default" | "move" | "expiry" | "spread";

function movePct(q: Quote) {
  const s = q.series;
  return ((s[s.length - 1] - s[0]) / s[0]) * 100;
}

function Scanner() {
  const now = useNow(1000);
  const [quotes, setQuotes] = useState<Quote[] | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [auto, setAuto] = useState(false);
  const [cls, setCls] = useState<ClassFilter>("all");
  const [win, setWin] = useState<WindowFilter>("all");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("default");
  const [selected, setSelected] = useState("pm-btc-15m");

  const refresh = useCallback(async () => {
    const nowMs = Date.now();
    const next = await activeCollector().fetchQuotes!({ seed: nowMs & 0xffffffff, nowMs });
    setQuotes(next);
    setFetchedAt(new Date(nowMs).toISOString());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    if (!auto) return;
    const id = setInterval(() => void refresh(), 15000);
    return () => clearInterval(id);
  }, [auto, refresh]);

  const filtered = useMemo(() => {
    if (!quotes) return [];
    let list = quotes.filter((x) => {
      const m = getMarket(x.marketId)!;
      if (cls !== "all" && m.assetClass !== cls) return false;
      if (win !== "all" && m.assetClass === "polymarket" && m.window !== win) return false;
      if (win !== "all" && m.assetClass === "fx" && cls === "all") return false;
      if (q && !`${m.symbol} ${m.name} ${m.underlying ?? ""}`.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
    if (sort === "move") list = [...list].sort((a, b) => Math.abs(movePct(b)) - Math.abs(movePct(a)));
    if (sort === "expiry")
      list = [...list].sort((a, b) => (a.kind === "binary" ? Date.parse(a.windowEnd) : Infinity) - (b.kind === "binary" ? Date.parse(b.windowEnd) : Infinity));
    if (sort === "spread")
      list = [...list].sort((a, b) => spreadRel(a) - spreadRel(b));
    return list;
  }, [quotes, cls, win, q, sort]);

  const selectedQuote = quotes?.find((x) => x.marketId === selected) ?? null;
  const fx = filtered.filter((x): x is FxQuote => x.kind === "fx");
  const pm = filtered.filter((x): x is BinaryQuote => x.kind === "binary");

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Market intelligence"
        title="Scanner"
        description="FX majors and Polymarket crypto up/down windows. Every value shows where it came from."
        actions={
          <>
            <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5">
              <Switch id="auto" checked={auto} onCheckedChange={setAuto} />
              <Label htmlFor="auto" className="text-xs text-muted-foreground">Auto-refresh 15s</Label>
            </div>
            <Button variant="outline" size="sm" onClick={() => void refresh()}>
              <RefreshCw /> Refresh sample
            </Button>
          </>
        }
      />

      <div role="alert" className="flex items-start gap-3 rounded-xl border border-warning/35 bg-warning-soft px-4 py-3 text-sm">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
        <p className="text-foreground">
          <span className="font-medium text-warning">No live feed connected.</span> All quotes below are synthetic SAMPLE values for interface testing. They are{" "}
          <span className="font-medium">not live prices and not trading signals</span>.
        </p>
      </div>

      <ProvenanceBar origin="sample" source={activeCollector().label} updatedAt={fetchedAt} nowMs={now} />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <ToggleGroup type="single" value={cls} onValueChange={(v) => v && setCls(v as ClassFilter)} variant="outline" size="sm" aria-label="Asset class">
          <ToggleGroupItem value="all">All</ToggleGroupItem>
          <ToggleGroupItem value="fx">FX</ToggleGroupItem>
          <ToggleGroupItem value="polymarket">Polymarket</ToggleGroupItem>
        </ToggleGroup>
        <ToggleGroup type="single" value={win} onValueChange={(v) => v && setWin(v as WindowFilter)} variant="outline" size="sm" aria-label="Window" disabled={cls === "fx"}>
          <ToggleGroupItem value="all">Any window</ToggleGroupItem>
          <ToggleGroupItem value="5m">5m</ToggleGroupItem>
          <ToggleGroupItem value="15m">15m</ToggleGroupItem>
        </ToggleGroup>
        <div className="relative lg:ml-auto lg:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search markets" className="pl-8" aria-label="Search markets" />
        </div>
        <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
          <SelectTrigger className="lg:w-44" aria-label="Sort">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default">Sort: Default</SelectItem>
            <SelectItem value="move">Sort: Largest move</SelectItem>
            <SelectItem value="expiry">Sort: Soonest expiry</SelectItem>
            <SelectItem value="spread">Sort: Tightest spread</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {selectedQuote && <FeaturedChart quote={selectedQuote} />}

      {!quotes ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="panel h-40 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {fx.length > 0 && (
            <section aria-labelledby="fx-h" className="space-y-3">
              <h2 id="fx-h" className="eyebrow">FX spot · {fx.length}</h2>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {fx.map((x) => (
                  <FxCard key={x.marketId} q={x} active={selected === x.marketId} onSelect={() => setSelected(x.marketId)} />
                ))}
              </div>
            </section>
          )}
          {pm.length > 0 && (
            <section aria-labelledby="pm-h" className="space-y-3">
              <h2 id="pm-h" className="eyebrow">Polymarket crypto up/down · {pm.length}</h2>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {pm.map((x) => (
                  <BinaryCard key={x.marketId} q={x} now={now} active={selected === x.marketId} onSelect={() => setSelected(x.marketId)} />
                ))}
              </div>
            </section>
          )}
          {fx.length + pm.length === 0 && <p className="text-sm text-muted-foreground">No markets match these filters.</p>}
        </>
      )}

      <section aria-labelledby="col-h" className="panel p-4 md:p-5">
        <h2 id="col-h" className="eyebrow">Data collectors</h2>
        <ul className="mt-3 divide-y divide-border">
          {COLLECTORS.map((c) => (
            <li key={c.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:gap-4">
              <span className="flex items-center gap-2 text-sm text-foreground sm:w-64">
                {c.status === "active" ? <Wifi className="size-4 text-warning" aria-hidden /> : <WifiOff className="size-4 text-muted-foreground" aria-hidden />}
                {c.label}
              </span>
              <span className="text-xs text-muted-foreground sm:flex-1">{c.description}</span>
              {c.status === "active" ? <Tag tone="sample">Active · sample</Tag> : <Tag tone="neutral">Not configured</Tag>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function spreadRel(x: Quote) {
  return x.kind === "fx" ? (x.ask - x.bid) / x.mid : x.yesAsk - x.yesBid;
}

function FxCard({ q, active, onSelect }: { q: FxQuote; active: boolean; onSelect: () => void }) {
  const m = getMarket(q.marketId)!;
  const up = q.change24hPct >= 0;
  const pips = (q.ask - q.bid) / (m.pipSize ?? 0.0001);
  return (
    <article className={cn("panel flex flex-col p-4 transition-colors", active && "border-positive/50")}>
      <button type="button" onClick={onSelect} className="text-left" aria-pressed={active}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-medium text-foreground">{m.symbol}</h3>
            <p className="text-[11px] text-muted-foreground">{m.name}</p>
          </div>
          <DataTag origin={q.provenance.origin} />
        </div>
        <div className="mt-3 flex items-baseline justify-between">
          <span className="num text-2xl text-foreground">{fmtNum(q.mid, m.decimals)}</span>
          <span className={cn("num text-xs", up ? "text-positive" : "text-negative")}>
            {up ? "+" : ""}
            {q.change24hPct.toFixed(3)}%
          </span>
        </div>
        <div className="mt-2">
          <Sparkline data={q.series} up={up} />
        </div>
        <dl className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
          <div><dt className="text-muted-foreground">Bid</dt><dd className="num text-foreground">{fmtNum(q.bid, m.decimals)}</dd></div>
          <div><dt className="text-muted-foreground">Ask</dt><dd className="num text-foreground">{fmtNum(q.ask, m.decimals)}</dd></div>
          <div><dt className="text-muted-foreground">Spread</dt><dd className="num text-foreground">{pips.toFixed(1)} pip</dd></div>
        </dl>
      </button>
      <Button asChild variant="ghost" size="sm" className="mt-3 justify-start px-2 text-muted-foreground">
        <Link to="/snapshot" search={{ market: q.marketId }}>
          <Camera /> Open in Snapshot Studio
        </Link>
      </Button>
    </article>
  );
}

function BinaryCard({ q, now, active, onSelect }: { q: BinaryQuote; now: number | null; active: boolean; onSelect: () => void }) {
  const m = getMarket(q.marketId)!;
  const left = now ? (Date.parse(q.windowEnd) - now) / 1000 : null;
  const closed = left != null && left <= 0;
  const dist = ((q.referencePrice - q.strike) / q.strike) * 100;
  return (
    <article className={cn("panel flex flex-col p-4 transition-colors", active && "border-positive/50")}>
      <button type="button" onClick={onSelect} className="text-left" aria-pressed={active}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-medium text-foreground">
              {m.symbol}
              <Tag tone="neutral">{m.window}</Tag>
            </h3>
            <p className="text-[11px] text-muted-foreground">{m.name}</p>
          </div>
          <DataTag origin={q.provenance.origin} />
        </div>
        <div className="mt-3 flex items-end justify-between gap-3">
          <div>
            <p className="eyebrow">YES mid</p>
            <p className="num text-3xl text-foreground">{Math.round(q.yesMid * 100)}¢</p>
          </div>
          <div className="text-right">
            <p className="eyebrow">Window ends</p>
            <p className={cn("num text-lg", closed ? "text-negative" : left != null && left < 60 ? "text-warning" : "text-foreground")}>
              {left == null ? "—" : closed ? "Closed" : fmtAge(left)}
            </p>
          </div>
        </div>
        <div className="mt-2">
          <Sparkline data={q.series} up={dist >= 0} />
        </div>
        <dl className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
          <div><dt className="text-muted-foreground">Bid / Ask</dt><dd className="num text-foreground">{Math.round(q.yesBid * 100)} / {Math.round(q.yesAsk * 100)}¢</dd></div>
          <div><dt className="text-muted-foreground">vs strike</dt><dd className={cn("num", dist >= 0 ? "text-positive" : "text-negative")}>{dist >= 0 ? "+" : ""}{dist.toFixed(3)}%</dd></div>
          <div><dt className="text-muted-foreground">Liquidity</dt><dd className="num text-foreground">${(q.liquidityUsd / 1000).toFixed(1)}k</dd></div>
        </dl>
        {closed && <p className="mt-2 text-[11px] text-negative">Sample window closed — refresh sample to roll forward.</p>}
      </button>
      <Button asChild variant="ghost" size="sm" className="mt-3 justify-start px-2 text-muted-foreground">
        <Link to="/snapshot" search={{ market: q.marketId }}>
          <Camera /> Open in Snapshot Studio
        </Link>
      </Button>
    </article>
  );
}

function FeaturedChart({ quote }: { quote: Quote }) {
  const m = getMarket(quote.marketId)!;
  const data = quote.series.map((v, i) => ({ i: i - quote.series.length + 1, v }));
  const up = quote.series[quote.series.length - 1] >= quote.series[0];
  const color = up ? "var(--color-positive)" : "var(--color-negative)";
  return (
    <section className="panel p-4 md:p-5" aria-label={`${m.symbol} chart`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <h2 className="font-display text-2xl text-foreground">{m.symbol}</h2>
          <DataTag origin={quote.provenance.origin} />
        </div>
        <p className="text-xs text-muted-foreground">
          {quote.kind === "binary" ? `${m.underlying}/USD reference path · strike ${fmtNum(quote.strike, m.decimals)}` : "Mid price path"} · synthetic
        </p>
      </div>
      <div className="mt-4 h-56">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="feat" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.25} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--grid-line)" vertical={false} />
            <XAxis dataKey="i" tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis domain={["dataMin", "dataMax"]} width={72} tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => v.toFixed(m.decimals > 3 ? 4 : 2)} />
            <Tooltip
              contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }}
              labelFormatter={(l) => `t ${l} (sample)`}
              formatter={(v: number) => [fmtNum(v, m.decimals), "Sample value"]}
            />
            {quote.kind === "binary" && <ReferenceLine y={quote.strike} stroke="var(--color-warning)" strokeDasharray="4 4" />}
            <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.75} fill="url(#feat)" isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}