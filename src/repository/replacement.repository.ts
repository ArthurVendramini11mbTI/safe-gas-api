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
    if (pending) throw new AppError("Já existe uma troca de botijão em andamento", 409, "REPLACEMENT_IN_PROGRESS");
    return prisma.cylinderReplacement.create({ data: {} });
  }

  async updateFromTelemetry(totalWeightKg: number, receivedAt: Date) {
    const pending = await this.getPending();
    if (!pending) return null;
    return prisma.cylinderReplacement.update({
      where: { id: pending.id },
      data: { measuredWeightKg: totalWeightKg, lastReadingAt: receivedAt, weightStable: true },
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
