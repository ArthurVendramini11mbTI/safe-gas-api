import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/errors.js";

// O ESP1 publica normalmente a cada 30 s. A leitura permanece recente até a
// próxima telemetria, com uma margem para latência e atualização do painel.
const FRESHNESS_MS = 45_000;

export class ReplacementRepository {
  getPending() {
    return prisma.cylinderReplacement.findFirst({ where: { status: "PENDING" }, orderBy: { startedAt: "desc" } });
  }

  async start() {
    const pending = await this.getPending();
    if (pending) return pending;
    const state = await prisma.systemState.findUnique({ where: { id: 1 } });
    try {
      return await prisma.cylinderReplacement.create({
        data: {
          baselineBootId: state?.weightBootId ?? null,
          baselineSampleSequence: state?.weightSampleSequence ?? null,
        },
      });
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
        const concurrent = await this.getPending();
        if (concurrent) return concurrent;
      }
      throw error;
    }
  }

  async updateFromTelemetry(input: { totalWeightKg: number; receivedAt: Date; bootId: string; sampleSequence: number }) {
    const pending = await this.getPending();
    if (!pending) return null;
    if (input.receivedAt < pending.startedAt) return null;
    if (pending.weightStable && pending.lastReadingAt && Date.now() - pending.lastReadingAt.getTime() <= FRESHNESS_MS) return null;
    const newerSample = input.bootId !== pending.baselineBootId
      || pending.baselineSampleSequence === null
      || input.sampleSequence > pending.baselineSampleSequence;
    if (!newerSample) return null;
    return prisma.cylinderReplacement.update({
      where: { id: pending.id },
      data: {
        measuredWeightKg: input.totalWeightKg,
        lastReadingAt: input.receivedAt,
        weightStable: true,
        measurementBootId: input.bootId,
        measurementSampleSequence: input.sampleSequence,
      },
    });
  }

  async requireStablePending() {
    const pending = await this.getPending();
    if (!pending) throw new AppError("Nenhuma troca de botijão foi iniciada", 409, "REPLACEMENT_NOT_STARTED");
    if (!pending.weightStable || !pending.measuredWeightKg || !pending.lastReadingAt || Date.now() - pending.lastReadingAt.getTime() > FRESHNESS_MS) {
      throw new AppError("Aguarde uma leitura estável e recente da balança", 409, "WEIGHT_NOT_STABLE");
    }
    return pending;
  }

  cancel() {
    return prisma.cylinderReplacement.updateMany({ where: { status: "PENDING" }, data: { status: "CANCELLED", cancelledAt: new Date() } });
  }
}
