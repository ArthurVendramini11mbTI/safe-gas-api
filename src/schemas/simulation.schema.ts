import { z } from "zod";

export const simulationStartSchema = z.object({
  days: z.number().int().min(1).max(90).default(30),
});

export const simulationStateSchema = z.object({
  weightKg: z.number().finite().nonnegative().max(100).optional(),
  leakActive: z.boolean().optional(),
}).refine((data) => data.weightKg !== undefined || data.leakActive !== undefined, {
  message: "Informe weightKg ou leakActive",
});

export type SimulationStateInput = z.infer<typeof simulationStateSchema>;
