import { z } from "zod";

export const valveStateSchema = z.enum(["OPEN", "CLOSED", "UNKNOWN"]);

export const telemetrySchema = z.object({
  schemaVersion: z.literal(1).default(1),
  deviceId: z.string().min(1),
  totalWeightKg: z.number().finite().nonnegative(),
  mq2Raw: z.number().int().nonnegative(),
  leakActive: z.boolean(),
  valveState: valveStateSchema,
  esp2Online: z.boolean(),
});

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
