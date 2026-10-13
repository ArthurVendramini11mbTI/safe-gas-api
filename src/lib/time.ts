const TIME_ZONE = "America/Sao_Paulo";
const BRAZIL_OFFSET_MS = 3 * 60 * 60 * 1000;

function localParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(value.year),
    month: Number(value.month),
    day: Number(value.day),
    hour: Number(value.hour),
  };
}

export function localHourStart(date: Date) {
  const parts = localParts(date);
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour) + BRAZIL_OFFSET_MS);
}

export function localDayStart(date: Date) {
  const parts = localParts(date);
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day) + BRAZIL_OFFSET_MS);
}

export function localWeekStart(date: Date) {
  const day = localDayStart(date);
  const parts = localParts(date);
  const weekday = new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
  return new Date(day.getTime() - weekday * 24 * 60 * 60 * 1000);
}

export function rangeStart(range: "day" | "week" | "month", now = new Date()): Date {
  const day = localDayStart(now);
  if (range === "day") return day;
  if (range === "week") return localWeekStart(now);
  if (range === "month") {
    const parts = localParts(now);
    return new Date(Date.UTC(parts.year, parts.month - 1, 1) + BRAZIL_OFFSET_MS);
  }
  return day;
}

export function bucketStart(date: Date, range: "day" | "week" | "month"): string {
  return (range === "day" ? localHourStart(date) : localDayStart(date)).toISOString();
}
