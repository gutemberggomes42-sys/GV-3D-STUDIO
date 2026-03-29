import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function formatNumber(value: number, maximumFractionDigits = 1) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(value);
}

export function formatPercent(value: number) {
  return `${formatNumber(value, 1)}%`;
}

export function formatDateTime(date: Date | null | undefined) {
  if (!date) {
    return "Sem data";
  }

  return format(date, "dd MMM yyyy 'às' HH:mm", { locale: ptBR });
}

export function formatDateOnly(date: Date | null | undefined) {
  if (!date) {
    return "Sem data";
  }

  return format(date, "dd MMM yyyy", { locale: ptBR });
}

export function formatMonthYear(date: Date | null | undefined) {
  if (!date) {
    return "Sem data";
  }

  return format(date, "MMMM 'de' yyyy", { locale: ptBR });
}

export function formatHours(hours: number) {
  if (hours < 1) {
    return `${formatNumber(hours * 60, 0)} min`;
  }

  return `${formatNumber(hours, 1)} h`;
}

export function formatDurationMinutes(totalMinutes: number) {
  const safeMinutes = Math.max(Math.round(totalMinutes), 0);
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;

  if (hours === 0) {
    return `${minutes} min`;
  }

  if (minutes === 0) {
    return `${hours} h`;
  }

  return `${hours} h ${minutes} min`;
}

export function formatWeight(grams: number) {
  if (grams >= 1000) {
    return `${formatNumber(grams / 1000, 2)} kg`;
  }

  return `${formatNumber(grams, 0)} g`;
}

export function formatMeters(meters: number) {
  return `${formatNumber(meters, 2)} m`;
}

export function formatVolume(cm3: number) {
  return `${formatNumber(cm3, 1)} cm3`;
}
