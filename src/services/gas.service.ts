import type { ConsumptionBucket, GasReading, GasSettings } from "../types/domain.js";
import { bucketStart, localDayStart, localHourStart, localWeekStart } from "../lib/time.js";

export function calculateGas(totalWeightKg: number, settings: GasSettings) {
  const unclamped = totalWeightKg - settings.tareKg;
  const gasKg = Math.min(settings.capacityKg, Math.max(0, unclamped));
  const gasPercentage = settings.capacityKg === 0 ? 0 : (gasKg / settings.capacityKg) * 100;
  return {
    gasKg: Number(gasKg.toFixed(3)),
    gasPercentage: Number(gasPercentage.toFixed(2)),
  };
}

export function calculateConsumption(
  readings: GasReading[],
  settings: GasSettings,
  range: "day" | "week" | "month",
  periodEnd = readings.at(-1)?.receivedAt ?? new Date(),
): { totalKg: number; buckets: ConsumptionBucket[] } {
  const totals = new Map<string, number>();

  const grouped = new Map<string, GasReading[]>();
  for (const reading of readings) {
    if (!Number.isFinite(reading.gasKg) || Number.isNaN(reading.receivedAt.getTime())) continue;
    const key = reading.cylinderId === undefined ? "without-cylinder" : String(reading.cylinderId);
    const group = grouped.get(key) ?? [];
    group.push(reading);
    grouped.set(key, group);
  }
  for (const group of grouped.values()) {
    group.sort((a, b) => a.receivedAt.getTime() - b.receivedAt.getTime());
    if (group.length < 2) continue;
    let reference = group[0]!.gasKg;
    for (const reading of group.slice(1)) {
      const decrease = reference - reading.gasKg;
      if (decrease > 0) {
        const key = bucketStart(reading.receivedAt, range);
        totals.set(key, (totals.get(key) ?? 0) + decrease);
        reference = reading.gasKg;
      }
    }
  }

  const day = localDayStart(periodEnd);
  const start = range === "day"
    ? day
    : range === "week"
      ? localWeekStart(periodEnd)
      : new Date(Date.UTC(
        Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", year: "numeric" }).format(periodEnd)),
        Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", month: "numeric" }).format(periodEnd)) - 1,
        1,
      ) + 3 * 60 * 60 * 1000);
  const bucketCount = range === "day"
    ? 24
    : range === "week"
      ? 7
      : new Date(Date.UTC(
        Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", year: "numeric" }).format(periodEnd)),
        Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", month: "numeric" }).format(periodEnd)),
        0,
      )).getUTCDate();
  const step = range === "day" ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  const buckets = Array.from({ length: bucketCount }, (_, index) => {
    const bucket = new Date(start.getTime() + index * step).toISOString();
    return { start: bucket, consumptionKg: Number((totals.get(bucket) ?? 0).toFixed(3)) };
  });
  const totalKg = buckets.reduce((sum, bucket) => sum + bucket.consumptionKg, 0);
  return { totalKg: Number(totalKg.toFixed(3)), buckets };
}
