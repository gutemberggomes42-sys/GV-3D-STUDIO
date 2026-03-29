import { cn } from "@/lib/utils";

type StatusPillProps = {
  label: string;
  className: string;
};

export function StatusPill({ label, className }: StatusPillProps) {
  return (
    <span className={cn("inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1", className)}>
      {label}
    </span>
  );
}
