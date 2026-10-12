import type { FastifyReply, FastifyRequest } from "fastify";
import type { QueryService } from "../services/query.service.js";
import type { CommandService } from "../services/command.service.js";
import { historyQuerySchema, uuidParamsSchema } from "../schemas/http.schema.js";

export class LeakController {
  constructor(private readonly queryService: QueryService, private readonly commandService: CommandService) {}

  history = async (request: FastifyRequest, reply: FastifyReply) => {
    const query = historyQuerySchema.parse(request.query);
    return reply.send(await this.queryService.listLeaks(query.from, query.to, query.limit));
  };

  acknowledge = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = uuidParamsSchema.parse(request.params);
    const command = await this.commandService.requestSafetyReset(id);
    return reply.code(202).send(command);
  };
}
