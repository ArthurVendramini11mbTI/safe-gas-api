import type { FastifyReply, FastifyRequest } from "fastify";
import { simulationStartSchema, simulationStateSchema } from "../schemas/simulation.schema.js";
import type { SimulationService } from "../services/simulation.service.js";

export class SimulationController {
  constructor(private readonly service: SimulationService) {}

  status = async (_request: FastifyRequest, reply: FastifyReply) => reply.send(this.service.getStatus());

  start = async (request: FastifyRequest, reply: FastifyReply) => {
    const { days } = simulationStartSchema.parse(request.body ?? {});
    return reply.send(await this.service.start(days));
  };

  stop = async (_request: FastifyRequest, reply: FastifyReply) => reply.send(await this.service.stop());

  updateState = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = simulationStateSchema.parse(request.body);
    return reply.send(await this.service.updateState(body));
  };
}
