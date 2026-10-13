import type { ConsumptionBucket, GasReading, GasSettings } from "../types/domain.js";
import { bucketStart } from "../lib/time.js";

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
): { totalKg: number; buckets: ConsumptionBucket[] } {
  if (readings.length < 2) return { totalKg: 0, buckets: [] };

  let reference = readings[0]!.gasKg;
  const totals = new Map<string, number>();

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

  let buckets = [...totals.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([start, consumptionKg]) => ({ start, consumptionKg: Number(consumptionKg.toFixed(3)) }));

  // Os períodos devem mostrar também os intervalos sem consumo.
  if (range === "day") {
    const latest = readings[readings.length - 1]!.receivedAt;
    const end = new Date(latest);
    end.setUTCMinutes(0, 0, 0);
    const values = new Map(buckets.map((bucket) => [bucket.start, bucket.consumptionKg]));
    buckets = Array.from({ length: 24 }, (_, index) => {
      const start = new Date(end.getTime() - (23 - index) * 60 * 60 * 1000).toISOString();
      return { start, consumptionKg: values.get(start) ?? 0 };
    });
  } else {
    const latest = new Date(readings[readings.length - 1]!.receivedAt);
    const end = new Date(Date.UTC(latest.getUTCFullYear(), latest.getUTCMonth(), latest.getUTCDate()));
    const start = range === "week"
      ? new Date(end.getTime() - 6 * 24 * 60 * 60 * 1000)
      : new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
    const dayCount = Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    const values = new Map(buckets.map((bucket) => [bucket.start, bucket.consumptionKg]));
    buckets = Array.from({ length: dayCount }, (_, index) => {
      const bucketStartDate = new Date(start.getTime() + index * 24 * 60 * 60 * 1000);
      const bucketKey = bucketStartDate.toISOString();
      return { start: bucketKey, consumptionKg: values.get(bucketKey) ?? 0 };
    });
  }
  const totalKg = buckets.reduce((sum, bucket) => sum + bucket.consumptionKg, 0);
  return { totalKg: Number(totalKg.toFixed(3)), buckets };
}
