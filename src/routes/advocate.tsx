import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, EmptyState } from "@/components/dojo/PageHeader";
import { DataTag } from "@/components/dojo/DataTag";
import { analyzeSnapshot, type Review } from "@/lib/dojo/analysis";
import { getMarket } from "@/lib/dojo/markets";
import { useSettings, useSnapshots } from "@/lib/dojo/storage";
import { copyText } from "@/lib/dojo/clipboard";
import { fmtAge, fmtDateTime, fmtPct } from "@/lib/dojo/format";
import { useNow } from "@/hooks/use-now";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/advocate")({
  validateSearch: (s: Record<string, unknown>): { snapshot?: string } => ({
    snapshot: typeof s.snapshot === "string" ? s.snapshot : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Devil's Advocate — The Dojo: FX Market Lab" },
      { name: "description", content: "Stress-test a snapshot: bull and bear case, missing data, fee-adjusted breakeven and a default-PASS verdict." },
      { property: "og:title", content: "Devil's Advocate — The Dojo: FX Market Lab" },
      { property: "og:description", content: "Stress-test a snapshot with a default-PASS verdict." },
    ],
  }),
  component: Advocate,
});

const VERDICT_STYLE = {
  TRADE: "border-positive/50 bg-positive-soft text-positive",
  WATCH: "border-warning/50 bg-warning-soft text-warning",
  PASS: "border-border bg-neutral-soft text-foreground",
} as const;

function reviewText(r: Review, label: string) {
  const l = (t: string, xs: string[]) => `${t}\n${xs.length ? xs.map((x) => `- ${x}`).join("\n") : "- none"}`;
  return [
    `DEVIL'S ADVOCATE — ${label}`,
    `Verdict: ${r.verdict}`,
    l("Reasons", r.verdictReasons),
    `Fair probability (YES): ${r.fair ? `${fmtPct(r.fair.p)} (range ${fmtPct(r.fair.low)}–${fmtPct(r.fair.high)})` : "NOT ESTIMATED — insufficient data"}`,
    `Fee-adjusted breakeven: ${r.breakeven ? `YES ${fmtPct(r.breakeven.yes)} / NO ${fmtPct(r.breakeven.no)}` : "NOT AVAILABLE"}`,
    l("Bull case", r.bull),
    l("Bear case", r.bear),
    l("Missing data", r.missing),
    l("Warnings", r.warnings),
  ].join("\n\n");
}

function Advocate() {
  const { snapshot: selectedId } = Route.useSearch();
  const navigate = useNavigate();
  const { items } = useSnapshots();
  const [settings] = useSettings();
  const now = useNow(1000);
  const snap = items.find((s) => s.id === selectedId) ?? items[0];
  const market = snap ? getMarket(snap.marketId) : undefined;
  const r = snap && now ? analyzeSnapshot(snap, market, settings, now) : null;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Challenge every idea" title="Devil's Advocate" description="Structured skepticism. Verdict defaults to PASS whenever data is insufficient; estimates are only computed from inputs you supplied." />
      {items.length === 0 ? (
        <EmptyState title="No saved snapshots to review">
          <Link to="/snapshot" className="text-positive underline-offset-4 hover:underline">Capture one in Snapshot Studio</Link>
        </EmptyState>
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Select value={snap?.id} onValueChange={(v) => void navigate({ to: "/advocate", search: { snapshot: v }, replace: true })}>
              <SelectTrigger className="sm:w-96" aria-label="Snapshot"><SelectValue /></SelectTrigger>
              <SelectContent>
                {items.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{getMarket(s.marketId)?.symbol} · {s.origin.toUpperCase()} · {fmtDateTime(s.createdAt)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {snap && <DataTag origin={snap.origin} />}
            {r && snap && <Button variant="secondary" size="sm" className="sm:ml-auto" onClick={() => void copyText(reviewText(r, market?.symbol ?? snap.marketId), "Review")}><Copy /> Copy review</Button>}
          </div>
          {r && (
            <>
              <section className={cn("rounded-xl border p-5", VERDICT_STYLE[r.verdict])} aria-label="Verdict">
                <p className="eyebrow">Verdict</p>
                <p className="mt-1 font-display text-5xl">{r.verdict}</p>
                <ul className="mt-2 space-y-1 text-sm text-foreground">{r.verdictReasons.map((x) => <li key={x}>{x}</li>)}</ul>
              </section>
              {r.warnings.length > 0 && (
                <ul className="space-y-2">
                  {r.warnings.map((w) => (
                    <li key={w} className="flex items-start gap-2 rounded-lg border border-warning/35 bg-warning-soft px-3 py-2 text-sm"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />{w}</li>
                  ))}
                </ul>
              )}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Metric label="Independent fair (YES)" value={r.fair ? fmtPct(r.fair.p) : "Not estimated"} hint={r.fair ? `Range ${fmtPct(r.fair.low)}–${fmtPct(r.fair.high)} (vol ±25%)` : "Missing model inputs"} />
                <Metric label="Market implied (YES mid)" value={fmtPct(r.implied)} hint="From snapshot" />
                <Metric label="Breakeven YES / NO" value={r.breakeven ? `${fmtPct(r.breakeven.yes)} / ${fmtPct(r.breakeven.no)}` : "—"} hint="Ask price + fees" />
                <Metric label="Quote age" value={fmtAge(r.quoteAgeSec)} hint={r.stale ? "STALE" : "Within limit"} />
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <ListCard title="Bull case" items={r.bull} tone="text-positive" />
                <ListCard title="Bear case" items={r.bear} tone="text-negative" />
                <ListCard title="Missing data" items={r.missing} tone="text-warning" />
              </div>
              <p className="text-xs text-muted-foreground">Model: driftless lognormal probability that the reference finishes at or above strike, using your volatility assumption and time to settlement. It is a rough independent check, not a forecast.</p>
            </>
          )}
        </>
      )}
    </div>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="panel p-4">
      <p className="eyebrow">{label}</p>
      <p className="num mt-2 text-xl text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function ListCard({ title, items, tone }: { title: string; items: string[]; tone: string }) {
  return (
    <section className="panel p-4">
      <h2 className={cn("eyebrow", tone)}>{title}</h2>
      {items.length ? <ul className="mt-3 space-y-2 text-sm text-foreground">{items.map((x) => <li key={x} className="border-l-2 border-border pl-3">{x}</li>)}</ul> : <p className="mt-3 text-sm text-muted-foreground">Nothing identified from the supplied data.</p>}
    </section>
  );
}