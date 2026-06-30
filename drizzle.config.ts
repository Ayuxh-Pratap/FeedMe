import { config } from "dotenv"
import { defineConfig } from "drizzle-kit"

config({ path: ".env", override: true })
// config({ path: ".env.local", override: true })

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set. Add it to main/.env.local.")
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: databaseUrl,
  },
})
