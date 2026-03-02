import { PrismaClient } from "@prisma/client";

// Prevent multiple instances of Prisma Client in development
const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  // Rely on `DATABASE_URL` from the environment for the runtime datasource.
  // The Prisma client accepts datasource URLs via environment variables,
  // passing `datasourceUrl` directly is not a known/typed option.
  new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
