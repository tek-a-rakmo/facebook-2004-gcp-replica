import "dotenv/config";
import path from "node:path";
import { defineConfig } from "prisma/config";

// Prisma 7 moves the datasource connection URL out of schema.prisma and into
// this config file. It is used by migration/introspection CLI commands
// (`prisma migrate`, `prisma db`). The runtime client connects via a driver
// adapter instead — see lib/db.ts.
export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  // Read directly from the environment (not prisma/config's `env()` helper,
  // which throws when the var is absent). It's undefined during `prisma
  // generate` in the image build — fine, generate doesn't connect — and set
  // by the migrate Job / local .env when migrations actually run.
  datasource: {
    url: process.env.DATABASE_URL,
  },
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
