import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

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

  // Parse the URL to adjust sslmode
  const url = new URL(connectionString);
  url.searchParams.set('sslmode', 'no-verify');

  const pool = new Pool({ 
    connectionString: url.toString()
  });
  
  const adapter = new PrismaPg(pool);

  const client = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

  if (process.env.NODE_ENV !== "production") {
    global.__prismaClient = client;
  }

  return client;
}