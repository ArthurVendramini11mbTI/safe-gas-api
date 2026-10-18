import { describe, expect, it } from "vitest";
import { telemetrySchema } from "./mqtt.schema.js";

describe("telemetrySchema", () => {
  it("aceita telemetria legada para manter os demais sensores", () => {
    expect(
      telemetrySchema.parse({
        schemaVersion: 1,
        deviceId: "esp1",
        totalWeightKg: 20,
        mq2Raw: 180,
        leakActive: false,
        valveState: "CLOSED",
        esp2Online: true,
      }),
    ).toMatchObject({ deviceId: "esp1", valveState: "CLOSED" });
  });

  it("aceita peso válido com identificação da amostra", () => {
    expect(telemetrySchema.parse({
      schemaVersion: 2,
      deviceId: "esp1",
      totalWeightKg: 5.7,
      weightStatus: "VALID",
      weightBootId: "A1B2C3D4",
      weightSampleSequence: 8,
      mq2Raw: 180,
      leakActive: false,
      valveState: "CLOSED",
      esp2Online: true,
    })).toMatchObject({ weightStatus: "VALID", totalWeightKg: 5.7 });
  });

  it("rejeita peso ausente em uma amostra marcada como válida", () => {
    expect(() => telemetrySchema.parse({
      schemaVersion: 2,
      deviceId: "esp1",
      weightStatus: "VALID",
      weightBootId: "A1B2C3D4",
      weightSampleSequence: 8,
      mq2Raw: 180,
      leakActive: false,
      valveState: "CLOSED",
      esp2Online: true,
    })).toThrow();
  });

  it("aceita estado indisponível sem inventar peso zero", () => {
    expect(telemetrySchema.parse({
      schemaVersion: 2,
      deviceId: "esp1",
      weightStatus: "UNAVAILABLE",
      weightBootId: "A1B2C3D4",
      weightSampleSequence: 0,
      mq2Raw: 180,
      leakActive: false,
      valveState: "CLOSED",
      esp2Online: true,
    })).toMatchObject({ weightStatus: "UNAVAILABLE" });
  });

  it("rejeita peso negativo", () => {
    expect(() =>
      telemetrySchema.parse({
        schemaVersion: 1,
        deviceId: "esp1",
        totalWeightKg: -1,
        mq2Raw: 180,
        leakActive: false,
        valveState: "CLOSED",
        esp2Online: true,
      }),
    ).toThrow();
  });
});
