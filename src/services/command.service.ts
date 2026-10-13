import type { SocketServer } from "../lib/socket.js";
import { AppError } from "../lib/errors.js";
import { CommandRepository } from "../repository/command.repository.js";
import { LeakRepository } from "../repository/leak.repository.js";
import { StateRepository } from "../repository/state.repository.js";
import type { CommandAckInput } from "../schemas/mqtt.schema.js";
import type { CommandPublisher } from "../types/ports.js";
import type { CommandMessage, ValveAction } from "../types/domain.js";
import { config } from "../lib/config.js";
import { CylinderRepository } from "../repository/cylinder.repository.js";

export class CommandService {
  private simulationActive = () => false;

  constructor(
    private readonly commandRepository: CommandRepository,
    private readonly stateRepository: StateRepository,
    private readonly leakRepository: LeakRepository,
    private readonly publisher: CommandPublisher,
    private readonly io: SocketServer,
    private readonly cylinderRepository?: CylinderRepository,
  ) {}

  setSimulationStatusProvider(provider: () => boolean) {
    this.simulationActive = provider;
  }

  async requestValve(action: "OPEN" | "CLOSE") {
    if (this.simulationActive()) throw new AppError("Comandos físicos estão desabilitados durante a simulação", 409, "SIMULATION_ACTIVE");
    const state = await this.stateRepository.get();
    if (!state.deviceOnline || !this.publisher.isConnected()) {
      throw new AppError("A central ESP1 está offline", 409, "DEVICE_OFFLINE");
    }
    if (action === "OPEN") {
      if (!state.esp2Online) {
        throw new AppError("O ESP2 está offline; a abertura permanece bloqueada", 409, "ESP2_OFFLINE");
      }
      if (state.leakActive) throw new AppError("Não é possível abrir a válvula durante um vazamento", 409, "LEAK_ACTIVE");
      const unacknowledged = await this.leakRepository.findLatestUnacknowledged();
      if (unacknowledged) {
        throw new AppError("Reconheça o último alerta antes de abrir a válvula", 409, "LEAK_NOT_ACKNOWLEDGED");
      }
    }

    return this.createAndPublish(action);
  }

  async requestSafetyReset(leakEventId: string) {
    if (this.simulationActive()) throw new AppError("Comandos físicos estão desabilitados durante a simulação", 409, "SIMULATION_ACTIVE");
    const leak = await this.leakRepository.findById(leakEventId);
    if (!leak) throw new AppError("Evento de vazamento não encontrado", 404, "LEAK_NOT_FOUND");
    if (!leak.endedAt) throw new AppError("O vazamento ainda está ativo", 409, "LEAK_ACTIVE");
    if (leak.acknowledgedAt) throw new AppError("O alerta já foi reconhecido", 409, "ALREADY_ACKNOWLEDGED");
    const state = await this.stateRepository.get();
    if (!state.deviceOnline || !this.publisher.isConnected()) {
      throw new AppError("A central ESP1 está offline", 409, "DEVICE_OFFLINE");
    }
    if (!state.esp2Online) {
      throw new AppError("O ESP2 está offline; não é possível liberar o bloqueio", 409, "ESP2_OFFLINE");
    }
    const remainingMs = config.SAFETY_RESET_DELAY_MS - (Date.now() - leak.endedAt.getTime());
    if (remainingMs > 0) {
      const remainingSeconds = Math.ceil(remainingMs / 1000);
      throw new AppError(
        `Aguarde ${remainingSeconds} segundo${remainingSeconds === 1 ? "" : "s"} sem vazamento`,
        409,
        "SAFETY_COOLDOWN",
      );
    }
    return this.createAndPublish("RESET_SAFETY", leakEventId);
  }

  private async createAndPublish(action: ValveAction, leakEventId?: string) {
    const cylinderId = await this.cylinderRepository?.ensureActive() ?? 1;
    const command = await this.commandRepository.create(action, leakEventId, cylinderId);
    const message: CommandMessage = {
      schemaVersion: 1,
      deviceId: config.MQTT_DEVICE_ID,
      commandId: command.id,
      type: action === "RESET_SAFETY" ? "safety.reset" : "valve.set",
      ...(action === "OPEN" ? { desiredState: "OPEN" as const } : {}),
      ...(action === "CLOSE" ? { desiredState: "CLOSED" as const } : {}),
    };
    try {
      await this.publisher.publishCommand(message);
    } catch (error) {
      const failed = await this.commandRepository.fail(command.id, "Falha ao publicar o comando no MQTT");
      this.io.emit("command.updated", failed);
      throw new AppError("Não foi possível enviar o comando", 503, "MQTT_PUBLISH_FAILED");
    }
    this.io.emit("command.updated", command);
    return command;
  }

  async handleAck(input: CommandAckInput) {
    const current = await this.commandRepository.findById(input.commandId);
    if (!current || current.status !== "PENDING") return null;

    const command = await this.commandRepository.complete(
      input.commandId,
      input.status,
      input.valveState,
      input.reason,
    );
    await this.stateRepository.updateValveState(input.valveState);
    if (current.action === "RESET_SAFETY" && input.status === "APPLIED" && current.leakEventId) {
      const leak = await this.leakRepository.acknowledge(current.leakEventId);
      this.io.emit("leak.acknowledged", leak);
    }
    this.io.emit("command.updated", command);
    this.io.emit("valve.updated", { valveState: input.valveState });
    return command;
  }

  async expireCommands() {
    const cutoff = new Date(Date.now() - config.COMMAND_TIMEOUT_MS);
    const expired = await this.commandRepository.expireOlderThan(cutoff);
    for (const command of expired) this.io.emit("command.updated", command);
    return expired;
  }
}
