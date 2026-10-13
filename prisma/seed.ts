import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL do Supabase não foi configurada");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  await prisma.systemSettings.upsert({
    where: { id: 1 },
    create: { id: 1 },
    update: {},
  });
  await prisma.telemetryReading.deleteMany();
  await prisma.valveCommand.deleteMany();
  await prisma.leakEvent.deleteMany();
  await prisma.cylinderReplacement.deleteMany();

  const now = Date.now();
  const cylinders = [];
  for (let number = 1; number <= 3; number += 1) {
    const installedAt = new Date(now - (4 - number) * 30 * 24 * 60 * 60 * 1000);
    const removedAt = number < 3 ? new Date(installedAt.getTime() + 30 * 24 * 60 * 60 * 1000) : null;
    const cylinder = await prisma.gasCylinder.upsert({
      where: { number },
      create: { number, installedAt, removedAt, tareKg: 0.5, capacityKg: 3, initialGasKg: 3, initialWeightKg: 3.5 },
      update: { installedAt, removedAt, tareKg: 0.5, capacityKg: 3, initialGasKg: 3, initialWeightKg: 3.5, finalWeightKg: removedAt ? 0.5 : null },
    });
    cylinders.push(cylinder);
  }

  const activeCylinder = cylinders[2]!;
  await prisma.systemState.upsert({
    where: { id: 1 },
    create: { id: 1, deviceId: "esp1", valveState: "CLOSED", activeCylinderId: activeCylinder.id, totalWeightKg: 0.6, gasKg: 0.1, gasPercentage: 3.33, esp2Online: true },
    update: { activeCylinderId: activeCylinder.id, totalWeightKg: 0.6, gasKg: 0.1, gasPercentage: 3.33 },
  });
  await prisma.gasCylinder.deleteMany({ where: { number: { notIn: [1, 2, 3] } } });

  const samples = cylinders.flatMap((cylinder, cylinderIndex) => Array.from({ length: 31 }, (_, day) => {
    const gasKg = Number(Math.max(0.1, 3 - (day / 30) * 2.9).toFixed(3));
    const receivedAt = new Date(cylinder.installedAt.getTime() + day * 24 * 60 * 60 * 1000);
    return {
      deviceId: "esp1",
      receivedAt,
      totalWeightKg: Number((0.5 + gasKg).toFixed(3)),
      gasKg,
      gasPercentage: Number(((gasKg / 3) * 100).toFixed(2)),
      mq2Raw: 170 + ((day + cylinderIndex) % 4) * 3,
      leakActive: false,
      valveState: "CLOSED" as const,
      esp2Online: true,
      cylinderId: cylinder.id,
    };
  }));
  await prisma.telemetryReading.createMany({ data: samples });
}

main()
  .then(() => console.info("Dados de demonstração criados."))
  .finally(() => prisma.$disconnect());
