-- Reconciliacao para bancos que marcaram add_cylinder_cycles como aplicada
-- antes dos campos individuais do botijao serem incluidos.
ALTER TABLE "gas_cylinders"
  ADD COLUMN IF NOT EXISTS "initialGasKg" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "tareKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "capacityKg" DOUBLE PRECISION NOT NULL DEFAULT 13;
