# Review prep — TheFacebook (2004) replica

Answers and talking points for the post-build review, section by section.

---

## 1. Live Demo (10 min)

**Public URL:** _(Cloud Run HTTPS URL — added after deploy)_

**Happy-path walkthrough:**
1. Land on `/` → the retro login page. Register a new account with an `@harvard.edu` email (try a non-`.edu` first to show the validation rejecting it).
2. Land in the **directory** → seeded Harvard members (Zuckerberg, Saverin, Moskovitz, Hughes, the Winklevoss twins).
3. Open **Edit Profile** → fill in concentration/hometown/etc. and **upload a photo** (served back through the private proxy, not a public bucket URL).
4. Open another member's profile → **Add to Friends**; log in as that member (demo password `harvard2004`) → accept on the **friends** page.
5. Post on someone's **Wall**; use the directory **search** by name/network.
6. Show the session cookie in devtools is **httpOnly/Secure/SameSite=Lax**; log out and show it's cleared.

**What works:** full auth, profiles + photo upload/serve, friend request/accept, the Wall, directory + search — the complete Feb-2004 feature set.

**Be upfront about limits / deliberate cuts:**
- No News Feed, Likes/comments, Groups, or Messenger — those postdate Feb 2004; excluding them is intentional scoping, not missing work.
- Photos are streamed through the app (`/api/photo/...`) rather than a CDN because the org blocks public buckets — correct, but not as fast as a public/CDN-backed object would be.
- Single small instance (`db-f1-micro`, Cloud Run scale-to-zero) → first request after idle has cold-start + DB-connection latency.

---

## 2. Architecture (15 min)

**Data model (Prisma / Postgres):** four tables.
- `User` — credentials (`email` unique, `passwordHash`), `network` derived from the email domain, `photoUrl`, and the period-accurate profile fields.
- `Session` — id **is** the random session token, `userId`, `expiresAt`. Server-side sessions (not JWTs) so logout/expiry is authoritative.
- `Friendship` — `requesterId` + `addresseeId` + `status` (`PENDING`/`ACCEPTED`), `@@unique([requesterId, addresseeId])`. Friendship is symmetric, so lookups check **both** directions.
- `WallPost` — `authorId` + `profileId` (whose wall) + `body`. Two relations from `WallPost` to `User` (`Author`, `Wall`).

**Auth (hand-rolled, fully explainable):** `bcryptjs` hashes; on login we create a `Session` row keyed by a 32-byte random token and set it in an httpOnly/Secure/SameSite=Lax cookie. `getCurrentUser()` = cookie → session (check `expiresAt`) → user. Every Server Action and protected page re-checks it — Server Actions are just POST endpoints, so authorization lives **inside** each action, never only in the UI.

**API design:** mutations are **Server Actions** (`register`, `login`, `logout`, `updateProfile`, `sendRequest`, `respondRequest`, `postToWall`) invoked directly from `<form action={...}>` — no bespoke REST layer, progressive-enhancement friendly. Two **Route Handlers** exist where the Web Request/Response API is the right tool: `POST /api/upload` (multipart photo in) and `GET /api/photo/[...path]` (photo out).

**How Next talks to the DB:** Prisma 7 with the **node-postgres driver adapter** (`@prisma/adapter-pg`) — v7 replaced the Rust query-engine binary with a query compiler + driver adapter, and moved the connection URL out of `schema.prisma` into `prisma.config.ts`. A single `PrismaClient` is memoized on `globalThis` to avoid exhausting connections.

**How it runs on GCP (shaped by a locked-down org):**
- `sql.restrictPublicIp` → Cloud SQL has **no public IP**; it sits on a private IP in the `default` VPC via Private Service Access. Cloud Run reaches it through **Direct VPC egress**.
- `storage.publicAccessPrevention` → the photos bucket is **private**; images are proxied through `/api/photo` using the service account's ADC.
- Migrations can't run from a laptop (private IP) or download the schema-engine at runtime (no public egress), so they run as a **Cloud Run Job** built from the same image (engine baked in) with VPC egress.

**"Most complex part":** the interplay of the private-IP DB + VPC egress + a private bucket served through an app proxy + Prisma 7's new adapter model — i.e. making a stateless container correctly and securely reach stateful, network-isolated resources.

---

## 3. Claude Code Workflow (15 min)

**`CLAUDE.md`:** imports `AGENTS.md` (which mandates reading the in-repo Next.js 16 docs before coding) and pins the **strict, non-negotiable deployment architecture** (target project, private-IP + VPC egress, private-bucket proxy). These were promoted to `CLAUDE.md` *after* discovering the org constraints, so future sessions don't repeat the mistakes.

**`plan.md`:** the phased plan — scope reasoning (why exclude News Feed etc.), stack, data model, app structure, the subagent strategy, a time budget, and the verification checklist.

