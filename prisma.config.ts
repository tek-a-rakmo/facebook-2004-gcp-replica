import "dotenv/config";
import path from "node:path";
import { defineConfig, env } from "prisma/config";

// Prisma 7 moves the datasource connection URL out of schema.prisma and into
// this config file. It is used by migration/introspection CLI commands
// (`prisma migrate`, `prisma db`). The runtime client connects via a driver
// adapter instead — see lib/db.ts.
export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  datasource: {
    url: env("DATABASE_URL"),
  },
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
