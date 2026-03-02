import { defineConfig, env } from "@prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    // Uses the built-in env() function
    url: env("DATABASE_URL_UNPOOLED"),
  },
});
