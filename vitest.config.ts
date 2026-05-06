import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    env: {
      DATABASE_URL: "postgresql://test:test@localhost:5432/test",
      DATABASE_URL_UNPOOLED: "postgresql://test:test@localhost:5432/test",
      REDIS_URL: "redis://localhost:6379",
      THREADS_APP_ID: "test-app-id",
      THREADS_APP_SECRET: "test-app-secret",
      NEXT_PUBLIC_APP_URL: "https://example.com",
      NODE_ENV: "test",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
