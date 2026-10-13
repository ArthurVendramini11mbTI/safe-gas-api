import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/errors.js";

export class CylinderRepository {
  async ensureActive() {
    const state = await prisma.systemState.findUnique({ where: { id: 1 }, select: { activeCylinderId: true } });
    if (state) return state.activeCylinderId;
    const cylinder = await prisma.gasCylinder.findFirst({ where: { removedAt: null }, orderBy: { number: "desc" } });
    return cylinder?.id ?? 1;
  }

  list() {
    return prisma.gasCylinder.findMany({ orderBy: { number: "asc" } });
  }

  active() {
    return prisma.gasCylinder.findFirst({ where: { removedAt: null }, orderBy: { number: "desc" } });
  }

  async replace(totalWeightKg: number, initialGasKg: number) {
    return prisma.$transaction(async (tx) => {
      const state = await tx.systemState.findUnique({ where: { id: 1 } });
      const activeId = state?.activeCylinderId ?? 1;
      const previous = await tx.gasCylinder.findUnique({ where: { id: activeId } });
      const capacityKg = previous?.capacityKg ?? 13;
      const tareKg = totalWeightKg - initialGasKg;
      if (initialGasKg > capacityKg) throw new AppError(`O gás inicial não pode exceder a capacidade de ${capacityKg} kg`);
      const now = new Date();
      await tx.gasCylinder.updateMany({
        where: { id: activeId, removedAt: null },
        data: { removedAt: now, ...(state?.totalWeightKg !== null && state?.totalWeightKg !== undefined ? { finalWeightKg: state.totalWeightKg } : {}) },
      });
      const last = await tx.gasCylinder.findFirst({ orderBy: { number: "desc" }, select: { number: true } });
      const cylinder = await tx.gasCylinder.create({
        data: { number: (last?.number ?? 0) + 1, installedAt: now, initialWeightKg: totalWeightKg, initialGasKg, tareKg, capacityKg },
      });
      const gasKg = initialGasKg;
      const gasPercentage = capacityKg === 0 ? 0 : (gasKg / capacityKg) * 100;
      await tx.systemState.upsert({
        where: { id: 1 },
        create: { id: 1, activeCylinderId: cylinder.id, totalWeightKg, gasKg, gasPercentage },
        update: { activeCylinderId: cylinder.id, totalWeightKg, gasKg, gasPercentage },
      });
      await tx.telemetryReading.create({
        data: {
          deviceId: state?.deviceId ?? "esp1",
          receivedAt: now,
          totalWeightKg,
          gasKg,
          gasPercentage,
          mq2Raw: state?.mq2Raw ?? 0,
          leakActive: false,
          valveState: state?.valveState ?? "CLOSED",
          esp2Online: state?.esp2Online ?? false,
          cylinderId: cylinder.id,
        },
      });
      return cylinder;
    });
  }
}
