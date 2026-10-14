import type { FastifyReply, FastifyRequest } from "fastify";
import { loginSchema, signupSchema } from "../schemas/auth.schema.js";
import { AuthService } from "../services/auth.service.js";

export class AuthController {
  constructor(private readonly auth: AuthService) {}

  signup = async (request: FastifyRequest, reply: FastifyReply) => {
    const input = signupSchema.parse(request.body);
    return reply.code(201).send(await this.auth.signup(input));
  };

  login = async (request: FastifyRequest, reply: FastifyReply) => {
    const input = loginSchema.parse(request.body);
    return reply.send(await this.auth.login(input.email, input.password));
  };

  me = async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({ user: await this.auth.verify(request.headers.authorization) });
  };
}
