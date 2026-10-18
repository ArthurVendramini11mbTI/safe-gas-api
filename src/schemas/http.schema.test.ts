import { describe, expect, it } from "vitest";
import { settingsBodySchema } from "./http.schema.js";

describe("settingsBodySchema", () => {
  it("aceita somente as configuracoes editaveis da balanca", () => {
    expect(settingsBodySchema.parse({ noiseToleranceKg: 0.05, refillThresholdKg: 0.5 })).toEqual({
      noiseToleranceKg: 0.05,
      refillThresholdKg: 0.5,
    });
  });

  it("rejeita limite de reposicao menor ou igual a tolerancia", () => {
    expect(() => settingsBodySchema.parse({ noiseToleranceKg: 0.5, refillThresholdKg: 0.5 })).toThrow();
  });
});
