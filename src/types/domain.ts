export type ValveState = "OPEN" | "CLOSED" | "UNKNOWN";
export type ValveAction = "OPEN" | "CLOSE" | "RESET_SAFETY";
export type CommandStatus = "PENDING" | "APPLIED" | "REJECTED" | "FAILED" | "EXPIRED";

export interface GasSettings {
  tareKg: number;
  capacityKg: number;
  initialGasKg?: number | null;
  cylinderId?: number;
  cylinderNumber?: number;
  initialWeightKg?: number | null;
  installedAt?: Date | string;
  noiseToleranceKg: number;
  refillThresholdKg: number;
}

export type GasSettingsUpdate = Pick<GasSettings, "noiseToleranceKg" | "refillThresholdKg">;

export interface GasReading {
  receivedAt: Date;
  gasKg: number;
}

export interface ConsumptionBucket {
  start: string;
  consumptionKg: number;
}

export interface CommandMessage {
  schemaVersion: 1;
  deviceId: string;
  commandId: string;
  type: "valve.set" | "safety.reset";
  desiredState?: "OPEN" | "CLOSED";
}
