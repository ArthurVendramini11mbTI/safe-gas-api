import type { CommandMessage } from "./domain.js";

export interface CommandPublisher {
  isConnected(): boolean;
  publishCommand(message: CommandMessage): Promise<void>;
}
