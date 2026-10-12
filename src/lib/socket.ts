import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { config } from "./config.js";
import type { ServerToClientEvents } from "../types/socket-events.js";

export type SocketServer = Server<Record<string, never>, ServerToClientEvents>;

export function createSocketServer(server: HttpServer): SocketServer {
  return new Server(server, {
    cors: { origin: config.CORS_ORIGIN === "*" ? true : config.CORS_ORIGIN },
  });
}
