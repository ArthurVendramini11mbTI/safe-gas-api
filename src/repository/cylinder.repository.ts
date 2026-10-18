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
    const totalWeightKg = pending.measuredWeightKg as number;
    if (initialGasKg <= 0) throw new AppError("Informe uma quantidade de gás maior que zero.", 400, "INVALID_INITIAL_GAS");
    if (initialGasKg >= totalWeightKg) throw new AppError("O gás inicial deve ser menor que o peso total medido do botijão.", 400, "INVALID_INITIAL_GAS");
    return prisma.$transaction(async (tx) => {
      const claimed = await tx.cylinderReplacement.updateMany({
        where: { id: pending.id, status: "PENDING" },
        data: {
          status: "CONFIRMED",
          completedAt: new Date(),
          initialGasKg,
          computedTareKg: totalWeightKg - initialGasKg,
        },
      });
      if (claimed.count !== 1) throw new AppError("Esta troca já foi confirmada ou cancelada", 409, "REPLACEMENT_ALREADY_FINISHED");
      const state = await tx.systemState.findUnique({ where: { id: 1 } });
      const activeId = state?.activeCylinderId ?? 1;
      const capacityKg = initialGasKg;
      const tareKg = totalWeightKg - initialGasKg;
      const now = new Date();
      await tx.gasCylinder.updateMany({
        where: { id: activeId, removedAt: null },
        data: { removedAt: now, ...(state?.cylinderPresent === true && state.totalWeightKg !== null ? { finalWeightKg: state.totalWeightKg } : {}) },
      });
      const last = await tx.gasCylinder.findFirst({ orderBy: { number: "desc" }, select: { number: true } });
      const cylinder = await tx.gasCylinder.create({
        data: { number: (last?.number ?? 0) + 1, installedAt: now, initialWeightKg: totalWeightKg, initialGasKg, tareKg, capacityKg },
      });
      const gasKg = initialGasKg;
      const gasPercentage = capacityKg === 0 ? 0 : (gasKg / capacityKg) * 100;
      await tx.systemState.upsert({
        where: { id: 1 },
        create: { id: 1, activeCylinderId: cylinder.id, totalWeightKg, gasKg, gasPercentage, weightStatus: "VALID", weightBootId: pending.measurementBootId, weightSampleSequence: pending.measurementSampleSequence, weightMeasuredAt: pending.lastReadingAt, cylinderPresent: true },
        update: { activeCylinderId: cylinder.id, totalWeightKg, gasKg, gasPercentage, weightStatus: "VALID", weightBootId: pending.measurementBootId, weightSampleSequence: pending.measurementSampleSequence, weightMeasuredAt: pending.lastReadingAt, cylinderPresent: true },
      });
      await tx.telemetryReading.create({
        data: {
          deviceId: state?.deviceId ?? "esp1",
          receivedAt: now,
          totalWeightKg,
          gasKg,
          gasPercentage,
          weightStatus: "VALID",
          weightBootId: pending.measurementBootId,
          weightSampleSequence: pending.measurementSampleSequence,
          cylinderPresent: true,
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
