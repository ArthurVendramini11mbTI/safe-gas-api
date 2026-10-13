import type { FastifyReply, FastifyRequest } from "fastify";
import { replaceCylinderBodySchema } from "../schemas/http.schema.js";
import type { CylinderRepository } from "../repository/cylinder.repository.js";
import type { ReplacementRepository } from "../repository/replacement.repository.js";

export class CylinderController {
  constructor(private readonly repository: CylinderRepository, private readonly replacements: ReplacementRepository) {}

  list = async (_request: FastifyRequest, reply: FastifyReply) => reply.send(await this.repository.list());
  active = async (_request: FastifyRequest, reply: FastifyReply) => reply.send(await this.repository.active());

  replacement = async (_request: FastifyRequest, reply: FastifyReply) => reply.send(await this.replacements.getPending());
  startReplacement = async (_request: FastifyRequest, reply: FastifyReply) => reply.code(201).send(await this.replacements.start());
  cancelReplacement = async (_request: FastifyRequest, reply: FastifyReply) => reply.send(await this.replacements.cancel());

  confirmReplacement = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = replaceCylinderBodySchema.parse(request.body);
    return reply.code(201).send(await this.repository.replaceFromPending(body.initialGasKg, this.replacements));
  };
}
