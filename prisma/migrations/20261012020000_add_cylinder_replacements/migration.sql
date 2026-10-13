CREATE TYPE "ReplacementStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED');

CREATE TABLE "cylinder_replacements" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "status" "ReplacementStatus" NOT NULL DEFAULT 'PENDING',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "measuredWeightKg" DOUBLE PRECISION,
  "weightStable" BOOLEAN NOT NULL DEFAULT false,
  "lastReadingAt" TIMESTAMP(3),
  "initialGasKg" DOUBLE PRECISION,
  "computedTareKg" DOUBLE PRECISION,
  CONSTRAINT "cylinder_replacements_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "cylinder_replacements_status_idx" ON "cylinder_replacements"("status");
