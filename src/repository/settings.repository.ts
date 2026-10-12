import type { GasSettings } from "../types/domain.js";
import { prisma } from "../lib/prisma.js";

export class SettingsRepository {
  async get(): Promise<GasSettings> {
    const settings = await prisma.systemSettings.upsert({
      where: { id: 1 },
      create: { id: 1 },
      update: {},
    });
    return settings;
  }

  async update(data: GasSettings): Promise<GasSettings> {
    return prisma.systemSettings.upsert({
      where: { id: 1 },
      create: { id: 1, ...data },
      update: data,
    });
  }
}
