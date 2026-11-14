import { Area, AreaChart, ResponsiveContainer, YAxis } from "recharts";
import { useId } from "react";

export function Sparkline({ data, up, height = 44 }: { data: number[]; up: boolean; height?: number }) {
  const id = useId().replace(/:/g, "");
  const color = up ? "var(--color-positive)" : "var(--color-negative)";
  const points = data.map((v, i) => ({ i, v }));
  return (
    <div style={{ height }} aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
          <defs>
            <linearGradient id={`sg-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.28} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis hide domain={["dataMin", "dataMax"]} />
          <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} fill={`url(#sg-${id})`} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}