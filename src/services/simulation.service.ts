import type { SocketServer } from "../lib/socket.js";
import { config } from "../lib/config.js";
import { calculateGas } from "./gas.service.js";
import { CommandRepository } from "../repository/command.repository.js";
import { LeakRepository } from "../repository/leak.repository.js";
import { SettingsRepository } from "../repository/settings.repository.js";
import { StateRepository } from "../repository/state.repository.js";
import { TelemetryRepository } from "../repository/telemetry.repository.js";
import { TelemetryService } from "./telemetry.service.js";
import type { SimulationStateInput } from "../schemas/simulation.schema.js";
import { CylinderRepository } from "../repository/cylinder.repository.js";

export class SimulationService {
  private timer: NodeJS.Timeout | undefined;
  private active = false;
  private days = 30;
  private weightKg = 0;
  private leakActive = false;
  private startedAt?: Date;

  constructor(
    private readonly settingsRepository: SettingsRepository,
    private readonly stateRepository: StateRepository,
    private readonly telemetryRepository: TelemetryRepository,
    private readonly leakRepository: LeakRepository,
    private readonly commandRepository: CommandRepository,
    private readonly telemetryService: TelemetryService,
    private readonly io: SocketServer,
    private readonly cylinderRepository: CylinderRepository,
  ) {}

  getStatus() {
    return {
      active: this.active,
      days: this.days,
      weightKg: this.weightKg,
      leakActive: this.leakActive,
      startedAt: this.startedAt ?? null,
    };
  }

  async start(days = 30) {
    if (this.active) return this.getStatus();
    const settings = await this.settingsRepository.get();
    this.days = days;
    this.weightKg = settings.tareKg + settings.capacityKg;
    this.leakActive = false;
    this.startedAt = new Date();
    await this.seedHistory(settings.tareKg, settings.capacityKg, days);
    this.weightKg = settings.tareKg + Math.max(0.4, settings.capacityKg - Math.min(settings.capacityKg * 0.62, days * 0.07));
    this.active = true;
    await this.publishCurrent();
    this.timer = setInterval(() => void this.publishCurrent(), 10_000);
    this.timer.unref();
    return this.getStatus();
  }

  async stop() {
    if (this.active && this.leakActive) {
      this.leakActive = false;
      await this.publishCurrent();
    }
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    this.active = false;
    this.leakActive = false;
    await this.stateRepository.markOffline();
    this.io.emit("device.connectivity", { online: false, simulation: false });
    return this.getStatus();
  }

  async updateState(input: SimulationStateInput) {
    if (!this.active) throw new Error("A simulação não está ativa");
    if (input.weightKg !== undefined) this.weightKg = input.weightKg;
    if (input.leakActive !== undefined) this.leakActive = input.leakActive;
    await this.publishCurrent();
    return this.getStatus();
  }

  private async publishCurrent() {
    if (!this.active) return;
    await this.telemetryService.process({
      schemaVersion: 1,
      deviceId: config.MQTT_DEVICE_ID,
      totalWeightKg: this.weightKg,
      mq2Raw: this.leakActive ? 850 : 180,
      leakActive: this.leakActive,
      valveState: this.leakActive ? "CLOSED" : "CLOSED",
      esp2Online: true,
    });
  }

  private async seedHistory(tareKg: number, capacityKg: number, days: number) {
    const now = Date.now();
    const totalReadings = days * 8;
    const readingIntervalMs = 3 * 3_600_000;
    const leakWindows = [
      { startIndex: Math.floor(totalReadings * 0.27), length: 3, peak: 790 },
      { startIndex: Math.floor(totalReadings * 0.68), length: 4, peak: 860 },
    ];
    const historicalLeaks = [] as Array<{ peakMq2Raw: number; startedAt: Date; endedAt: Date; acknowledgedAt: Date }>;

    for (const window of leakWindows) {
      const startedAt = new Date(now - (totalReadings - window.startIndex) * readingIntervalMs);
      const endedAt = new Date(startedAt.getTime() + window.length * readingIntervalMs);
      historicalLeaks.push({ peakMq2Raw: window.peak, startedAt, endedAt, acknowledgedAt: new Date(endedAt.getTime() + readingIntervalMs) });
    }
    const cylinderId = await this.cylinderRepository.ensureActive();
    for (const leak of historicalLeaks) await this.leakRepository.createHistorical({ ...leak, cylinderId });

    for (let index = 0; index <= totalReadings; index += 1) {
      const receivedAt = new Date(now - (totalReadings - index) * readingIntervalMs);
      const progress = index / totalReadings;
      const gasKg = Math.max(0.4, capacityKg - progress * Math.min(capacityKg * 0.62, days * 0.07) + Math.sin(index / 3) * 0.025);
      const leak = leakWindows.find((window) => index >= window.startIndex && index < window.startIndex + window.length);
      const calculated = calculateGas(tareKg + gasKg, { tareKg, capacityKg, noiseToleranceKg: 0.05, refillThresholdKg: 0.5 });
      await this.telemetryRepository.create({
        deviceId: config.MQTT_DEVICE_ID,
        receivedAt,
        totalWeightKg: tareKg + gasKg,
        ...calculated,
        mq2Raw: leak?.peak ?? 180 + (index % 5) * 8,
        leakActive: Boolean(leak),
        valveState: leak ? "CLOSED" : index % 17 === 0 ? "OPEN" : "CLOSED",
        esp2Online: true,
        cylinderId,
      });
    }

    for (let index = 0; index < days; index += 7) {
      const requestedAt = new Date(now - (days - index) * 86_400_000);
      const completedAt = new Date(requestedAt.getTime() + 1_500);
      await this.commandRepository.createHistorical({
        action: index % 14 === 0 ? "OPEN" : "CLOSE",
        status: "APPLIED",
        requestedAt,
        completedAt,
        reportedValveState: index % 14 === 0 ? "OPEN" : "CLOSED",
        cylinderId,
      });
    }
  }
}
