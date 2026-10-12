import type { FastifyReply, FastifyRequest } from "fastify";
import type { CommandService } from "../services/command.service.js";
import type { QueryService } from "../services/query.service.js";
import { valveCommandBodySchema } from "../schemas/http.schema.js";

export class ValveController {
  constructor(private readonly commandService: CommandService, private readonly queryService: QueryService) {}

  command = async (request: FastifyRequest, reply: FastifyReply) => {
    const { action } = valveCommandBodySchema.parse(request.body);
    return reply.code(202).send(await this.commandService.requestValve(action));
  };

  history = async (request: FastifyRequest, reply: FastifyReply) => {
    const { limit } = request.query as { limit?: string };
    const parsedLimit = Math.min(500, Math.max(1, Number(limit ?? 100) || 100));
    return reply.send(await this.queryService.listCommands(parsedLimit));
  };
}
