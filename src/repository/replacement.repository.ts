import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/errors.js";

const FRESHNESS_MS = 15_000;

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
    const settings = await prisma.systemSettings.findUnique({ where: { id: 1 }, select: { noiseToleranceKg: true } });
    const readings = await prisma.telemetryReading.findMany({
      where: { receivedAt: { gte: new Date(Math.max(receivedAt.getTime() - 30_000, pending.startedAt.getTime())), lte: receivedAt } },
      orderBy: { receivedAt: "desc" },
      take: 3,
      select: { totalWeightKg: true, receivedAt: true },
    });
    const tolerance = settings?.noiseToleranceKg ?? 0.05;
    const stable = readings.length >= 3 && Math.max(...readings.map((item) => item.totalWeightKg)) - Math.min(...readings.map((item) => item.totalWeightKg)) <= tolerance;
    return prisma.cylinderReplacement.update({
      where: { id: pending.id },
      data: { measuredWeightKg: totalWeightKg, lastReadingAt: receivedAt, weightStable: stable },
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
