import type { FastifyReply, FastifyRequest } from "fastify";
import type { QueryService } from "../services/query.service.js";

export class StatusController {
  constructor(private readonly queryService: QueryService) {}

  get = async (_request: FastifyRequest, reply: FastifyReply) => reply.send(await this.queryService.getStatus());

  getSettings = async (_request: FastifyRequest, reply: FastifyReply) => reply.send(await this.queryService.getSettings());

}
