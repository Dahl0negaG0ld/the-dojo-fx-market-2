import { cva, type VariantProps } from "class-variance-authority";
import { Database, FlaskConical, PenLine, Radio } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { fmtAge, fmtTime } from "@/lib/dojo/format";
import type { DataOrigin } from "@/lib/dojo/types";

export const tagVariants = cva(
  "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.08em] whitespace-nowrap",
  {
    variants: {
      tone: {
        sample: "border-warning/40 bg-warning-soft text-warning",
        manual: "border-border bg-neutral-soft text-muted-foreground",
        live: "border-positive/40 bg-positive-soft text-positive",
        placeholder: "border-dashed border-warning/50 bg-warning-soft text-warning",
        neutral: "border-border bg-neutral-soft text-muted-foreground",
        positive: "border-positive/40 bg-positive-soft text-positive",
        negative: "border-negative/40 bg-negative-soft text-negative",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export function Tag({ tone, className, children }: { tone?: VariantProps<typeof tagVariants>["tone"]; className?: string; children: ReactNode }) {
  return <span className={cn(tagVariants({ tone }), className)}>{children}</span>;
}

export function DataTag({ origin, className }: { origin: DataOrigin; className?: string }) {
  if (origin === "sample")
    return (
      <span className={cn(tagVariants({ tone: "sample" }), className)} title="Synthetic sample value — not a live market quote">
        <FlaskConical className="size-3" aria-hidden /> Sample · Not live
      </span>
    );
  if (origin === "manual")
    return (
      <span className={cn(tagVariants({ tone: "manual" }), className)} title="Entered by you — unverified">
        <PenLine className="size-3" aria-hidden /> Manual
      </span>
    );
  return (
    <span className={cn(tagVariants({ tone: "live" }), className)}>
      <Radio className="size-3" aria-hidden /> Live
    </span>
  );
}

export function ProvenanceBar({
  origin,
  source,
  updatedAt,
  nowMs,
  children,
}: {
  origin: DataOrigin;
  source: string;
  updatedAt: string | null;
  nowMs: number | null;
  children?: ReactNode;
}) {
  const age = updatedAt && nowMs ? (nowMs - Date.parse(updatedAt)) / 1000 : null;
  return (
    <div className="panel flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2.5 text-xs">
      <DataTag origin={origin} />
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <Database className="size-3.5" aria-hidden />
        Source: <span className="text-foreground">{source}</span>
      </span>
      <span className="text-muted-foreground">
        Last updated <span className="num text-foreground">{fmtTime(updatedAt)}</span>
        {age != null && <span className="num"> · {fmtAge(age)} ago</span>}
      </span>
      {children}
    </div>
  );
}

export function StorageTag({ className }: { className?: string }) {
  return (
    <span className={cn(tagVariants({ tone: "neutral" }), className)} title="Saved in this browser only">
      <Database className="size-3" aria-hidden /> Local device storage
    </span>
  );
}