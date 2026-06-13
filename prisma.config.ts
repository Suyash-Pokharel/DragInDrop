import { config } from "dotenv";
import { defineConfig } from "@prisma/config";

// Load .env.local first (highest priority), then .env (fallback)
config({ path: ".env.local" });
config({ path: ".env" });

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    // process.env is used instead of env() so prisma generate works
    // even when the env var isn't set (e.g. during CI install phase)
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "",
  },
});
