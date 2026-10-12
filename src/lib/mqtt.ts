import mqtt, { type MqttClient } from "mqtt";
import { config, mqttTopics } from "./config.js";
import { commandAckSchema, deviceStatusSchema, telemetrySchema, type CommandAckInput, type TelemetryInput } from "../schemas/mqtt.schema.js";
import type { CommandMessage } from "../types/domain.js";
import type { CommandPublisher } from "../types/ports.js";

interface MqttHandlers {
  telemetry: (input: TelemetryInput) => Promise<unknown>;
  commandAck: (input: CommandAckInput) => Promise<unknown>;
  connectivity: (online: boolean) => Promise<unknown>;
}

export class MqttGateway implements CommandPublisher {
  private client?: MqttClient;
  private handlers?: MqttHandlers;

  setHandlers(handlers: MqttHandlers) {
    this.handlers = handlers;
  }

  start() {
    this.client = mqtt.connect(config.MQTT_URL, {
      clientId: `safe-gas-backend-${process.pid}`,
      reconnectPeriod: 2000,
      clean: true,
    });

    this.client.on("connect", () => {
      console.info(`[mqtt] conectado em ${config.MQTT_URL}`);
      this.client?.subscribe([mqttTopics.telemetry, mqttTopics.status, mqttTopics.commandAck], { qos: 1 });
    });
    this.client.on("reconnect", () => console.warn("[mqtt] tentando reconectar"));
    this.client.on("error", (error) => console.error("[mqtt] erro", error.message));
    this.client.on("message", (topic, payload) => void this.handleMessage(topic, payload));
  }

  private async handleMessage(topic: string, payload: Buffer) {
    if (!this.handlers) return;
    try {
      const data: unknown = JSON.parse(payload.toString("utf8"));
      if (topic === mqttTopics.telemetry) {
        const parsed = telemetrySchema.parse(data);
        if (parsed.deviceId === config.MQTT_DEVICE_ID) await this.handlers.telemetry(parsed);
      } else if (topic === mqttTopics.commandAck) {
        const parsed = commandAckSchema.parse(data);
        if (parsed.deviceId === config.MQTT_DEVICE_ID) await this.handlers.commandAck(parsed);
      } else if (topic === mqttTopics.status) {
        const parsed = deviceStatusSchema.parse(data);
        if (parsed.deviceId === config.MQTT_DEVICE_ID) await this.handlers.connectivity(parsed.online);
      }
    } catch (error) {
      console.error(`[mqtt] mensagem inválida no tópico ${topic}`, error);
    }
  }

  isConnected() {
    return this.client?.connected === true;
  }

  publishCommand(message: CommandMessage): Promise<void> {
    if (!this.client?.connected) return Promise.reject(new Error("MQTT desconectado"));
    return new Promise((resolve, reject) => {
      this.client!.publish(mqttTopics.commands, JSON.stringify(message), { qos: 1, retain: false }, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }

  async stop() {
    if (!this.client) return;
    await new Promise<void>((resolve, reject) =>
      this.client!.end(false, {}, (error) => (error ? reject(error) : resolve())),
    );
  }
}
