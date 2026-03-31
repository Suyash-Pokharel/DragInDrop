import { defineConfig } from "@prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    // Pooled connection for runtime queries (via Neon PgBouncer)
    url: process.env.DATABASE_URL ?? process.env.DATABASE_URL_UNPOOLED ?? "",
    // Direct (unpooled) connection for schema migrations only
    directUrl: process.env.DATABASE_URL_UNPOOLED ?? "",
  },
});
