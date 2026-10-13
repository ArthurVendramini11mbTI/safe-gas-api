CREATE TABLE "gas_cylinders" (
  "id" SERIAL NOT NULL,
  "number" INTEGER NOT NULL,
  "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "removedAt" TIMESTAMP(3),
  "initialWeightKg" DOUBLE PRECISION,
  "initialGasKg" DOUBLE PRECISION,
  "tareKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "capacityKg" DOUBLE PRECISION NOT NULL DEFAULT 13,
  "finalWeightKg" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "gas_cylinders_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "gas_cylinders_number_key" ON "gas_cylinders"("number");
INSERT INTO "gas_cylinders" ("id", "number", "tareKg", "capacityKg")
SELECT 1, 1, COALESCE("tareKg", 0), COALESCE("capacityKg", 13) FROM "system_settings" WHERE "id" = 1;
INSERT INTO "gas_cylinders" ("id", "number") SELECT 1, 1 WHERE NOT EXISTS (SELECT 1 FROM "gas_cylinders" WHERE "id" = 1);
ALTER SEQUENCE "gas_cylinders_id_seq" RESTART WITH 2;

ALTER TABLE "system_state" ADD COLUMN "activeCylinderId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "telemetry_readings" ADD COLUMN "cylinderId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "leak_events" ADD COLUMN "cylinderId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "valve_commands" ADD COLUMN "cylinderId" INTEGER NOT NULL DEFAULT 1;

CREATE INDEX "telemetry_readings_cylinderId_receivedAt_idx" ON "telemetry_readings"("cylinderId", "receivedAt");
CREATE INDEX "leak_events_cylinderId_startedAt_idx" ON "leak_events"("cylinderId", "startedAt");
CREATE INDEX "valve_commands_cylinderId_requestedAt_idx" ON "valve_commands"("cylinderId", "requestedAt");
ALTER TABLE "system_state" ADD CONSTRAINT "system_state_activeCylinderId_fkey" FOREIGN KEY ("activeCylinderId") REFERENCES "gas_cylinders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "telemetry_readings" ADD CONSTRAINT "telemetry_readings_cylinderId_fkey" FOREIGN KEY ("cylinderId") REFERENCES "gas_cylinders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "leak_events" ADD CONSTRAINT "leak_events_cylinderId_fkey" FOREIGN KEY ("cylinderId") REFERENCES "gas_cylinders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "valve_commands" ADD CONSTRAINT "valve_commands_cylinderId_fkey" FOREIGN KEY ("cylinderId") REFERENCES "gas_cylinders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
