import { prisma } from "../lib/prisma.js";
import type { ValveState, WeightStatus } from "../types/domain.js";

export interface StateTelemetryUpdate {
  deviceId: string;
  valveState: ValveState;
  leakActive: boolean;
  mq2Raw: number;
  totalWeightKg?: number | null;
  gasKg?: number | null;
  gasPercentage?: number | null;
  weightStatus?: WeightStatus;
  weightBootId?: string | null;
  weightSampleSequence?: number | null;
  weightMeasuredAt?: Date | null;
  cylinderPresent?: boolean | null;
  esp2Online: boolean;
}

export class StateRepository {
  private readonly unavailableWeight = {
    totalWeightKg: null,
    gasKg: null,
    gasPercentage: null,
    weightStatus: "UNAVAILABLE" as const,
    weightBootId: null,
    weightSampleSequence: null,
    weightMeasuredAt: null,
    cylinderPresent: null,
  };

  get() {
    return prisma.systemState.upsert({
      where: { id: 1 },
      create: { id: 1 },
      update: {},
    });
  }

  updateTelemetry(data: StateTelemetryUpdate) {
    return prisma.systemState.upsert({
      where: { id: 1 },
      create: { id: 1, deviceOnline: true, lastSeenAt: new Date(), ...data },
      update: { deviceOnline: true, lastSeenAt: new Date(), ...data },
    });
  }

  updateConnectivity(deviceOnline: boolean) {
    return prisma.systemState.upsert({
      where: { id: 1 },
      create: { id: 1, deviceOnline },
      update: { deviceOnline },
    });
  }

  updateValveState(valveState: ValveState) {
    return prisma.systemState.update({ where: { id: 1 }, data: { valveState } });
  }

  updateGasCalculation(gasKg: number, gasPercentage: number) {
    return prisma.systemState.update({ where: { id: 1 }, data: { gasKg, gasPercentage } });
  }

  markOffline() {
    return prisma.systemState.upsert({
      where: { id: 1 },
      create: { id: 1, deviceOnline: false, esp2Online: false },
      update: { deviceOnline: false, esp2Online: false },
    });
  }

  async markOfflineIfStale(cutoff: Date) {
    const result = await prisma.systemState.updateMany({
      where: { id: 1, deviceOnline: true, OR: [{ lastSeenAt: null }, { lastSeenAt: { lt: cutoff } }] },
      data: { deviceOnline: false },
    });
    return result.count > 0;
  }

  async markWeightUnavailableIfStale(cutoff: Date) {
    const result = await prisma.systemState.updateMany({
      where: { id: 1, weightMeasuredAt: { not: null, lt: cutoff }, weightStatus: { not: "UNAVAILABLE" } },
      data: { ...this.unavailableWeight },
    });
    return result.count > 0;
  }
}
