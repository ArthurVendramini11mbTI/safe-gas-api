import { SignJWT, jwtVerify } from "jose";
import { AppError } from "../lib/errors.js";
import { config } from "../lib/config.js";
import { UserRepository } from "../repository/user.repository.js";

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  canAccessPanel: boolean;
}

export class AuthService {
  private readonly secret = new TextEncoder().encode(config.JWT_SECRET);

  constructor(private readonly users: UserRepository) {}

  private publicUser(user: { id: number; name: string; email: string }): AuthUser {
    return { id: user.id, name: user.name, email: user.email, canAccessPanel: user.email === config.PANEL_ALLOWED_EMAIL };
  }

  private async token(user: AuthUser) {
    return new SignJWT({ name: user.name, email: user.email, canAccessPanel: user.canAccessPanel })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setSubject(String(user.id))
      .setIssuedAt()
      .setExpirationTime("24h")
      .sign(this.secret);
  }

  async signup(input: { name: string; email: string; password: string }) {
    const email = input.email.trim().toLowerCase();
    if (await this.users.findByEmail(email)) throw new AppError("Este e-mail já está cadastrado.", 409, "EMAIL_ALREADY_EXISTS");
    const user = this.publicUser(await this.users.create({ ...input, email }));
    return { token: await this.token(user), user };
  }

  async login(emailInput: string, password: string) {
    const email = emailInput.trim().toLowerCase();
    const user = await this.users.findByEmail(email);
    if (!user || user.password !== password) throw new AppError("E-mail ou senha inválidos.", 401, "INVALID_CREDENTIALS");
    const publicUser = this.publicUser(user);
    return { token: await this.token(publicUser), user: publicUser };
  }

  async verify(authorization: string | undefined, panelOnly = false) {
    if (!authorization?.startsWith("Bearer ")) throw new AppError("Autenticação necessária.", 401, "AUTH_REQUIRED");
    try {
      const { payload } = await jwtVerify(authorization.slice(7), this.secret);
      const id = Number(payload.sub);
      if (!Number.isInteger(id)) throw new Error("subject inválido");
      const user = await this.users.findById(id);
      if (!user) throw new Error("usuário inexistente");
      const publicUser = this.publicUser(user);
      if (panelOnly && !publicUser.canAccessPanel) throw new AppError("Este usuário não tem acesso ao painel.", 403, "PANEL_ACCESS_DENIED");
      return publicUser;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("Token inválido ou expirado.", 401, "INVALID_TOKEN");
    }
  }
}
