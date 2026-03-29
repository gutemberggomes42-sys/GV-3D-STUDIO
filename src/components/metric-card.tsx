import { cn } from "@/lib/utils";

type MetricCardProps = {
  label: string;
  value: string;
  caption: string;
  accent?: "orange" | "mint" | "blue" | "rose";
};

const accentMap = {
  orange: "from-orange-500/20 to-orange-500/5 text-orange-100",
  mint: "from-emerald-500/20 to-emerald-500/5 text-emerald-100",
  blue: "from-sky-500/20 to-sky-500/5 text-sky-100",
  rose: "from-rose-500/20 to-rose-500/5 text-rose-100",
} as const;

export function MetricCard({
  label,
  value,
  caption,
  accent = "orange",
}: MetricCardProps) {
  return (
    <div
      className={cn(
        "rounded-[28px] border border-white/10 bg-gradient-to-br p-5 shadow-[0_24px_80px_rgba(0,0,0,0.28)]",
        accentMap[accent],
      )}
    >
      <p className="text-xs uppercase tracking-[0.24em] text-white/60">{label}</p>
      <p className="mt-4 text-3xl font-semibold text-white">{value}</p>
      <p className="mt-2 text-sm text-white/70">{caption}</p>
    </div>
  );
}
