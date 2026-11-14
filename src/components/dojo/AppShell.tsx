import { Link, useRouterState } from "@tanstack/react-router";
import { BookOpenText, Camera, LayoutGrid, Lock, Scale, Settings2, Wallet } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Scanner", short: "Scan", icon: LayoutGrid },
  { to: "/snapshot", label: "Snapshot Studio", short: "Snap", icon: Camera },
  { to: "/portfolio", label: "Paper Portfolio", short: "Paper", icon: Wallet },
  { to: "/advocate", label: "Devil's Advocate", short: "Review", icon: Scale },
  { to: "/research", label: "Research", short: "Research", icon: BookOpenText },
  { to: "/settings", label: "Settings", short: "Settings", icon: Settings2 },
] as const;

function Brand() {
  return (
    <Link to="/" className="flex items-center gap-2.5" aria-label="The Dojo home">
      <span className="grid size-8 place-items-center rounded-lg border border-positive/30 bg-positive-soft font-display text-lg leading-none text-positive">道</span>
      <span className="leading-tight">
        <span className="block font-display text-xl tracking-tight text-foreground">The Dojo</span>
        <span className="eyebrow block !text-[9px]">FX Market Lab</span>
      </span>
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isActive = (to: string) => (to === "/" ? pathname === "/" : pathname.startsWith(to));

  return (
    <div className="min-h-screen md:flex">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar/80 px-4 py-6 backdrop-blur md:flex">
        <Brand />
        <nav className="mt-8 flex flex-col gap-0.5" aria-label="Main">
          {NAV.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                isActive(to) ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
              )}
              aria-current={isActive(to) ? "page" : undefined}
            >
              <Icon className={cn("size-4", isActive(to) && "text-positive")} aria-hidden />
              {label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto space-y-3 rounded-lg border border-sidebar-border p-3 text-xs text-muted-foreground">
          <p className="flex items-center gap-1.5 text-foreground">
            <Lock className="size-3.5" aria-hidden /> Private lab
          </p>
          <p>Paper trading only. No real-money orders are ever sent.</p>
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/85 px-4 py-3 backdrop-blur md:hidden">
        <Brand />
        <span className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-muted-foreground">
          <Lock className="size-3" aria-hidden /> Paper only
        </span>
      </header>

      <main className="min-w-0 flex-1 px-4 pb-28 pt-6 md:px-8 md:pb-12 md:pt-8 lg:px-10">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>

      <nav
        className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur md:hidden"
        aria-label="Main"
      >
        <ul className="grid grid-cols-6">
          {NAV.map(({ to, short, icon: Icon }) => (
            <li key={to}>
              <Link
                to={to}
                className={cn(
                  "flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium",
                  isActive(to) ? "text-positive" : "text-muted-foreground",
                )}
                aria-current={isActive(to) ? "page" : undefined}
              >
                <Icon className="size-5" aria-hidden />
                {short}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}