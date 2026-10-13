export function rangeStart(range: "day" | "week" | "month", now = new Date()): Date {
  if (range === "month") {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  }
  const duration = range === "day" ? 24 : range === "week" ? 24 * 7 : 24 * 30;
  return new Date(now.getTime() - duration * 60 * 60 * 1000);
}

export function bucketStart(date: Date, range: "day" | "week" | "month"): string {
  const value = new Date(date);
  if (range === "day") {
    value.setUTCMinutes(0, 0, 0);
  } else {
    value.setUTCHours(0, 0, 0, 0);
  }
  return value.toISOString();
}
