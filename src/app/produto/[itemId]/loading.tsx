export default function LoadingProductPage() {
  return (
    <div className="space-y-6">
      <div className="h-14 animate-pulse rounded-[24px] border border-white/10 bg-white/5" />
      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="h-[480px] animate-pulse rounded-[32px] border border-white/10 bg-white/5" />
        <div className="h-[480px] animate-pulse rounded-[32px] border border-white/10 bg-white/5" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="h-44 animate-pulse rounded-[28px] border border-white/10 bg-white/5" />
        <div className="h-44 animate-pulse rounded-[28px] border border-white/10 bg-white/5" />
        <div className="h-44 animate-pulse rounded-[28px] border border-white/10 bg-white/5" />
      </div>
    </div>
  );
}
