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
  it("acumula quedas, filtra ruído e não transforma objeto extra em consumo", () => {
    const base = Date.parse("2026-10-10T10:00:00.000Z");
    const readings = [10, 9.97, 9.93, 11, 10.9].map((gasKg, index) => ({
      gasKg,
      receivedAt: new Date(base + index * 60_000),
    }));
    expect(calculateConsumption(readings, settings, "day").totalKg).toBeCloseTo(0.07);
  });

  it("reinicia a referência quando começa outro botijão", () => {
    const readings = [
      { gasKg: 0.1, cylinderId: 1, receivedAt: new Date("2026-10-10T10:00:00.000Z") },
      { gasKg: 5, cylinderId: 2, receivedAt: new Date("2026-10-10T11:00:00.000Z") },
      { gasKg: 4.8, cylinderId: 2, receivedAt: new Date("2026-10-10T12:00:00.000Z") },
    ];
    expect(calculateConsumption(readings, settings, "day").totalKg).toBeCloseTo(0.2);
  });

  it("não mistura leituras intercaladas de ciclos diferentes", () => {
    const readings = [
      { gasKg: 10, cylinderId: 1, receivedAt: new Date("2026-10-10T10:00:00.000Z") },
      { gasKg: 5, cylinderId: 2, receivedAt: new Date("2026-10-10T11:00:00.000Z") },
      { gasKg: 9.8, cylinderId: 1, receivedAt: new Date("2026-10-10T12:00:00.000Z") },
      { gasKg: 4.8, cylinderId: 2, receivedAt: new Date("2026-10-10T13:00:00.000Z") },
    ];
    expect(calculateConsumption(readings, settings, "day").totalKg).toBeCloseTo(0.4);
  });

  it("retorna zero sem amostras suficientes", () => {
    const result = calculateConsumption([], settings, "week", new Date("2026-10-14T12:00:00.000Z"));
    expect(result.totalKg).toBe(0);
    expect(result.buckets).toHaveLength(7);
    expect(new Date(result.buckets[0]!.start).getUTCDay()).toBe(0);
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

  it("ordena a semana de domingo a sábado e preenche o mês real", () => {
    const periodEnd = new Date("2026-10-13T12:00:00.000Z");
    const readings = [
      { gasKg: 10, receivedAt: new Date("2026-10-01T00:00:00.000Z") },
      { gasKg: 9.8, receivedAt: new Date("2026-10-02T00:00:00.000Z") },
    ];
    const week = calculateConsumption(readings, settings, "week", periodEnd);
    const month = calculateConsumption(readings, settings, "month", periodEnd);
    expect(week.buckets).toHaveLength(7);
    expect(new Date(week.buckets[0]!.start).getUTCDay()).toBe(0);
    expect(month.buckets).toHaveLength(31);
  });
});
