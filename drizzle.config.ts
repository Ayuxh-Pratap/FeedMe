import { config } from "dotenv"
import { defineConfig } from "drizzle-kit"

config({ path: [".env.local", ".env"] })

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set. Add it to .env.local or .env.")
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: databaseUrl,
  },
})
