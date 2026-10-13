import type { FastifyInstance } from "fastify";
import type { LeakController } from "../controllers/leak.controller.js";
import type { StatusController } from "../controllers/status.controller.js";
import type { TelemetryController } from "../controllers/telemetry.controller.js";
import type { ValveController } from "../controllers/valve.controller.js";
import type { CylinderController } from "../controllers/cylinder.controller.js";

interface Controllers {
  status: StatusController;
  telemetry: TelemetryController;
  leak: LeakController;
  valve: ValveController;
  cylinder: CylinderController;
}

export async function apiRoutes(app: FastifyInstance, controllers: Controllers) {
  app.get("/status", { schema: { tags: ["Sistema"], summary: "Situação atual da central" } }, controllers.status.get);
  app.get("/settings", { schema: { tags: ["Sistema"], summary: "Configuração da balança" } }, controllers.status.getSettings);
  app.put("/settings", { schema: { tags: ["Sistema"], summary: "Atualiza tara e capacidade" } }, controllers.status.updateSettings);

  app.get("/gas/current", { schema: { tags: ["Gás"], summary: "Quantidade atual de gás" } }, controllers.telemetry.current);
  app.get("/gas/history", { schema: { tags: ["Gás"], summary: "Histórico de telemetria" } }, controllers.telemetry.history);
  app.get("/gas/consumption", { schema: { tags: ["Gás"], summary: "Consumo diário, semanal ou mensal" } }, controllers.telemetry.consumption);

  app.get("/leaks", { schema: { tags: ["Vazamentos"], summary: "Histórico de vazamentos" } }, controllers.leak.history);
  app.post("/leaks/:id/acknowledge", { schema: { tags: ["Vazamentos"], summary: "Reconhece um alerta encerrado" } }, controllers.leak.acknowledge);

  app.post("/valve/commands", { schema: { tags: ["Válvula"], summary: "Solicita abertura ou fechamento" } }, controllers.valve.command);
  app.get("/valve/commands", { schema: { tags: ["Válvula"], summary: "Histórico de comandos" } }, controllers.valve.history);

  app.get("/cylinders", { schema: { tags: ["Botijões"], summary: "Lista os ciclos de botijão" } }, controllers.cylinder.list);
  app.get("/cylinders/active", { schema: { tags: ["Botijões"], summary: "Consulta o botijão ativo" } }, controllers.cylinder.active);
  app.get("/cylinders/replacement", { schema: { tags: ["Botijões"], summary: "Consulta a troca em andamento" } }, controllers.cylinder.replacement);
  app.post("/cylinders/replacement/start", { schema: { tags: ["Botijões"], summary: "Inicia uma troca" } }, controllers.cylinder.startReplacement);
  app.post("/cylinders/replacement/cancel", { schema: { tags: ["Botijões"], summary: "Cancela uma troca" } }, controllers.cylinder.cancelReplacement);
  app.post("/cylinders/replacement/confirm", { schema: { tags: ["Botijões"], summary: "Confirma a troca do botijão" } }, controllers.cylinder.confirmReplacement);
}
