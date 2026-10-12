import { describe, expect, it } from "vitest";
import { calculateConsumption, calculateGas } from "./gas.service.js";

const settings = { tareKg: 12, capacityKg: 13, noiseToleranceKg: 0.05, refillThresholdKg: 0.5 };

describe("calculateGas", () => {
  it("desconta a tara e calcula a porcentagem", () => {
    expect(calculateGas(18.5, settings)).toEqual({ gasKg: 6.5, gasPercentage: 50 });
  });

  it("limita o resultado entre vazio e a capacidade", () => {
    expect(calculateGas(10, settings).gasKg).toBe(0);
    expect(calculateGas(30, settings).gasKg).toBe(13);
  });
});

describe("calculateConsumption", () => {
  it("acumula quedas, filtra ruído e ignora reposição", () => {
    const base = Date.parse("2026-10-10T10:00:00.000Z");
    const readings = [10, 9.97, 9.93, 11, 10.9].map((gasKg, index) => ({
      gasKg,
      receivedAt: new Date(base + index * 60_000),
    }));
    expect(calculateConsumption(readings, settings, "day").totalKg).toBeCloseTo(0.17);
  });

  it("retorna zero sem amostras suficientes", () => {
    expect(calculateConsumption([], settings, "week")).toEqual({ totalKg: 0, buckets: [] });
  });

  it("preenche as 24 horas no gráfico diário", () => {
    const readings = [
      { gasKg: 10, receivedAt: new Date("2026-10-10T10:00:00.000Z") },
      { gasKg: 9.8, receivedAt: new Date("2026-10-10T11:00:00.000Z") },
    ];
    const result = calculateConsumption(readings, settings, "day");
    expect(result.buckets).toHaveLength(24);
    expect(result.buckets.some((bucket) => bucket.consumptionKg === 0)).toBe(true);
  });
});
