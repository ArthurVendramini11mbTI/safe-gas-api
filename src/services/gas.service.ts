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

  // No período diário, o gráfico precisa representar todas as 24 horas,
  // inclusive as horas em que não houve consumo.
  if (range === "day") {
    const latest = readings[readings.length - 1]!.receivedAt;
    const end = new Date(latest);
    end.setUTCMinutes(0, 0, 0);
    const values = new Map(buckets.map((bucket) => [bucket.start, bucket.consumptionKg]));
    buckets = Array.from({ length: 24 }, (_, index) => {
      const start = new Date(end.getTime() - (23 - index) * 60 * 60 * 1000).toISOString();
      return { start, consumptionKg: values.get(start) ?? 0 };
    });
  }
  const totalKg = buckets.reduce((sum, bucket) => sum + bucket.consumptionKg, 0);
  return { totalKg: Number(totalKg.toFixed(3)), buckets };
}
