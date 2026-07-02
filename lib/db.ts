import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Prisma 7 connects through a driver adapter (node-postgres) instead of a
// bundled query engine. The DATABASE_URL may be a standard TCP URL (local dev)
// or a Cloud SQL unix-socket URL of the form:
//   postgresql://USER:PASS@localhost/DB?host=/cloudsql/PROJECT:REGION:INSTANCE
//
// Reuse a single client across hot-reloads (dev) and requests (prod) so we don't
// exhaust the Cloud SQL connection pool.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
