import "dotenv/config";
import { envSchema } from "../schemas/env.schema.js";

export const config = envSchema.parse(process.env);

export const mqttTopics = {
  telemetry: `safe-gas/${config.MQTT_DEVICE_ID}/telemetry`,
  status: `safe-gas/${config.MQTT_DEVICE_ID}/status`,
  commands: `safe-gas/${config.MQTT_DEVICE_ID}/commands`,
  commandAck: `safe-gas/${config.MQTT_DEVICE_ID}/commands/ack`,
} as const;
