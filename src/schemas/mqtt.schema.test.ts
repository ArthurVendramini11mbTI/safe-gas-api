import { describe, expect, it } from "vitest";
import { telemetrySchema } from "./mqtt.schema.js";

describe("telemetrySchema", () => {
  it("aceita uma telemetria válida", () => {
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
