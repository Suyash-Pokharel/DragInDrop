import { defineConfig } from "@prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    // process.env is used instead of env() so prisma generate works
    // even when the env var isn't set (e.g. during CI install phase)
    url: process.env.DATABASE_URL_UNPOOLED ?? "",
  },
});
