import { defineConfig } from "@prisma/config";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.POSTGRES_PRISMA_URL,
    directUrl: process.env.POSTGRES_URL_NON_POOLING,
  },
});
