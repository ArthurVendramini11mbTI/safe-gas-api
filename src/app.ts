import Fastify from "fastify";
import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { ZodError } from "zod";
import { config } from "./lib/config.js";
import { AppError } from "./lib/errors.js";
import { prisma } from "./lib/prisma.js";
import { createSocketServer } from "./lib/socket.js";
import { MqttGateway } from "./lib/mqtt.js";
import { CommandRepository } from "./repository/command.repository.js";
import { CylinderRepository } from "./repository/cylinder.repository.js";
import { ReplacementRepository } from "./repository/replacement.repository.js";
import { LeakRepository } from "./repository/leak.repository.js";
import { SettingsRepository } from "./repository/settings.repository.js";
import { StateRepository } from "./repository/state.repository.js";
import { TelemetryRepository } from "./repository/telemetry.repository.js";
import { CommandService } from "./services/command.service.js";
import { ConnectivityService } from "./services/connectivity.service.js";
import { QueryService } from "./services/query.service.js";
import { TelemetryService } from "./services/telemetry.service.js";
import { SimulationService } from "./services/simulation.service.js";
import { LeakController } from "./controllers/leak.controller.js";
import { StatusController } from "./controllers/status.controller.js";
import { TelemetryController } from "./controllers/telemetry.controller.js";
import { ValveController } from "./controllers/valve.controller.js";
import { SimulationController } from "./controllers/simulation.controller.js";
import { CylinderController } from "./controllers/cylinder.controller.js";
import { apiRoutes } from "./routes/api.routes.js";

export async function buildApp() {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: config.CORS_ORIGIN === "*" ? true : config.CORS_ORIGIN });
  await app.register(swagger, { openapi: { info: { title: "Safe Gas API", version: "1.0.0" } } });
  await app.register(swaggerUi, { routePrefix: "/docs" });

  const io = createSocketServer(app.server);
  const mqttGateway = new MqttGateway();
  const settingsRepository = new SettingsRepository();
  const stateRepository = new StateRepository();
  const telemetryRepository = new TelemetryRepository();
  const leakRepository = new LeakRepository();
  const commandRepository = new CommandRepository();
  const cylinderRepository = new CylinderRepository();
  const replacementRepository = new ReplacementRepository();

  const telemetryService = new TelemetryService(settingsRepository, stateRepository, telemetryRepository, leakRepository, io, cylinderRepository, replacementRepository);
  const commandService = new CommandService(commandRepository, stateRepository, leakRepository, mqttGateway, io, cylinderRepository, replacementRepository);
  const connectivityService = new ConnectivityService(stateRepository, io);
  const simulationService = new SimulationService(
    settingsRepository,
    stateRepository,
    telemetryRepository,
    leakRepository,
    commandRepository,
    telemetryService,
    io,
    cylinderRepository,
  );
  commandService.setSimulationStatusProvider(() => simulationService.getStatus().active);
  const queryService = new QueryService(
    settingsRepository,
    stateRepository,
    telemetryRepository,
    leakRepository,
    commandRepository,
    () => simulationService.getStatus(),
    cylinderRepository,
  );

  mqttGateway.setHandlers({
    telemetry: (input) => telemetryService.process(input),
    commandAck: (input) => commandService.handleAck(input),
    connectivity: (online) => connectivityService.setOnline(online),
  });

  const controllers = {
    status: new StatusController(queryService),
    telemetry: new TelemetryController(queryService),
    leak: new LeakController(queryService, commandService),
    valve: new ValveController(commandService, queryService),
    simulation: new SimulationController(simulationService),
    cylinder: new CylinderController(cylinderRepository, replacementRepository),
  };

  app.get("/health", async (_request, reply) => {
    await prisma.$queryRaw`SELECT 1`;
    return reply.send({ status: "ok", database: "connected", mqtt: mqttGateway.isConnected() });
  });
  await app.register(async (instance) => apiRoutes(instance, controllers), { prefix: "/api" });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) return reply.code(400).send({ code: "VALIDATION_ERROR", issues: error.issues });
    if (error instanceof AppError) return reply.code(error.statusCode).send({ code: error.code, message: error.message });
    app.log.error(error);
    return reply.code(500).send({ code: "INTERNAL_ERROR", message: "Erro interno do servidor" });
  });

  const maintenanceTimer = setInterval(() => {
    void commandService.expireCommands();
    void connectivityService.markOfflineIfStale();
  }, 1000);
  maintenanceTimer.unref();

  app.addHook("onReady", async () => {
    await prisma.$connect();
    mqttGateway.start();
  });
  app.addHook("onClose", async () => {
    clearInterval(maintenanceTimer);
    await simulationService.stop();
    io.close();
    await mqttGateway.stop();
    await prisma.$disconnect();
  });
  return app;
}
