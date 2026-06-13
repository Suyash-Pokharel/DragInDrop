import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

declare global {
  var __prismaClient: PrismaClient | undefined;
}

export function getPrisma(): PrismaClient {
  if (global.__prismaClient) return global.__prismaClient;

  // Use the unpooled connection for better serverless compatibility
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL must be set");
  }

  const adapter = new PrismaPg({ connectionString });

  const client = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

  if (process.env.NODE_ENV !== "production") {
    global.__prismaClient = client;
  }

  return client;
}