**Subagents (the headline of the workflow):** after the shared foundation was committed (schema, `lib/db`, `lib/auth`, `lib/actions` + `lib/queries` contracts, design tokens), work fanned out to **three parallel subagents on non-overlapping files**:
- Agent A — Profile UI (`profile/[id]`, `profile/edit`)
- Agent B — Social UI (`friends`, `directory`)
- Agent C — Upload route + `lib/storage`

Each got the exact contract signatures + the CSS class list, and was forbidden from editing shared files — so file-level conflicts were structurally impossible. Each landed as its **own commit** so the history shows the parallelized sprint.

**Prompting strategy:** write the shared contracts (types + function signatures) on the main thread first, then hand subagents precise interfaces to import — never "go build the profile page" but "here are the exact functions, the CSS classes, the Next 16 conventions, and the files you own."

**Handling AI / environment errors (real examples from this build):**
- **Prisma 7 breaking changes** — the model assumed Prisma ≤6 (`url` in schema, `binaryTargets` for Cloud Run). Reading v7 errors + the installed type defs corrected it to `prisma.config.ts` + driver adapter, and *removed* the now-obsolete `binaryTargets` gotcha.
- **A subagent's type bug** — `keyof Awaited<ReturnType<typeof getProfile>>` collapsed to `never` (because `keyof null` is `never`); caught by `tsc --noEmit` during integration and fixed to `keyof User`.
- **Org-policy failures** — public bucket and public-IP Cloud SQL both rejected; pivoted to the private-proxy + private-IP-VPC architecture rather than fighting the policies.

**Verification, not vibes:** every integration step ran `tsc --noEmit`, then a full production build, then an **end-to-end smoke test on the actual standalone server** (authenticated directory/profile/friends/wall against Postgres) before deploying.

---

## 4. Code Deep Dive (10 min)

Functions worth walking through:

- **`lib/auth.ts:getCurrentUser`** — the whole auth read path in ~15 lines: `await cookies()` (async in Next 16) → session lookup → expiry check (lazily deletes expired) → user. *Modified from generic scaffolding* to add the expiry deletion and the `.edu`/network helpers.
- **`lib/auth.ts:createSession`** — random token via `crypto.randomBytes`, `Session` row, cookie flags. The security-critical bit; written by hand, not generated.
- **`lib/db.ts`** — Prisma 7 driver-adapter instantiation + `globalThis` memoization. *Rewritten* once I learned v7 needs `new PrismaClient({ adapter: new PrismaPg(...) })`.
- **`lib/queries.ts:getRelationState`** — resolves viewer↔profile into `self/none/friends/outgoing/incoming` by checking friendships in both directions; drives the profile's friend button. Main-thread contract that Agent A consumed.
- **`lib/actions.ts:respondRequest`** — shows the authorization pattern: only the **addressee** of a **PENDING** request can accept/reject; anything else is a no-op.
- **`app/api/photo/[...path]/route.ts`** + **`lib/storage.ts:getPhoto`** — the private-bucket proxy, with a `profile-photos/` prefix guard so it can't be used to read arbitrary objects.

**Claude-generated vs. hand-modified:** the three UI surfaces were largely subagent-generated against contracts I wrote; the foundation (schema, auth, actions, db, storage design) and all the **infra/architecture decisions** were driven and reviewed on the main thread. The `never` type fix, the Prisma-7 migration, and the private-proxy pivot were human-directed corrections.

---

## 5. Production & Growth (10 min)

- **Migrations:** `prisma migrate deploy` runs as a **Cloud Run Job** (same image, schema engine baked in, VPC egress) — decoupled from web-container startup so multiple instances don't race. Roll-forward migrations, reviewed in the repo under `prisma/migrations`.
- **Secrets:** `DATABASE_URL` and `SESSION_SECRET` live in **Secret Manager**, mounted as env vars on the service/job; the runtime SA has `secretAccessor`. Nothing sensitive in the repo (`.env*` gitignored, SA-key patterns gitignored).
- **CI/CD:** natural next step is **Cloud Build** on push to `main` → build image → push to Artifact Registry → run the migrate Job → deploy the service. A `cloudbuild.yaml` with those four steps; gate on `tsc`/lint/tests.
- **Testing:** unit-test the pure logic (`networkFromEmail`, `isEduEmail`, `getRelationState`), integration-test Server Actions against an ephemeral Postgres (the local Docker pattern), and a Playwright smoke test of the register→friend→wall flow in CI.
- **Monitoring:** Cloud Run request metrics + logs in Cloud Logging; uptime check on `/`; alert on 5xx rate and DB connection errors; Error Reporting for exceptions.
- **Scaling on Cloud Run:** stateless containers scale horizontally; the constraint is DB connections, so set sane `--max-instances`, keep the memoized client, and use a connection pooler (PgBouncer / Cloud SQL connector pooling) before scaling the instance tier up from `db-f1-micro`. `--min-instances=1` removes cold starts when warranted.
- **Cost/teardown:** Cloud Run scales to zero; `db-f1-micro` is the only always-on cost. Tear the DB down after the demo to stop charges.
