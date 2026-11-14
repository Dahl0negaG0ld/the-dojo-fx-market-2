import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Braces, Clock, Copy, FlaskConical, RotateCcw, Save, Scale, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { PageHeader, EmptyState } from "@/components/dojo/PageHeader";
import { DataTag, StorageTag, Tag } from "@/components/dojo/DataTag";
import { MARKETS, getMarket } from "@/lib/dojo/markets";
import { activeCollector } from "@/lib/dojo/collectors";
import { useSnapshots } from "@/lib/dojo/storage";
import { snapshotToJson, snapshotToPrompt } from "@/lib/dojo/prompt";
import { copyText } from "@/lib/dojo/clipboard";
import { fmtAge, fmtDateTime, isoToLocalInput, localInputToIso, parseNum } from "@/lib/dojo/format";
import { useNow } from "@/hooks/use-now";
import type { DataOrigin, Snapshot } from "@/lib/dojo/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/snapshot")({
  validateSearch: (s: Record<string, unknown>): { market?: string } => ({
    market: typeof s.market === "string" && getMarket(s.market) ? s.market : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Snapshot Studio — The Dojo: FX Market Lab" },
      { name: "description", content: "Capture market snapshots with quote age, order book and fees, then copy a structured prompt or JSON." },
      { property: "og:title", content: "Snapshot Studio — The Dojo: FX Market Lab" },
      { property: "og:description", content: "Capture market snapshots with quote age, order book and fees, then copy a structured prompt or JSON." },
    ],
  }),
  component: SnapshotStudio,
});

interface Draft {
  marketId: string;
  origin: Exclude<DataOrigin, "live">;
  contractPrice: string;
  bid: string;
  ask: string;
  referencePrice: string;
  strike: string;
  settlementTime: string;
  settlementRule: string;
  referenceSource: string;
  quoteTime: string;
  orderBook: string;
  feePct: string;
  volatilityPct: string;
  notes: string;
}

function blankDraft(marketId: string): Draft {
  const m = getMarket(marketId)!;
  return {
    marketId,
    origin: "manual",
    contractPrice: "",
    bid: "",
    ask: "",
    referencePrice: "",
    strike: "",
    settlementTime: "",
    settlementRule: m.settlementRule,
    referenceSource: m.referenceSource,
    quoteTime: "",
    orderBook: "",
    feePct: String(m.defaultFeePct),
    volatilityPct: String(m.defaultVolPct),
    notes: "",
  };
}

function toSnapshot(d: Draft, id: string, createdAt: string): Snapshot {
  const m = getMarket(d.marketId)!;
  return {
    id,
    schemaVersion: 1,
    createdAt,
    marketId: d.marketId,
    assetClass: m.assetClass,
    origin: d.origin,
    contractPrice: parseNum(d.contractPrice),
    bid: parseNum(d.bid),
    ask: parseNum(d.ask),
    referencePrice: parseNum(d.referencePrice),
    strike: parseNum(d.strike),
    settlementTime: localInputToIso(d.settlementTime),
    settlementRule: d.settlementRule,
    referenceSource: d.referenceSource,
    quoteTime: localInputToIso(d.quoteTime),
    orderBook: d.orderBook,
    feePct: parseNum(d.feePct),
    volatilityPct: parseNum(d.volatilityPct),
    notes: d.notes,
  };
}

function fromSnapshot(s: Snapshot): Draft {
  const str = (v: number | null) => (v == null ? "" : String(v));
  return {
    marketId: s.marketId,
    origin: s.origin === "live" ? "manual" : s.origin,
    contractPrice: str(s.contractPrice),
    bid: str(s.bid),
    ask: str(s.ask),
    referencePrice: str(s.referencePrice),
    strike: str(s.strike),
    settlementTime: isoToLocalInput(s.settlementTime),
    settlementRule: s.settlementRule,
    referenceSource: s.referenceSource,
    quoteTime: isoToLocalInput(s.quoteTime),
    orderBook: s.orderBook,
    feePct: str(s.feePct),
    volatilityPct: str(s.volatilityPct),
    notes: s.notes,
  };
}

