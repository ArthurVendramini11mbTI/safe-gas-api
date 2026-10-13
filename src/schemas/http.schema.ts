import { z } from "zod";

export const valveCommandBodySchema = z.object({
  action: z.enum(["OPEN", "CLOSE"]),
});

export const settingsBodySchema = z
  .object({
    tareKg: z.number().finite().nonnegative().max(100),
    capacityKg: z.number().finite().positive().max(100),
    noiseToleranceKg: z.number().finite().positive().max(5).default(0.05),
    refillThresholdKg: z.number().finite().positive().max(20).default(0.5),
  })
  .refine((data) => data.refillThresholdKg > data.noiseToleranceKg, {
    message: "refillThresholdKg deve ser maior que noiseToleranceKg",
    path: ["refillThresholdKg"],
  });

export const uuidParamsSchema = z.object({ id: z.string().uuid() });

export const historyQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(2000).default(500),
  cylinderId: z.coerce.number().int().positive().optional(),
});

export const consumptionQuerySchema = z.object({
  range: z.enum(["day", "week", "month"]).default("day"),
  cylinderId: z.coerce.number().int().positive().optional(),
  scope: z.enum(["active", "all"]).default("active"),
});

export const replaceCylinderBodySchema = z.object({
  initialGasKg: z.number().finite().nonnegative().max(100),
});
