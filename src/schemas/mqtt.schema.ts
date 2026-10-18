import { z } from "zod";

export const valveStateSchema = z.enum(["OPEN", "CLOSED", "UNKNOWN"]);

const telemetryCommon = {
  deviceId: z.string().min(1),
  mq2Raw: z.number().int().nonnegative(),
  leakActive: z.boolean(),
  valveState: valveStateSchema,
  esp2Online: z.boolean(),
};

const telemetryV1Schema = z.object({
  schemaVersion: z.literal(1).default(1),
  ...telemetryCommon,
  totalWeightKg: z.number().finite().nonnegative(),
});

const telemetryV2Schema = z.object({
  schemaVersion: z.literal(2),
  ...telemetryCommon,
  weightStatus: z.enum(["VALID", "UNCALIBRATED", "UNAVAILABLE", "INVALID"]),
  weightBootId: z.string().min(1).max(32),
  weightSampleSequence: z.number().int().nonnegative(),
  totalWeightKg: z.number().finite().nonnegative().optional(),
}).superRefine((data, context) => {
  if (data.weightStatus === "VALID" && data.totalWeightKg === undefined) {
    context.addIssue({ code: "custom", path: ["totalWeightKg"], message: "Peso obrigatório quando a leitura é válida" });
  }
  if (data.weightStatus !== "VALID" && data.totalWeightKg !== undefined) {
    context.addIssue({ code: "custom", path: ["totalWeightKg"], message: "Peso não deve ser enviado quando a leitura é inválida" });
  }
});

export const telemetrySchema = z.union([telemetryV2Schema, telemetryV1Schema]);

export const deviceStatusSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  deviceId: z.string().min(1),
  online: z.boolean(),
});

export const commandAckSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  deviceId: z.string().min(1),
  commandId: z.string().uuid(),
  status: z.enum(["APPLIED", "REJECTED", "FAILED"]),
  valveState: valveStateSchema,
  reason: z.string().max(250).optional(),
});

export type TelemetryInput = z.infer<typeof telemetrySchema>;
export type CommandAckInput = z.infer<typeof commandAckSchema>;
