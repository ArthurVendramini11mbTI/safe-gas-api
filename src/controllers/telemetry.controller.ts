import type { FastifyReply, FastifyRequest } from "fastify";
import type { QueryService } from "../services/query.service.js";
import { consumptionQuerySchema, historyQuerySchema } from "../schemas/http.schema.js";

export class TelemetryController {
  constructor(private readonly queryService: QueryService) {}

  current = async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(await this.queryService.getCurrentGas());
  };

  history = async (request: FastifyRequest, reply: FastifyReply) => {
    const query = historyQuerySchema.parse(request.query);
    return reply.send(await this.queryService.listTelemetry(query.from, query.to, query.limit, query.cylinderId));
  };

  consumption = async (request: FastifyRequest, reply: FastifyReply) => {
    const query = consumptionQuerySchema.parse(request.query);
    return reply.send(await this.queryService.consumption(query.range, query.cylinderId, query.scope));
  };
}
