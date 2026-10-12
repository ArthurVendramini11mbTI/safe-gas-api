CREATE TYPE "ValveState" AS ENUM ('OPEN', 'CLOSED', 'UNKNOWN');
CREATE TYPE "ValveAction" AS ENUM ('OPEN', 'CLOSE', 'RESET_SAFETY');
CREATE TYPE "CommandStatus" AS ENUM ('PENDING', 'APPLIED', 'REJECTED', 'FAILED', 'EXPIRED');

CREATE TABLE "system_settings" (
  "id" INTEGER NOT NULL DEFAULT 1,
  "tareKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "capacityKg" DOUBLE PRECISION NOT NULL DEFAULT 13,
  "noiseToleranceKg" DOUBLE PRECISION NOT NULL DEFAULT 0.05,
  "refillThresholdKg" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "system_state" (
  "id" INTEGER NOT NULL DEFAULT 1,
  "deviceId" TEXT NOT NULL DEFAULT 'esp1',
  "deviceOnline" BOOLEAN NOT NULL DEFAULT false,
  "esp2Online" BOOLEAN NOT NULL DEFAULT false,
  "lastSeenAt" TIMESTAMP(3),
  "valveState" "ValveState" NOT NULL DEFAULT 'UNKNOWN',
  "leakActive" BOOLEAN NOT NULL DEFAULT false,
  "mq2Raw" INTEGER,
  "totalWeightKg" DOUBLE PRECISION,
  "gasKg" DOUBLE PRECISION,
  "gasPercentage" DOUBLE PRECISION,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "system_state_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "telemetry_readings" (
  "id" BIGSERIAL NOT NULL,
  "deviceId" TEXT NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "totalWeightKg" DOUBLE PRECISION NOT NULL,
  "gasKg" DOUBLE PRECISION NOT NULL,
  "gasPercentage" DOUBLE PRECISION NOT NULL,
  "mq2Raw" INTEGER NOT NULL,
  "leakActive" BOOLEAN NOT NULL,
  "valveState" "ValveState" NOT NULL,
  "esp2Online" BOOLEAN NOT NULL,
  CONSTRAINT "telemetry_readings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "leak_events" (
  "id" UUID NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  "acknowledgedAt" TIMESTAMP(3),
  "peakMq2Raw" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "leak_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "valve_commands" (
  "id" UUID NOT NULL,
  "action" "ValveAction" NOT NULL,
  "status" "CommandStatus" NOT NULL DEFAULT 'PENDING',
  "reason" TEXT,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "reportedValveState" "ValveState",
  "leakEventId" UUID,
  CONSTRAINT "valve_commands_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "telemetry_readings_receivedAt_idx" ON "telemetry_readings"("receivedAt");
CREATE INDEX "leak_events_startedAt_idx" ON "leak_events"("startedAt");
CREATE INDEX "valve_commands_requestedAt_idx" ON "valve_commands"("requestedAt");
CREATE INDEX "valve_commands_status_idx" ON "valve_commands"("status");
ALTER TABLE "valve_commands" ADD CONSTRAINT "valve_commands_leakEventId_fkey" FOREIGN KEY ("leakEventId") REFERENCES "leak_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "system_settings" ("id", "updatedAt") VALUES (1, CURRENT_TIMESTAMP);
INSERT INTO "system_state" ("id", "updatedAt") VALUES (1, CURRENT_TIMESTAMP);
