import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL do Supabase não foi configurada");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  const settings = await prisma.systemSettings.upsert({
    where: { id: 1 },
    create: { id: 1, tareKg: 12, capacityKg: 13 },
    update: {},
  });
  await prisma.systemState.upsert({
    where: { id: 1 },
    create: { id: 1, deviceId: "esp1", valveState: "CLOSED" },
    update: {},
  });

  if ((await prisma.telemetryReading.count()) === 0) {
    const now = Date.now();
    const samples = Array.from({ length: 43 }, (_, index) => {
      const gasKg = Math.max(0, 11.8 - index * 0.075);
      return {
        deviceId: "esp1",
        receivedAt: new Date(now - (42 - index) * 4 * 60 * 60 * 1000),
        totalWeightKg: settings.tareKg + gasKg,
        gasKg,
        gasPercentage: (gasKg / settings.capacityKg) * 100,
        mq2Raw: 170 + (index % 4) * 3,
        leakActive: false,
        valveState: "CLOSED" as const,
        esp2Online: true,
      };
    });
    await prisma.telemetryReading.createMany({ data: samples });
  }

  if ((await prisma.leakEvent.count()) === 0) {
    const startedAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    await prisma.leakEvent.create({
      data: {
        startedAt,
        endedAt: new Date(startedAt.getTime() + 75_000),
        acknowledgedAt: new Date(startedAt.getTime() + 100_000),
        peakMq2Raw: 720,
      },
    });
  }
}

main()
  .then(() => console.info("Dados de demonstração criados."))
  .finally(() => prisma.$disconnect());
