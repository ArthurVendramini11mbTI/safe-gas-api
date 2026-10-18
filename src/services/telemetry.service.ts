import type { SocketServer } from "../lib/socket.js";
import type { TelemetryInput } from "../schemas/mqtt.schema.js";
import { LeakRepository } from "../repository/leak.repository.js";
import { SettingsRepository } from "../repository/settings.repository.js";
import { StateRepository } from "../repository/state.repository.js";
import { TelemetryRepository } from "../repository/telemetry.repository.js";
import { calculateGas } from "./gas.service.js";
import { CylinderRepository } from "../repository/cylinder.repository.js";
import { ReplacementRepository } from "../repository/replacement.repository.js";
import type { WeightStatus } from "../types/domain.js";

export class TelemetryService {
  constructor(
    private readonly settingsRepository: SettingsRepository,
    private readonly stateRepository: StateRepository,
    private readonly telemetryRepository: TelemetryRepository,
    private readonly leakRepository: LeakRepository,
    private readonly io: SocketServer,
    private readonly cylinderRepository: CylinderRepository,
    private readonly replacementRepository: ReplacementRepository,
  ) {}

  async process(input: TelemetryInput) {
    const settings = await this.settingsRepository.get();
    const cylinderId = await this.cylinderRepository.ensureActive();
    const previousState = await this.stateRepository.get();
    const receivedAt = new Date();
    const validWeight = input.schemaVersion === 2
      && input.weightStatus === "VALID"
      && input.totalWeightKg !== undefined;
    const totalWeightKg = validWeight ? input.totalWeightKg! : null;
    const minimumPresentWeight = Math.max(0.02, settings.tareKg - settings.noiseToleranceKg);
    const cylinderPresent = validWeight ? totalWeightKg! >= minimumPresentWeight : null;
    const calculated = validWeight && cylinderPresent ? calculateGas(totalWeightKg!, settings) : null;
    const weightStatus: WeightStatus = input.schemaVersion === 2 ? input.weightStatus : "LEGACY";
    const weightBootId = input.schemaVersion === 2 ? input.weightBootId : null;
    const weightSampleSequence = input.schemaVersion === 2 ? input.weightSampleSequence : null;
    const telemetry = {
      deviceId: input.deviceId,
      mq2Raw: input.mq2Raw,
      leakActive: input.leakActive,
      valveState: input.valveState,
      esp2Online: input.esp2Online,
    };

    const readingData = {
      ...telemetry,
      receivedAt,
      totalWeightKg,
      gasKg: calculated?.gasKg ?? null,
      gasPercentage: calculated?.gasPercentage ?? null,
      weightStatus,
      weightBootId,
      weightSampleSequence,
      cylinderPresent,
      cylinderId,
    };
    const latestReading = await this.telemetryRepository.latest(cylinderId);
    const weightChanged = latestReading !== null
      && latestReading.totalWeightKg !== totalWeightKg
      && (latestReading.totalWeightKg === null || totalWeightKg === null
        || Math.abs(latestReading.totalWeightKg - totalWeightKg) >= settings.noiseToleranceKg);
    const shouldPersist = !latestReading
      || latestReading.weightStatus !== weightStatus
      || latestReading.cylinderPresent !== cylinderPresent
      || weightChanged
      || receivedAt.getTime() - latestReading.receivedAt.getTime() >= 30_000;
    const reading = shouldPersist ? await this.telemetryRepository.create(readingData) : null;
    const replacementReading = validWeight && totalWeightKg! > 0
      ? await this.replacementRepository.updateFromTelemetry({
        totalWeightKg: totalWeightKg!,
        receivedAt,
        bootId: weightBootId!,
        sampleSequence: weightSampleSequence!,
      })
      : null;
    const state = await this.stateRepository.updateTelemetry({
      ...telemetry,
      totalWeightKg,
      gasKg: calculated?.gasKg ?? null,
      gasPercentage: calculated?.gasPercentage ?? null,
      weightStatus,
      weightBootId,
      weightSampleSequence,
      weightMeasuredAt: validWeight ? receivedAt : null,
      cylinderPresent,
    });

    const openLeak = await this.leakRepository.findOpen();
    if (input.leakActive) {
      if (!openLeak) {
        const leak = await this.leakRepository.create(input.mq2Raw, cylinderId);
        this.io.emit("leak.started", leak);
      } else if (input.mq2Raw > openLeak.peakMq2Raw) {
        await this.leakRepository.updatePeak(openLeak.id, input.mq2Raw);
      }
    } else if (openLeak) {
      const leak = await this.leakRepository.clear(openLeak.id);
      this.io.emit("leak.cleared", leak);
    }

    if (reading || replacementReading) this.io.emit("telemetry.updated", reading ?? state);
    if (previousState.valveState !== state.valveState) this.io.emit("valve.updated", state);
    if (!previousState.deviceOnline) this.io.emit("device.connectivity", { online: true, lastSeenAt: state.lastSeenAt });
    return reading;
  }
}
