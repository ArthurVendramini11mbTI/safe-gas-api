import "dotenv/config";
import readline from "node:readline";
import mqtt from "mqtt";
import { z } from "zod";

const mqttUrl = process.env.MQTT_URL ?? "mqtt://localhost:1883";
const deviceId = process.env.MQTT_DEVICE_ID ?? "esp1";
const base = `safe-gas/${deviceId}`;
let totalWeightKg = 22;
let mq2Raw = 180;
let leakActive = false;
let safetyLocked = false;
let valveState: "OPEN" | "CLOSED" = "CLOSED";

const commandSchema = z.object({
  schemaVersion: z.literal(1),
  deviceId: z.string(),
  commandId: z.string().uuid(),
  type: z.enum(["valve.set", "safety.reset"]),
  desiredState: z.enum(["OPEN", "CLOSED"]).optional(),
});

const client = mqtt.connect(mqttUrl, {
  clientId: `safe-gas-simulator-${process.pid}`,
  will: {
    topic: `${base}/status`,
    payload: JSON.stringify({ schemaVersion: 1, deviceId, online: false }),
    qos: 1,
    retain: true,
  },
});

function publish(topic: string, payload: object, retain = false) {
  client.publish(topic, JSON.stringify(payload), { qos: 1, retain });
}

function telemetry() {
  publish(`${base}/telemetry`, {
    schemaVersion: 1,
    deviceId,
    totalWeightKg,
    mq2Raw,
    leakActive,
    valveState,
    esp2Online: true,
  });
}

client.on("connect", () => {
  console.info(`Simulador conectado em ${mqttUrl}`);
  console.info("Comandos: leak | clear | weight <kg> | mq2 <valor> | status | exit");
  publish(`${base}/status`, { schemaVersion: 1, deviceId, online: true }, true);
  client.subscribe(`${base}/commands`, { qos: 1 });
  telemetry();
});

client.on("message", (_topic, buffer) => {
  try {
    const command = commandSchema.parse(JSON.parse(buffer.toString("utf8")));
    let status: "APPLIED" | "REJECTED" = "APPLIED";
    let reason: string | undefined;
    if (command.type === "safety.reset") {
      if (leakActive) {
        status = "REJECTED";
        reason = "Vazamento ainda ativo";
      } else safetyLocked = false;
    } else if (command.desiredState === "OPEN") {
      if (leakActive || safetyLocked) {
        status = "REJECTED";
        reason = "Bloqueio de segurança ativo";
      } else valveState = "OPEN";
    } else if (command.desiredState === "CLOSED") valveState = "CLOSED";

    publish(`${base}/commands/ack`, {
      schemaVersion: 1,
      deviceId,
      commandId: command.commandId,
      status,
      valveState,
      ...(reason ? { reason } : {}),
    });
    telemetry();
  } catch (error) {
    console.error("Comando inválido", error);
  }
});

const interval = setInterval(telemetry, 30_000);
const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: "safe-gas> " });
rl.prompt();
rl.on("line", (line) => {
  const [command, value] = line.trim().split(/\s+/, 2);
  if (command === "leak") {
    leakActive = true;
    safetyLocked = true;
    mq2Raw = 750;
    valveState = "CLOSED";
    telemetry();
  } else if (command === "clear") {
    leakActive = false;
    mq2Raw = 180;
    telemetry();
  } else if (command === "weight" && Number.isFinite(Number(value))) {
    totalWeightKg = Number(value);
    telemetry();
  } else if (command === "mq2" && Number.isInteger(Number(value))) {
    mq2Raw = Number(value);
    telemetry();
  } else if (command === "status") {
    console.info({ totalWeightKg, mq2Raw, leakActive, safetyLocked, valveState });
  } else if (command === "exit") {
    void shutdown();
    return;
  } else console.info("Use: leak | clear | weight <kg> | mq2 <valor> | status | exit");
  rl.prompt();
});

async function shutdown() {
  clearInterval(interval);
  publish(`${base}/status`, { schemaVersion: 1, deviceId, online: false }, true);
  await new Promise<void>((resolve) => client.end(false, {}, () => resolve()));
  rl.close();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
