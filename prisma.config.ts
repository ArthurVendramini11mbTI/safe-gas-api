import "dotenv/config";
import { defineConfig } from "prisma/config";

const datasourceUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!datasourceUrl) {
  throw new Error("Configure DIRECT_URL ou DATABASE_URL com a conexão do Supabase");
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations", seed: "tsx prisma/seed.ts" },
  datasource: {
    // Migrations usam a conexão direta/session pooler. A aplicação usa o pooler
    // definido em DATABASE_URL por meio do adapter-pg.
    url: datasourceUrl,
  },
});
