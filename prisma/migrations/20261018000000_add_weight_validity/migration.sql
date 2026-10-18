CREATE TYPE "WeightStatus" AS ENUM ('LEGACY', 'VALID', 'UNCALIBRATED', 'UNAVAILABLE', 'INVALID');

ALTER TABLE "system_state"
  ADD COLUMN "weightStatus" "WeightStatus" NOT NULL DEFAULT 'LEGACY',
  ADD COLUMN "weightBootId" TEXT,
  ADD COLUMN "weightSampleSequence" INTEGER,
  ADD COLUMN "weightMeasuredAt" TIMESTAMP(3),
  ADD COLUMN "cylinderPresent" BOOLEAN;

ALTER TABLE "telemetry_readings"
  ALTER COLUMN "totalWeightKg" DROP NOT NULL,
  ALTER COLUMN "gasKg" DROP NOT NULL,
  ALTER COLUMN "gasPercentage" DROP NOT NULL,
  ADD COLUMN "weightStatus" "WeightStatus" NOT NULL DEFAULT 'LEGACY',
  ADD COLUMN "weightBootId" TEXT,
  ADD COLUMN "weightSampleSequence" INTEGER,
  ADD COLUMN "cylinderPresent" BOOLEAN;

-- Leituras históricas já possuem peso e gás calculados; preserve-as nos
-- gráficos. A restrição para firmware v1 vale para novas mensagens recebidas.
UPDATE "telemetry_readings"
SET "weightStatus" = 'VALID',
    "weightBootId" = 'MIGRATED',
    "cylinderPresent" = true
WHERE "totalWeightKg" IS NOT NULL AND "gasKg" IS NOT NULL;

ALTER TABLE "cylinder_replacements"
  ADD COLUMN "baselineBootId" TEXT,
  ADD COLUMN "baselineSampleSequence" INTEGER,
  ADD COLUMN "measurementBootId" TEXT,
  ADD COLUMN "measurementSampleSequence" INTEGER;

WITH pending_rank AS (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "startedAt" DESC) AS position
  FROM "cylinder_replacements"
  WHERE "status" = 'PENDING'
)
UPDATE "cylinder_replacements"
SET "status" = 'CANCELLED', "cancelledAt" = CURRENT_TIMESTAMP
WHERE "id" IN (SELECT "id" FROM pending_rank WHERE position > 1);

CREATE UNIQUE INDEX "cylinder_replacements_single_pending_idx"
  ON "cylinder_replacements" ((1))
  WHERE "status" = 'PENDING';
