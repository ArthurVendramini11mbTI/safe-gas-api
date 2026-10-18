import { prisma } from "../lib/prisma.js";
import type { ValveState, WeightStatus } from "../types/domain.js";

export interface SaveTelemetryInput {
  deviceId: string;
  totalWeightKg: number | null;
  gasKg: number | null;
  gasPercentage: number | null;
  weightStatus: WeightStatus;
  weightBootId: string | null;
  weightSampleSequence: number | null;
  cylinderPresent: boolean | null;
  mq2Raw: number;
  leakActive: boolean;
  valveState: ValveState;
  esp2Online: boolean;
  receivedAt?: Date;
  cylinderId: number;
}

function serializeReading<T extends { id: bigint }>(reading: T) {
  return { ...reading, id: reading.id.toString() };
}

export class TelemetryRepository {
  async create(data: SaveTelemetryInput) {
    const reading = await prisma.telemetryReading.create({ data });
    return serializeReading(reading);
  }

  latest(cylinderId: number) {
    return prisma.telemetryReading.findFirst({ where: { cylinderId }, orderBy: { receivedAt: "desc" } });
  }

  latestPresent(cylinderId: number) {
    return prisma.telemetryReading.findFirst({
      where: { cylinderId, totalWeightKg: { not: null }, cylinderPresent: true, weightStatus: "VALID" },
      orderBy: { receivedAt: "desc" },
      select: { totalWeightKg: true },
    });
  }

  async list(from: Date | undefined, to: Date | undefined, limit: number, cylinderId?: number) {
    const rows = await prisma.telemetryReading.findMany({
      where: {
        receivedAt: {
          ...(from ? { gte: from } : {}),
          ...(to ? { lte: to } : {}),
        },
        ...(cylinderId ? { cylinderId } : {}),
      },
      orderBy: { receivedAt: "desc" },
      take: limit,
    });
    return rows.map(serializeReading);
  }

  async listGasHistory(from: Date | undefined, to: Date | undefined, limit: number, cylinderId?: number) {
    const rows = await prisma.telemetryReading.findMany({
      where: {
        receivedAt: {
          ...(from ? { gte: from } : {}),
          ...(to ? { lte: to } : {}),
        },
        weightStatus: "VALID",
        cylinderPresent: true,
        gasKg: { not: null },
        ...(cylinderId ? { cylinderId } : {}),
      },
      orderBy: { receivedAt: "desc" },
      take: limit,
    });
    return rows.map(serializeReading);
  }

  listGasReadings(from: Date, to: Date, cylinderId?: number) {
    return prisma.telemetryReading.findMany({
      where: {
        receivedAt: { gte: from, lte: to },
        weightStatus: "VALID",
        gasKg: { not: null },
        cylinderPresent: true,
        ...(cylinderId ? { cylinderId } : {}),
      },
      select: { receivedAt: true, gasKg: true, cylinderId: true },
      orderBy: { receivedAt: "asc" },
    }).then((rows) => rows.map((row) => ({ receivedAt: row.receivedAt, gasKg: row.gasKg as number, cylinderId: row.cylinderId })));
  }
}
