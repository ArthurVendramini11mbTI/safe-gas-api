import { prisma } from "../lib/prisma.js";

export class UserRepository {
  findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  }

  findById(id: number) {
    return prisma.user.findUnique({ where: { id } });
  }

  create(data: { name: string; email: string; password: string }) {
    return prisma.user.create({ data });
  }
}
