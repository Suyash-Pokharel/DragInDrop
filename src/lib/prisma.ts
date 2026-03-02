import { PrismaClient } from "@prisma/client";

declare global {
  var __prismaClient: PrismaClient | undefined;
}

export function getPrisma(): PrismaClient {
  // Use a global variable to preserve the client across hot reloads in dev
  if (global.__prismaClient) return global.__prismaClient;

  const client = new PrismaClient();
  if (process.env.NODE_ENV !== "production") {
    global.__prismaClient = client;
  }
  return client;
}

// Note: call `getPrisma()` inside request handlers or functions to avoid
// creating a PrismaClient at module-evaluation time (helps with Edge/Turbopack).
