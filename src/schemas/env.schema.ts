import { z } from "zod";

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z
    .string()
    .min(1)
    .refine((value) => value.startsWith("postgresql://") || value.startsWith("postgres://"), {
      message: "DATABASE_URL deve ser uma URL PostgreSQL fornecida pelo Supabase",
    }),
  DIRECT_URL: z
    .string()
    .min(1)
    .refine((value) => value.startsWith("postgresql://") || value.startsWith("postgres://"), {
      message: "DIRECT_URL deve ser uma URL PostgreSQL fornecida pelo Supabase",
    })
    .optional(),
  MQTT_URL: z.string().url().default("mqtt://localhost:1883"),
  MQTT_DEVICE_ID: z.string().min(1).default("esp1"),
  COMMAND_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
  DEVICE_OFFLINE_AFTER_MS: z.coerce.number().int().positive().default(90000),
  SAFETY_RESET_DELAY_MS: z.coerce.number().int().nonnegative().default(5000),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
});

export type Environment = z.infer<typeof envSchema>;
