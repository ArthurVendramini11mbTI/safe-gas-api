import type { SocketServer } from "../lib/socket.js";
import type { TelemetryInput } from "../schemas/mqtt.schema.js";
import { LeakRepository } from "../repository/leak.repository.js";
import { SettingsRepository } from "../repository/settings.repository.js";
import { StateRepository } from "../repository/state.repository.js";
import { TelemetryRepository } from "../repository/telemetry.repository.js";
import { calculateGas } from "./gas.service.js";

export class TelemetryService {
  constructor(
    private readonly settingsRepository: SettingsRepository,
    private readonly stateRepository: StateRepository,
    private readonly telemetryRepository: TelemetryRepository,
    private readonly leakRepository: LeakRepository,
    private readonly io: SocketServer,
  ) {}

  async process(input: TelemetryInput) {
    const settings = await this.settingsRepository.get();
    const calculated = calculateGas(input.totalWeightKg, settings);
    const previousState = await this.stateRepository.get();
    // schemaVersion pertence somente ao envelope MQTT e nao e uma coluna do banco.
    const { schemaVersion: _schemaVersion, ...telemetry } = input;

    const reading = await this.telemetryRepository.create({ ...telemetry, ...calculated });
    const state = await this.stateRepository.updateTelemetry({ ...telemetry, ...calculated });

    const openLeak = await this.leakRepository.findOpen();
    if (input.leakActive) {
      if (!openLeak) {
        const leak = await this.leakRepository.create(input.mq2Raw);
        this.io.emit("leak.started", leak);
      } else if (input.mq2Raw > openLeak.peakMq2Raw) {
        await this.leakRepository.updatePeak(openLeak.id, input.mq2Raw);
      }
    } else if (openLeak) {
      const leak = await this.leakRepository.clear(openLeak.id);
      this.io.emit("leak.cleared", leak);
    }

    this.io.emit("telemetry.updated", reading);
    if (previousState.valveState !== state.valveState) this.io.emit("valve.updated", state);
    if (!previousState.deviceOnline) this.io.emit("device.connectivity", { online: true, lastSeenAt: state.lastSeenAt });
    return reading;
  }
}
