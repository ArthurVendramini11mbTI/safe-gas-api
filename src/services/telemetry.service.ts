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
    const rawValidWeight = input.schemaVersion === 2
      && input.weightStatus === "VALID"
      && input.totalWeightKg !== undefined;
    const lastPresent = await this.telemetryRepository.latestPresent(cylinderId);
    const referenceWeight = lastPresent?.totalWeightKg ?? (previousState.cylinderPresent === true ? previousState.totalWeightKg : null);
    const pending = await this.replacementRepository.getPending();
    const rawWeight = rawValidWeight ? input.totalWeightKg! : null;
    const increase = rawWeight !== null && referenceWeight !== null ? rawWeight - referenceWeight : 0;
    const acceptedWeight = rawValidWeight && (referenceWeight === null ? !pending : increase <= settings.noiseToleranceKg);
    const normalizedWeight = acceptedWeight
      ? (referenceWeight !== null && Math.abs(increase) <= settings.noiseToleranceKg ? referenceWeight : rawWeight)
      : null;
    const minimumPresentWeight = Math.max(0.02, settings.tareKg - settings.noiseToleranceKg);
    const cylinderPresent = acceptedWeight ? normalizedWeight! >= minimumPresentWeight : null;
    const calculated = acceptedWeight && cylinderPresent ? calculateGas(normalizedWeight!, settings) : null;
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
      totalWeightKg: acceptedWeight && cylinderPresent ? normalizedWeight : null,
      gasKg: calculated?.gasKg ?? null,
      gasPercentage: calculated?.gasPercentage ?? null,
      weightStatus: acceptedWeight ? "VALID" : weightStatus,
      weightBootId,
      weightSampleSequence,
      cylinderPresent,
      cylinderId,
    };
    const latestReading = await this.telemetryRepository.latest(cylinderId);
    const nextWeight = readingData.totalWeightKg;
    const weightChanged = latestReading !== null
      && latestReading.totalWeightKg !== nextWeight
      && (latestReading.totalWeightKg === null || nextWeight === null
        || Math.abs(latestReading.totalWeightKg - nextWeight) >= settings.noiseToleranceKg);
    const shouldPersist = !latestReading
      || latestReading.weightStatus !== weightStatus
      || latestReading.cylinderPresent !== cylinderPresent
      || weightChanged
      || receivedAt.getTime() - latestReading.receivedAt.getTime() >= 30_000;
    const reading = shouldPersist ? await this.telemetryRepository.create(readingData) : null;
    const replacementReading = rawValidWeight && rawWeight! > 0
      ? await this.replacementRepository.updateFromTelemetry({
        totalWeightKg: rawWeight!,
        receivedAt,
        bootId: weightBootId!,
        sampleSequence: weightSampleSequence!,
      })
      : null;
    const state = await this.stateRepository.updateTelemetry({
      ...telemetry,
      ...(acceptedWeight ? {
        totalWeightKg: cylinderPresent ? normalizedWeight : null,
        gasKg: calculated?.gasKg ?? null,
        gasPercentage: calculated?.gasPercentage ?? null,
        weightStatus: "VALID" as const,
        weightBootId,
        weightSampleSequence,
        weightMeasuredAt: receivedAt,
        cylinderPresent,
      } : {}),
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
