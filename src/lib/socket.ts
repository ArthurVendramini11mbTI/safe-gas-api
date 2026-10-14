import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { config } from "./config.js";
import type { ServerToClientEvents } from "../types/socket-events.js";
import { AuthService } from "../services/auth.service.js";
import { UserRepository } from "../repository/user.repository.js";

export type SocketServer = Server<Record<string, never>, ServerToClientEvents>;

export function createSocketServer(server: HttpServer): SocketServer {
  const io = new Server(server, {
    cors: { origin: config.CORS_ORIGIN === "*" ? true : config.CORS_ORIGIN },
  });
  const auth = new AuthService(new UserRepository());
  io.use(async (socket, next) => {
    try {
      const token = typeof socket.handshake.auth?.token === "string" ? socket.handshake.auth.token : undefined;
      await auth.verify(token ? `Bearer ${token}` : undefined, true);
      next();
    } catch (error) {
      next(error instanceof Error ? error : new Error("Autenticação necessária"));
    }
  });
  return io;
}
