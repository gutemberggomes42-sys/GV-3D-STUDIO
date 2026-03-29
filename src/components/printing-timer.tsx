"use client";

import { useEffect, useState } from "react";
import { formatDurationMinutes } from "@/lib/format";

type PrintingTimerProps = {
  startedAt?: string;
  completedAt?: string;
  plannedMinutes?: number;
};

function getElapsedMilliseconds(startedAt?: string, completedAt?: string, nowMs?: number) {
  if (!startedAt) {
    return 0;
  }

  const startedMs = new Date(startedAt).getTime();
  const endMs = completedAt ? new Date(completedAt).getTime() : (nowMs ?? Date.now());

  if (Number.isNaN(startedMs) || Number.isNaN(endMs) || endMs <= startedMs) {
    return 0;
  }

  return endMs - startedMs;
}

export function PrintingTimer({
  startedAt,
  completedAt,
  plannedMinutes = 0,
}: PrintingTimerProps) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!startedAt || completedAt) {
      return;
    }

    const timerId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [completedAt, startedAt]);

  if (!startedAt) {
    return null;
  }

  const elapsedMilliseconds = getElapsedMilliseconds(startedAt, completedAt, nowMs);
  const elapsedMinutes = Math.max(Math.round(elapsedMilliseconds / 60000), 0);
  const remainingMinutes = Math.max(plannedMinutes - elapsedMinutes, 0);
  const overtimeMinutes = Math.max(elapsedMinutes - plannedMinutes, 0);

  return (
    <div className="mt-4 rounded-[22px] border border-cyan-400/20 bg-cyan-500/10 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-100/70">
            {completedAt ? "Tempo registrado" : "Cronômetro da impressão"}
          </p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {formatDurationMinutes(elapsedMinutes)}
          </p>
        </div>
        <div className="grid gap-2 text-sm text-white/80 md:text-right">
          <p>Previsto: {formatDurationMinutes(plannedMinutes)}</p>
          <p>
            {overtimeMinutes > 0
              ? `Atraso: ${formatDurationMinutes(overtimeMinutes)}`
              : `Restante: ${formatDurationMinutes(remainingMinutes)}`}
          </p>
        </div>
      </div>
    </div>
  );
}
