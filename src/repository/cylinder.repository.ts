import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/errors.js";
import { ReplacementRepository } from "./replacement.repository.js";

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

  async replaceFromPending(initialGasKg: number, replacementRepository: ReplacementRepository) {
    const pending = await replacementRepository.requireStablePending();
    return this.replace(pending.measuredWeightKg as number, initialGasKg, pending.id);
  }

  async replace(totalWeightKg: number, initialGasKg: number, replacementId?: string) {
    return prisma.$transaction(async (tx) => {
      const state = await tx.systemState.findUnique({ where: { id: 1 } });
      const activeId = state?.activeCylinderId ?? 1;
      const previous = await tx.gasCylinder.findUnique({ where: { id: activeId } });
      const capacityKg = initialGasKg;
      const tareKg = totalWeightKg - initialGasKg;
      if (initialGasKg <= 0) throw new AppError("Informe uma quantidade de gás maior que zero.", 400, "INVALID_INITIAL_GAS");
      if (initialGasKg >= totalWeightKg) throw new AppError("O gás inicial deve ser menor que o peso total medido do botijão.", 400, "INVALID_INITIAL_GAS");
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
      if (replacementId) {
        await tx.cylinderReplacement.update({ where: { id: replacementId }, data: { status: "CONFIRMED", completedAt: now, measuredWeightKg: totalWeightKg, initialGasKg, computedTareKg: tareKg } });
      }
      return cylinder;
    });
  }
}
