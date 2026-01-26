import { defineConfig } from "drizzle-kit";
import { homedir } from "node:os";
import { join } from "node:path";

// Same path as app/db/index.server.ts
const DB_PATH = join(homedir(), ".claude", "cc-viz", "kanban.db");

export default defineConfig({
  schema: "./app/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: DB_PATH,
  },
});
