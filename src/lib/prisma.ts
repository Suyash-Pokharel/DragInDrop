import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

declare global {
  var __prismaClient: PrismaClient | undefined;
}

export function getPrisma(): PrismaClient {
  // Use a global variable to preserve the client across hot reloads in dev
  if (global.__prismaClient) return global.__prismaClient;

  // Use the unpooled connection for better serverless compatibility
  const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  
  if (!connectionString) {
    throw new Error("DATABASE_URL_UNPOOLED or DATABASE_URL must be set");
  }

  // PrismaNeon takes a config object, not a Pool instance
  const adapter = new PrismaNeon({
    connectionString: connectionString,
  });
  
  const client = new PrismaClient({ adapter });
  
  if (process.env.NODE_ENV !== "production") {
    global.__prismaClient = client;
  }
  
  return client;
}
