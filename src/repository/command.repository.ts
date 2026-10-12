import { prisma } from "../lib/prisma.js";
import type { CommandStatus, ValveAction, ValveState } from "../types/domain.js";

export class CommandRepository {
  create(action: ValveAction, leakEventId?: string) {
    return prisma.valveCommand.create({
      data: { action, ...(leakEventId ? { leakEventId } : {}) },
    });
  }

  createHistorical(data: {
    action: ValveAction;
    status: Exclude<CommandStatus, "PENDING" | "EXPIRED">;
    requestedAt: Date;
    completedAt: Date;
    reportedValveState: ValveState;
    reason?: string;
  }) {
    return prisma.valveCommand.create({ data });
  }

  findById(id: string) {
    return prisma.valveCommand.findUnique({ where: { id } });
  }

  complete(id: string, status: Exclude<CommandStatus, "PENDING" | "EXPIRED">, valveState: ValveState, reason?: string) {
    return prisma.valveCommand.update({
      where: { id },
      data: {
        status,
        reportedValveState: valveState,
        completedAt: new Date(),
        ...(reason ? { reason } : {}),
      },
    });
  }

  fail(id: string, reason: string) {
    return prisma.valveCommand.update({
      where: { id },
      data: { status: "FAILED", reason, completedAt: new Date() },
    });
  }

  async expireOlderThan(cutoff: Date) {
    const commands = await prisma.valveCommand.findMany({
      where: { status: "PENDING", requestedAt: { lt: cutoff } },
    });
    if (commands.length === 0) return [];
    await prisma.valveCommand.updateMany({
      where: { id: { in: commands.map((command) => command.id) } },
      data: { status: "EXPIRED", reason: "ESP1 não confirmou o comando no prazo", completedAt: new Date() },
    });
    return commands.map((command) => ({
      ...command,
      status: "EXPIRED" as const,
      reason: "ESP1 não confirmou o comando no prazo",
    }));
  }

  list(limit: number) {
    return prisma.valveCommand.findMany({ orderBy: { requestedAt: "desc" }, take: limit });
  }
}
