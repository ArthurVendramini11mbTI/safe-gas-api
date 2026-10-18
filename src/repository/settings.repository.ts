import type { GasSettings } from "../types/domain.js";
import { prisma } from "../lib/prisma.js";

export class SettingsRepository {
  async get(): Promise<GasSettings> {
    const state = await prisma.systemState.findUnique({ where: { id: 1 }, select: { activeCylinderId: true } });
    const cylinder = await prisma.gasCylinder.findUnique({ where: { id: state?.activeCylinderId ?? 1 } });
    const last = await prisma.telemetryReading.findFirst({ where: { cylinderId: cylinder?.id ?? 1, totalWeightKg: { not: null }, cylinderPresent: true }, orderBy: { receivedAt: "desc" }, select: { totalWeightKg: true } });
    const initial = cylinder?.initialWeightKg ?? last?.totalWeightKg ?? 0;
    const noiseToleranceKg = Number(Math.min(0.05, Math.max(0.005, initial * 0.005)).toFixed(3));
    return {
      tareKg: cylinder?.tareKg ?? 0,
      capacityKg: cylinder?.capacityKg ?? 13,
      initialGasKg: cylinder?.initialGasKg ?? null,
      cylinderId: cylinder?.id ?? 1,
      cylinderNumber: cylinder?.number ?? 1,
      initialWeightKg: cylinder?.initialWeightKg ?? null,
      ...(cylinder?.installedAt ? { installedAt: cylinder.installedAt } : {}),
      noiseToleranceKg,
    };
  }
}
