import type { GasSettings, GasSettingsUpdate } from "../types/domain.js";
import { prisma } from "../lib/prisma.js";

export class SettingsRepository {
  async get(): Promise<GasSettings> {
    const [settings, state] = await Promise.all([prisma.systemSettings.upsert({
      where: { id: 1 },
      create: { id: 1 },
      update: {},
    }), prisma.systemState.findUnique({ where: { id: 1 }, select: { activeCylinderId: true } })]);
    const cylinder = await prisma.gasCylinder.findUnique({ where: { id: state?.activeCylinderId ?? 1 } });
    return {
      tareKg: cylinder?.tareKg ?? 0,
      capacityKg: cylinder?.capacityKg ?? 13,
      initialGasKg: cylinder?.initialGasKg ?? null,
      cylinderId: cylinder?.id ?? 1,
      cylinderNumber: cylinder?.number ?? 1,
      initialWeightKg: cylinder?.initialWeightKg ?? null,
      ...(cylinder?.installedAt ? { installedAt: cylinder.installedAt } : {}),
      noiseToleranceKg: settings.noiseToleranceKg,
      refillThresholdKg: settings.refillThresholdKg,
    };
  }

  async update(data: GasSettingsUpdate): Promise<GasSettings> {
    await prisma.systemSettings.upsert({
      where: { id: 1 },
      create: { id: 1, noiseToleranceKg: data.noiseToleranceKg, refillThresholdKg: data.refillThresholdKg },
      update: { noiseToleranceKg: data.noiseToleranceKg, refillThresholdKg: data.refillThresholdKg },
    });
    return this.get();
  }
}
