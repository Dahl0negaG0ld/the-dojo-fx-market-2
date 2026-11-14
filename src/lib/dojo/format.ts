export const fmtUsd = (v: number, signed = false) => {
  const s = Math.abs(v).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
  if (!signed) return v < 0 ? `-${s}` : s;
  return v > 0 ? `+${s}` : v < 0 ? `-${s}` : s;
};
export const fmtNum = (v: number | null | undefined, d = 2) =>
  v == null || !Number.isFinite(v) ? "—" : v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
export const fmtPct = (v: number | null | undefined, d = 1) => (v == null ? "—" : `${(v * 100).toFixed(d)}%`);
export const fmtTime = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleTimeString("en-US", { hour12: false }) : "—";
export const fmtDateTime = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }) : "—";

export function fmtAge(sec: number | null | undefined): string {
  if (sec == null || !Number.isFinite(sec)) return "—";
  if (sec < 60) return `${Math.floor(sec)}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ${Math.floor(sec % 60)}s`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
  return `${Math.floor(sec / 86400)}d`;
}

/** ISO → value for <input type="datetime-local" step="1"> in local time. */
export function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
export function localInputToIso(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function parseNum(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}