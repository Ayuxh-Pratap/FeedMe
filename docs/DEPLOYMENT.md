# Deployment Guide

FeedMe runs as a Next.js Node.js application backed by PostgreSQL. Vercel is the reference host, but any platform that supports the Next.js Node runtime and scheduled authenticated HTTP requests can run it.

## 1. Provision Dependencies

- PostgreSQL, such as Neon, Supabase, or managed Postgres
- Cloudinary for screenshot evidence
- Resend only when `AUTH_MODE=verified`
- A scheduler for the internal outbox worker

## 2. Configure Variables

Always set:

```dotenv
DATABASE_URL=
NEXT_PUBLIC_SITE_URL=https://your-feedme.example
NEXT_PUBLIC_ENABLE_AGENTATION=false
AUTH_MODE=demo
INTERNAL_OPERATIONS_SECRET=
```

For screenshot capture:

```dotenv
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
CLOUDINARY_UPLOAD_FOLDER=feedme/reports
```

For verified authentication:

```dotenv
AUTH_MODE=verified
RESEND_API_KEY=
AUTH_EMAIL_FROM="FeedMe <accounts@your-domain.example>"
```

For a public shared demo account:

```dotenv
DEMO_ACCOUNT_EMAIL=demo.admin@feedme.app
DEMO_ACCOUNT_PASSWORD=replace-with-a-demo-only-password
```

These demo credentials are exposed to every visitor by design. Create the account once and store only non-sensitive sample data in its workspace.

## 3. Apply Migrations

Run migrations against the production database before promoting the application:

```bash
npm ci
npm run db:migrate
```

Do not run `db:push` as part of a production deployment. It bypasses the reviewed migration sequence.

## 4. Deploy The Application

Use:

```bash
npm run build
npm run start
```

On Vercel, keep the framework preset on Next.js and provide the environment variables in the project settings. `NEXT_PUBLIC_SITE_URL` must match the canonical deployment origin so auth links and social metadata do not point elsewhere.

## 5. Schedule Background Maintenance

Call the worker at least every five minutes:

```http
GET https://your-feedme.example/api/internal/notification-worker
Authorization: Bearer <INTERNAL_OPERATIONS_SECRET>
```

The endpoint retries notification and auth-email outboxes, reports queue health, and prunes expired rate-limit buckets. Keep the response and failure count in platform logs or monitoring.

## 6. Prepare The Extension

The included archive targets the hosted demo and localhost. A different deployment origin requires a matching extension build. Review the final manifest, install the unpacked build, and test capture against an allowed workspace domain before publishing the archive.

## Release Checklist

- `npm ci` completes from the lockfile.
- `npm run check` passes.
- `npm run build` passes with production variables.
- Migrations complete against a backup-protected database.
- Login and signup match the selected auth mode.
- The shared demo account contains no private data.
- Cloudinary capture succeeds and the image appears in report detail.
- The worker returns healthy queues with valid authorization.
- A PAT can connect to `/api/mcp`, read the guide, and fetch the correct workspace queue.
- A revoked membership or PAT loses access immediately.
- The extension origin and dashboard origin match.
- Error, function, database, and provider usage alerts are enabled.

## Rollback

Application rollback and schema rollback are separate operations. Prefer a forward migration that restores compatibility. Before any destructive migration, create and verify a database backup and document how the previous application version will behave against the new schema.
