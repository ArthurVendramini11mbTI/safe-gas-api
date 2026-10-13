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

  if (readings.length >= 2) {
    let reference = readings[0]!.gasKg;
    for (const reading of readings.slice(1)) {
      const increase = reading.gasKg - reference;
      if (increase >= settings.refillThresholdKg) {
        reference = reading.gasKg;
        continue;
      }

      const decrease = reference - reading.gasKg;
      if (decrease >= settings.noiseToleranceKg) {
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