function SnapshotStudio() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const now = useNow(1000);
  const { items: snapshots, upsert, remove } = useSnapshots();
  const [draft, setDraft] = useState<Draft>(() => blankDraft(search.market ?? "pm-btc-15m"));
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (search.market && search.market !== draft.marketId) {
      setDraft(blankDraft(search.market));
      setEditingId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.market]);

  const market = getMarket(draft.marketId)!;
  const isBinary = market.assetClass === "polymarket";
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const preview = useMemo(() => toSnapshot(draft, editingId ?? "unsaved", now ? new Date(now).toISOString() : ""), [draft, editingId, now]);
  const quoteAge = preview.quoteTime && now ? (now - Date.parse(preview.quoteTime)) / 1000 : null;
  const staleLimit = isBinary ? 30 : 120;

  async function prefillSample() {
    const nowMs = Date.now();
    const quotes = await activeCollector().fetchQuotes!({ seed: nowMs & 0xffffffff, nowMs });
    const q = quotes.find((x) => x.marketId === draft.marketId)!;
    const base = blankDraft(draft.marketId);
    if (q.kind === "binary") {
      setDraft({
        ...base,
        origin: "sample",
        contractPrice: String(q.yesMid),
        bid: String(q.yesBid),
        ask: String(q.yesAsk),
        referencePrice: String(q.referencePrice),
        strike: String(q.strike),
        settlementTime: isoToLocalInput(q.windowEnd),
        quoteTime: isoToLocalInput(q.provenance.fetchedAt),
        orderBook: `BIDS (YES)\n${q.yesBid} x 850\n${(q.yesBid - 0.01).toFixed(2)} x 2,100\nASKS (YES)\n${q.yesAsk} x 640\n${(q.yesAsk + 0.01).toFixed(2)} x 1,900`,
        notes: "Prefilled from SAMPLE generator — not a live quote.",
      });
    } else {
      setDraft({
        ...base,
        origin: "sample",
        bid: String(q.bid),
        ask: String(q.ask),
        referencePrice: String(q.mid),
        quoteTime: isoToLocalInput(q.provenance.fetchedAt),
        notes: "Prefilled from SAMPLE generator — not a live quote.",
      });
    }
    toast.message("Prefilled with SAMPLE values", { description: "These are synthetic and marked NOT LIVE." });
  }

  function save() {
    const id = editingId ?? crypto.randomUUID();
    const existing = snapshots.find((s) => s.id === id);
    const snap = toSnapshot(draft, id, existing?.createdAt ?? new Date().toISOString());
    upsert(snap);
    setEditingId(id);
    toast.success(existing ? "Snapshot updated" : "Snapshot saved", { description: "Stored in this browser." });
    return snap;
  }

  const field = (k: keyof Draft, label: string, opts: { placeholder?: string; step?: string; hint?: string; type?: string } = {}) => (
    <div className="space-y-1.5">
      <Label htmlFor={k} className="text-xs text-muted-foreground">{label}</Label>
      <Input
        id={k}
        type={opts.type ?? "number"}
        inputMode={opts.type ? undefined : "decimal"}
        step={opts.step ?? "any"}
        value={draft[k] as string}
        placeholder={opts.placeholder}
        onChange={(e) => set(k, e.target.value as never)}
        className="num"
      />
      {opts.hint && <p className="text-[11px] text-muted-foreground">{opts.hint}</p>}
    </div>
  );

  const nowLocal = () => set("quoteTime", isoToLocalInput(new Date().toISOString()));
  const prompt = snapshotToPrompt(preview, now ?? 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Capture"
        title="Snapshot Studio"
        description="Freeze a market state with its timestamp, then copy it as a reviewer prompt or JSON."
        actions={<StorageTag />}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <section className="panel space-y-5 p-4 md:p-6" aria-label="Snapshot inputs">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Market</Label>
              <Select
                value={draft.marketId}
                onValueChange={(v) => {
                  setDraft(blankDraft(v));
                  setEditingId(null);
                  void navigate({ to: "/snapshot", search: { market: v }, replace: true });
                }}
              >
                <SelectTrigger aria-label="Market"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>FX</SelectLabel>
                    {MARKETS.filter((m) => m.assetClass === "fx").map((m) => <SelectItem key={m.id} value={m.id}>{m.symbol}</SelectItem>)}
                  </SelectGroup>
                  <SelectGroup>
                    <SelectLabel>Polymarket crypto</SelectLabel>
                    {MARKETS.filter((m) => m.assetClass === "polymarket").map((m) => <SelectItem key={m.id} value={m.id}>{m.symbol}</SelectItem>)}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Data origin</Label>
              <RadioGroup value={draft.origin} onValueChange={(v) => set("origin", v as Draft["origin"])} className="flex h-9 items-center gap-4">
                <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="manual" /> Manual</label>
                <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="sample" /> Sample</label>
                <label className="flex items-center gap-2 text-sm text-muted-foreground" title="No live collector configured"><RadioGroupItem value="live" disabled /> Live</label>
              </RadioGroup>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => void prefillSample()}><FlaskConical /> Prefill with sample quote</Button>
            <Button variant="ghost" size="sm" onClick={() => { setDraft(blankDraft(draft.marketId)); setEditingId(null); }}><RotateCcw /> Clear</Button>
            {editingId && <Tag tone="neutral">Editing saved snapshot</Tag>}
          </div>

          <fieldset className="space-y-3">
            <legend className="eyebrow mb-2">Quote</legend>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {isBinary && field("contractPrice", "YES mid (0–1)", { placeholder: "0.54" })}
              {field("bid", isBinary ? "YES bid" : "Bid", { placeholder: isBinary ? "0.53" : "1.08495" })}
              {field("ask", isBinary ? "YES ask" : "Ask", { placeholder: isBinary ? "0.55" : "1.08505" })}
              {!isBinary && field("contractPrice", "Binary contract price", { placeholder: "optional" })}
              {field("referencePrice", isBinary ? `${market.underlying}/USD now` : "Spot / reference", { placeholder: isBinary ? "95010" : "1.085" })}
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <div className="space-y-1.5">
                <Label htmlFor="quoteTime" className="text-xs text-muted-foreground">Quote time (local)</Label>
                <Input id="quoteTime" type="datetime-local" step="1" value={draft.quoteTime} onChange={(e) => set("quoteTime", e.target.value)} className="num" />
              </div>
              <Button variant="secondary" size="sm" className="self-end" onClick={nowLocal}><Clock /> Now</Button>
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="eyebrow mb-2">Contract & settlement</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {field("strike", isBinary ? "Strike / price to beat" : "Strike (optional)", { placeholder: isBinary ? "94980" : "1.0900" })}
              <div className="space-y-1.5">
                <Label htmlFor="settlementTime" className="text-xs text-muted-foreground">Settlement time (local)</Label>
                <Input id="settlementTime" type="datetime-local" step="1" value={draft.settlementTime} onChange={(e) => set("settlementTime", e.target.value)} className="num" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="settlementRule" className="text-xs text-muted-foreground">Settlement rule</Label>
              <Input id="settlementRule" value={draft.settlementRule} onChange={(e) => set("settlementRule", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="referenceSource" className="text-xs text-muted-foreground">Reference source</Label>
              <Input id="referenceSource" value={draft.referenceSource} onChange={(e) => set("referenceSource", e.target.value)} />
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="eyebrow mb-2">Costs, risk & depth</legend>
            <div className="grid grid-cols-2 gap-3">
              {field("feePct", "Fee (% of notional / fill)", { placeholder: "1" })}
              {field("volatilityPct", "Volatility (annualized %)", { placeholder: "50", hint: "Your assumption — not observed." })}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="orderBook" className="text-xs text-muted-foreground">Order book</Label>
              <Textarea id="orderBook" rows={5} value={draft.orderBook} onChange={(e) => set("orderBook", e.target.value)} placeholder={"BIDS\n0.53 x 1,200\nASKS\n0.55 x 900"} className="num text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notes" className="text-xs text-muted-foreground">Notes</Label>
              <Textarea id="notes" rows={2} value={draft.notes} onChange={(e) => set("notes", e.target.value)} />
            </div>
          </fieldset>
        </section>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start" aria-label="Snapshot output">
          <div className="panel p-4 md:p-5">
            <div className="flex items-center justify-between gap-2">
              <p className="eyebrow">Quote age</p>
              <DataTag origin={draft.origin} />
            </div>
            <p className={cn("num mt-2 text-3xl", quoteAge == null ? "text-muted-foreground" : quoteAge > staleLimit ? "text-warning" : "text-positive")}>
              {quoteAge == null ? "No timestamp" : fmtAge(quoteAge)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {quoteAge != null && quoteAge > staleLimit ? `Older than ${staleLimit}s — likely stale.` : `Quote time ${preview.quoteTime ? fmtDateTime(preview.quoteTime) : "not set"}`}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button onClick={() => void copyText(prompt, "Prompt")} variant="secondary"><Copy /> Copy prompt</Button>
              <Button onClick={() => void copyText(snapshotToJson(preview, now ?? Date.now()), "JSON")} variant="secondary"><Braces /> Copy JSON</Button>
              <Button onClick={save}><Save /> {editingId ? "Update" : "Save"}</Button>
              <Button
                variant="outline"
                onClick={() => {
                  const s = save();
                  void navigate({ to: "/advocate", search: { snapshot: s.id } });
                }}
              >
                <Scale /> Review
              </Button>
            </div>
          </div>
          <div className="panel p-4">
            <p className="eyebrow mb-2">Prompt preview</p>
            <pre className="num max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-background/60 p-3 text-[11px] leading-relaxed text-muted-foreground">{prompt}</pre>
          </div>
        </aside>
      </div>

      <section aria-labelledby="saved-h" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 id="saved-h" className="eyebrow">Saved snapshots · {snapshots.length}</h2>
        </div>
        {snapshots.length === 0 ? (
          <EmptyState title="No snapshots yet">Fill the form and press Save. Snapshots stay in this browser.</EmptyState>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {snapshots.map((s) => {
              const m = getMarket(s.marketId);
              const ageAtCapture = s.quoteTime ? (Date.parse(s.createdAt) - Date.parse(s.quoteTime)) / 1000 : null;
              return (
                <li key={s.id} className={cn("panel p-4", editingId === s.id && "border-positive/50")}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-foreground">{m?.symbol ?? s.marketId}</p>
                      <p className="num text-[11px] text-muted-foreground">Saved {fmtDateTime(s.createdAt)}</p>
                    </div>
                    <DataTag origin={s.origin} />
                  </div>
                  <dl className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
                    <div><dt className="text-muted-foreground">Price</dt><dd className="num">{s.contractPrice ?? s.referencePrice ?? "—"}</dd></div>
                    <div><dt className="text-muted-foreground">Strike</dt><dd className="num">{s.strike ?? "—"}</dd></div>
                    <div><dt className="text-muted-foreground">Age at save</dt><dd className="num">{fmtAge(ageAtCapture)}</dd></div>
                  </dl>
                  <div className="mt-3 flex flex-wrap gap-1">
                    <Button size="sm" variant="ghost" onClick={() => { setDraft(fromSnapshot(s)); setEditingId(s.id); window.scrollTo({ top: 0, behavior: "smooth" }); }}><Upload /> Load</Button>
                    <Button size="sm" variant="ghost" onClick={() => void copyText(snapshotToPrompt(s, Date.now()), "Prompt")}><Copy /> Prompt</Button>
                    <Button size="sm" variant="ghost" asChild>
                      <Link to="/advocate" search={{ snapshot: s.id }}><Scale /> Review</Link>
                    </Button>
                    <Button size="sm" variant="ghost" className="text-negative" onClick={() => { remove(s.id); if (editingId === s.id) setEditingId(null); toast("Snapshot deleted"); }} aria-label="Delete snapshot"><Trash2 /></Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}