# thefacebook (2004) — a period-accurate replica

A faithful rebuild of **TheFacebook as it existed in February 2004**, deployed on Google Cloud. Built as a timed interview challenge — see [`plan.md`](./plan.md) for the full plan, scope reasoning, and time budget.

> **Live demo:** _(added after deploy)_

## What it does

- **`.edu`-only signup & login** — email/password, hand-rolled sessions
- **Rich student profiles** — concentration, hometown, residence, interests, courses… + a profile photo
- **Friend requests** → accept / reject
- **The Wall** — post short messages on a profile
- **Member directory** with name / network search

Deliberately **excluded** because they didn't exist in Feb 2004: News Feed, Likes/comments, Groups, Messenger. Scoping by authenticity.

## Stack

- **Next.js 16** (App Router, `output: 'standalone'`, TypeScript) — Server Actions for mutations, a Route Handler for photo upload
- **Prisma 7** with the **node-postgres driver adapter** (`@prisma/adapter-pg`). Prisma 7 uses a query compiler instead of a Rust query-engine binary, so there is no `binaryTargets` step and the container stays small
- **Cloud SQL for PostgreSQL** (private IP)
- **Cloud Run** (containerized, VPC egress to reach the private database)
- **Cloud Storage** for profile photos
- Hand-written CSS reproducing the 2004 look (`#3B5998` header, Lucida/Verdana, boxy tables) — no component library

## Architecture notes (locked-down org)

The GCP org enforces two policies that shape the design:

- **`sql.restrictPublicIp`** → Cloud SQL has **no public IP**. It lives on a private IP in the `default` VPC (via Private Service Access), and Cloud Run reaches it through **VPC egress**.
- **`storage.publicAccessPrevention`** → the photos bucket is **strictly private**. Images are served through an authenticated Next.js proxy route (`app/api/photo/[...path]`) that streams objects using the service account's credentials — never a public GCS URL.

## Auth

`bcryptjs` password hashing; a `Session` row keyed by a random token stored in an **httpOnly, Secure, SameSite=Lax** cookie. `getCurrentUser()` resolves cookie → session → user, and every Server Action / protected page re-checks it.

## Local development

Requires Node 20+ and Docker.

```bash
# 1. Start a local Postgres (the app never talks to Cloud SQL directly in dev)
docker run -d --name tf-pg -e POSTGRES_PASSWORD=pass -e POSTGRES_USER=user \
  -e POSTGRES_DB=thefacebook -p 5433:5432 postgres:16-alpine

# 2. Configure env
cp .env.example .env   # DATABASE_URL already points at localhost:5433

# 3. Install, migrate, seed
npm install
npx prisma migrate dev
npx prisma db seed      # Harvard demo users (password: harvard2004)

# 4. Run
npm run dev             # http://localhost:3000
```

## Deployment (Cloud Run + Cloud SQL)

Target project `sml-interview-sandbox-501222`, region `us-central1`. In brief:

1. Cloud SQL Postgres `omkar-fb-db` on private IP (Enterprise edition, `db-f1-micro`).
2. `DATABASE_URL` (private-IP connection string) and `SESSION_SECRET` stored in Secret Manager.
3. Migrations applied via the Cloud SQL Auth Proxy.
4. `gcloud run deploy` from source with **Direct VPC egress** into the `default` network and the secrets mapped to env.

## Project layout

```
app/            App Router pages, Server Actions client forms, API routes
  api/upload    POST — receives a photo, stores it in the private bucket
  api/photo     GET  — streams a private photo through the app (proxy)
lib/            db (Prisma + pg adapter), auth, actions, queries, storage
prisma/         schema, migrations, seed
Dockerfile      standalone build; copies the generated Prisma client + pg adapter
```
