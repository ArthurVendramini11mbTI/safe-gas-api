import { prisma } from "../lib/prisma.js";

export class LeakRepository {
  findOpen() {
    return prisma.leakEvent.findFirst({ where: { endedAt: null }, orderBy: { startedAt: "desc" } });
  }

  create(peakMq2Raw: number, cylinderId = 1) {
    return prisma.leakEvent.create({ data: { peakMq2Raw, cylinderId } });
  }

  createHistorical(data: { peakMq2Raw: number; startedAt: Date; endedAt: Date; acknowledgedAt: Date; cylinderId?: number }) {
    return prisma.leakEvent.create({ data });
  }

  updatePeak(id: string, peakMq2Raw: number) {
    return prisma.leakEvent.update({ where: { id }, data: { peakMq2Raw } });
  }

  clear(id: string) {
    return prisma.leakEvent.update({ where: { id }, data: { endedAt: new Date() } });
  }

  findById(id: string) {
    return prisma.leakEvent.findUnique({ where: { id } });
  }

  acknowledge(id: string) {
    return prisma.leakEvent.update({ where: { id }, data: { acknowledgedAt: new Date() } });
  }

  findLatestUnacknowledged() {
    return prisma.leakEvent.findFirst({
      where: { acknowledgedAt: null },
      orderBy: { startedAt: "desc" },
    });
  }

  list(from: Date | undefined, to: Date | undefined, limit: number, cylinderId?: number) {
    return prisma.leakEvent.findMany({
      where: {
        startedAt: {
          ...(from ? { gte: from } : {}),
          ...(to ? { lte: to } : {}),
        },
        ...(cylinderId ? { cylinderId } : {}),
      },
      orderBy: { startedAt: "desc" },
      take: limit,
    });
  }
}
