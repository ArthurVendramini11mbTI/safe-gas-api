import { rangeStart } from "../lib/time.js";
import { CommandRepository } from "../repository/command.repository.js";
import { LeakRepository } from "../repository/leak.repository.js";
import { SettingsRepository } from "../repository/settings.repository.js";
import { StateRepository } from "../repository/state.repository.js";
import { TelemetryRepository } from "../repository/telemetry.repository.js";
import type { GasSettings } from "../types/domain.js";
import { calculateConsumption } from "./gas.service.js";
import { calculateGas } from "./gas.service.js";

export class QueryService {
  constructor(
    private readonly settingsRepository: SettingsRepository,
    private readonly stateRepository: StateRepository,
    private readonly telemetryRepository: TelemetryRepository,
    private readonly leakRepository: LeakRepository,
    private readonly commandRepository: CommandRepository,
    private readonly simulationStatus: () => unknown = () => ({ active: false }),
  ) {}

  async getStatus() {
    const [state, settings, unacknowledgedLeak] = await Promise.all([
      this.stateRepository.get(),
      this.settingsRepository.get(),
      this.leakRepository.findLatestUnacknowledged(),
    ]);
    return { ...state, settings, unacknowledgedLeak, simulation: this.simulationStatus() };
  }

  getSettings() {
    return this.settingsRepository.get();
  }

  async updateSettings(data: GasSettings) {
    const settings = await this.settingsRepository.update(data);
    const state = await this.stateRepository.get();
    if (state.totalWeightKg !== null) {
      const calculated = calculateGas(state.totalWeightKg, settings);
      await this.stateRepository.updateGasCalculation(calculated.gasKg, calculated.gasPercentage);
    }
    return settings;
  }

  async getCurrentGas() {
    const state = await this.stateRepository.get();
    return {
      totalWeightKg: state.totalWeightKg,
      gasKg: state.gasKg,
      gasPercentage: state.gasPercentage,
      measuredAt: state.lastSeenAt,
    };
  }

  listTelemetry(from: Date | undefined, to: Date | undefined, limit: number) {
    return this.telemetryRepository.list(from, to, limit);
  }

  listLeaks(from: Date | undefined, to: Date | undefined, limit: number) {
    return this.leakRepository.list(from, to, limit);
  }

  listCommands(limit: number) {
    return this.commandRepository.list(limit);
  }

  async consumption(range: "day" | "week" | "month") {
    const to = new Date();
    const from = rangeStart(range, to);
    const [readings, settings] = await Promise.all([
      this.telemetryRepository.listGasReadings(from, to),
      this.settingsRepository.get(),
    ]);
    return { range, from, to, ...calculateConsumption(readings, settings, range) };
  }
}
