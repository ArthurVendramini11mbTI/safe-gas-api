import { prisma } from "../lib/prisma.js";
import type { ValveState } from "../types/domain.js";

export interface SaveTelemetryInput {
  deviceId: string;
  totalWeightKg: number;
  gasKg: number;
  gasPercentage: number;
  mq2Raw: number;
  leakActive: boolean;
  valveState: ValveState;
  esp2Online: boolean;
  receivedAt?: Date;
}

function serializeReading<T extends { id: bigint }>(reading: T) {
  return { ...reading, id: reading.id.toString() };
}

export class TelemetryRepository {
  async create(data: SaveTelemetryInput) {
    const reading = await prisma.telemetryReading.create({ data });
    return serializeReading(reading);
  }

  async list(from: Date | undefined, to: Date | undefined, limit: number) {
    const rows = await prisma.telemetryReading.findMany({
      where: {
        receivedAt: {
          ...(from ? { gte: from } : {}),
          ...(to ? { lte: to } : {}),
        },
      },
      orderBy: { receivedAt: "desc" },
      take: limit,
    });
    return rows.map(serializeReading);
  }

  listGasReadings(from: Date, to: Date) {
    return prisma.telemetryReading.findMany({
      where: { receivedAt: { gte: from, lte: to } },
      select: { receivedAt: true, gasKg: true },
      orderBy: { receivedAt: "asc" },
    });
  }
}
