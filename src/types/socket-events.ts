export interface ServerToClientEvents {
  "telemetry.updated": (payload: unknown) => void;
  "valve.updated": (payload: unknown) => void;
  "leak.started": (payload: unknown) => void;
  "leak.cleared": (payload: unknown) => void;
  "leak.acknowledged": (payload: unknown) => void;
  "command.updated": (payload: unknown) => void;
  "device.connectivity": (payload: unknown) => void;
}
