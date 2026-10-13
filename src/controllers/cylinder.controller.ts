import type { FastifyReply, FastifyRequest } from "fastify";
import { replaceCylinderBodySchema } from "../schemas/http.schema.js";
import type { CylinderRepository } from "../repository/cylinder.repository.js";

export class CylinderController {
  constructor(private readonly repository: CylinderRepository) {}

  list = async (_request: FastifyRequest, reply: FastifyReply) => reply.send(await this.repository.list());
  active = async (_request: FastifyRequest, reply: FastifyReply) => reply.send(await this.repository.active());

  replace = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = replaceCylinderBodySchema.parse(request.body);
    return reply.code(201).send(await this.repository.replace(body.totalWeightKg, body.initialGasKg));
  };
}
