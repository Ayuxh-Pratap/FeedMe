import "dotenv/config"
import { neon } from "@neondatabase/serverless"

// Wipes every row from the FeedMe app tables and resets identity sequences,
// leaving the schema intact. Run with:  node scripts/reset-db.mjs --yes
const APP_TABLES = [
  "report_status_events",
  "report_comments",
  "report_assets",
  "reports",
  "workspace_invites",
  "workspace_domains",
  "workspace_memberships",
  "workspaces",
  "sessions",
  "user_profiles",
  "users",
]

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  console.error("DATABASE_URL is not set. Add it to main/.env before resetting.")
  process.exit(1)
}

if (!process.argv.includes("--yes")) {
  console.error(
    "This permanently deletes ALL data (users, workspaces, reports, sessions).\n" +
      "Re-run with --yes to confirm:  node scripts/reset-db.mjs --yes"
  )
  process.exit(1)
}

const sql = neon(databaseUrl)
const tableList = APP_TABLES.join(", ")

await sql.query(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`)

console.log(`Cleared ${APP_TABLES.length} tables. Database is fresh.`)
