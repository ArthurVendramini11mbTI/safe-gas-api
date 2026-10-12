import { prisma } from "../lib/prisma.js";
import type { ValveState } from "../types/domain.js";

export interface StateTelemetryUpdate {
  deviceId: string;
  valveState: ValveState;
  leakActive: boolean;
  mq2Raw: number;
  totalWeightKg: number;
  gasKg: number;
  gasPercentage: number;
  esp2Online: boolean;
}

export class StateRepository {
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
}
