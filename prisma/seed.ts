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
  const profiles = [
    { tareKg: 0.5, initialGasKg: 3, dailyUseKg: 0.07 },
    { tareKg: 0.6, initialGasKg: 4, dailyUseKg: 0.1 },
    { tareKg: 0.7, initialGasKg: 5, dailyUseKg: 0.13 },
  ];
  const cylinders: Array<{ id: number; installedAt: Date }> = [];
  for (let number = 1; number <= 3; number += 1) {
    const profile = profiles[number - 1]!;
    const installedAt = new Date(now - (4 - number) * 30 * 24 * 60 * 60 * 1000);
    const removedAt = number < 3 ? new Date(installedAt.getTime() + 30 * 24 * 60 * 60 * 1000) : null;
    const cylinder = await prisma.gasCylinder.upsert({
      where: { number },
      create: { number, installedAt, removedAt, tareKg: profile.tareKg, capacityKg: profile.initialGasKg, initialGasKg: profile.initialGasKg, initialWeightKg: profile.tareKg + profile.initialGasKg },
      update: { installedAt, removedAt, tareKg: profile.tareKg, capacityKg: profile.initialGasKg, initialGasKg: profile.initialGasKg, initialWeightKg: profile.tareKg + profile.initialGasKg, finalWeightKg: removedAt ? profile.tareKg : null },
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

  const samples = cylinders.flatMap((cylinder, cylinderIndex) => Array.from({ length: cylinderIndex === 2 ? 30 : 31 }, (_, day) => {
    const profile = profiles[cylinderIndex]!;
    const variation = 1 + (((day + cylinderIndex * 2) % 5) - 2) * 0.08;
    const gasKg = Number(Math.max(0.1, profile.initialGasKg - day * profile.dailyUseKg * variation).toFixed(3));
    const receivedAt = new Date(cylinder.installedAt.getTime() + day * 24 * 60 * 60 * 1000);
    return {
      deviceId: "esp1",
      receivedAt,
      totalWeightKg: Number((profile.tareKg + gasKg).toFixed(3)),
      gasKg,
      gasPercentage: Number(((gasKg / profile.initialGasKg) * 100).toFixed(2)),
      mq2Raw: 170 + ((day + cylinderIndex) % 4) * 3,
      leakActive: false,
      valveState: "CLOSED" as const,
      esp2Online: true,
      cylinderId: cylinder.id,
    };
  }));
  const activeProfile = profiles[2]!;
  const lastDailyGas = Number(Math.max(0.1, activeProfile.initialGasKg - 29 * activeProfile.dailyUseKg * (1 + (((29 + 4) % 5) - 2) * 0.08)).toFixed(3));
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const todaySamples = Array.from({ length: 24 }, (_, hour) => {
    const gasKg = Number(Math.max(0.1, lastDailyGas - hour * 0.012).toFixed(3));
    return {
      deviceId: "esp1",
      receivedAt: new Date(todayStart.getTime() + hour * 60 * 60 * 1000),
      totalWeightKg: Number((activeProfile.tareKg + gasKg).toFixed(3)),
      gasKg,
      gasPercentage: Number(((gasKg / activeProfile.initialGasKg) * 100).toFixed(2)),
      mq2Raw: 175 + (hour % 4) * 3,
      leakActive: false,
      valveState: "CLOSED" as const,
      esp2Online: true,
      cylinderId: cylinders[2]!.id,
    };
  });
  samples.push(...todaySamples);
  await prisma.telemetryReading.createMany({ data: samples });
}

main()
  .then(() => console.info("Dados de demonstração criados."))
  .finally(() => prisma.$disconnect());
