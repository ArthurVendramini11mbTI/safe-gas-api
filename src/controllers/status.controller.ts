import type { FastifyReply, FastifyRequest } from "fastify";
import type { QueryService } from "../services/query.service.js";
import { settingsBodySchema } from "../schemas/http.schema.js";

export class StatusController {
  constructor(private readonly queryService: QueryService) {}

  get = async (_request: FastifyRequest, reply: FastifyReply) => reply.send(await this.queryService.getStatus());

  getSettings = async (_request: FastifyRequest, reply: FastifyReply) => reply.send(await this.queryService.getSettings());

  updateSettings = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = settingsBodySchema.parse(request.body);
    return reply.send(await this.queryService.updateSettings(body));
  };
}
