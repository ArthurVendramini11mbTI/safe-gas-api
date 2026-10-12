import { config } from "../lib/config.js";
import type { SocketServer } from "../lib/socket.js";
import { StateRepository } from "../repository/state.repository.js";

export class ConnectivityService {
  constructor(private readonly stateRepository: StateRepository, private readonly io: SocketServer) {}

  async setOnline(online: boolean) {
    const state = await this.stateRepository.updateConnectivity(online);
    this.io.emit("device.connectivity", { online, lastSeenAt: state.lastSeenAt });
    return state;
  }

  async markOfflineIfStale() {
    const cutoff = new Date(Date.now() - config.DEVICE_OFFLINE_AFTER_MS);
    if (await this.stateRepository.markOfflineIfStale(cutoff)) {
      this.io.emit("device.connectivity", { online: false });
      return true;
    }
    return false;
  }
}
