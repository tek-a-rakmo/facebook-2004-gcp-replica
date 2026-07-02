# Review prep — TheFacebook (2004) replica

Answers and talking points for the post-build review. Part A is the section-by-section narrative; **Part B answers the specific questionnaire (Q1–Q20)**.

---

# Part B — Questionnaire (Q1–Q20)

## 1. Live Demo & Scope Management

**Q1 — Walk through the live app; what's fully functional?**
URL: https://omkar-app-cxkix43qtq-uc.a.run.app (IAP → `@smlcrm.com` login, then a demo account from `user-details.md`). Fully working: `.edu` register/login with server-side sessions; the member **directory** with name/network **search**; **profiles** with the full 2004 field set and a **photo upload** (stored private, served through a proxy); **friend requests** with accept/reject; **The Wall** (post + list). The seeded Harvard users, their friendships, and a pending Cameron→Mark request are all live.

**Q2 — How did you scope the MVP from an underspecified prompt?**
I anchored on a hard date: **TheFacebook as of February 2004**. That turned "what to build" into a factual question. In-scope = what existed then (directory, profiles, friends, the Wall, `.edu` gate). Out = anything that postdates it (News Feed 2006, Likes/comments, Groups, Messenger). Authenticity *is* the scoping discipline — every cut has a defensible reason instead of feeling like a missing feature.

**Q3 — A feature you downscoped mid-build to hit the deadline, and the trade-off.**
Two real ones. (1) **Photo delivery** was planned as public GCS URLs; when the org policy blocked public objects I downscoped from "CDN-style public object" to a **proxy route that streams the bytes through the app**. Slower, but keeps the feature and respects the constraint — the right call under time pressure. (2) I deliberately spent the back half of the budget on the **deploy path** (private-IP DB + VPC + IAP) rather than UI polish, so what got cut was cosmetic/secondary: directory pagination, richer profile interactivity, and any client-side JS beyond forms. Trade-off logic: a working *deployed* app beats a prettier local one, since deployment is explicitly graded.

**Q4 — What's broken/incomplete? Be upfront.**
- Not truly public — org policy forbids `allUsers`, so it's behind **IAP** (smlcrm.com only). Correct given constraints, but a reviewer must use an smlcrm.com identity.
- Photos are streamed through `/api/photo` on every render (browser-cached via `Cache-Control`, but **no CDN**) — fine for demo scale, not for real traffic.
- **No pagination** — directory caps at 200, walls at 100.
- **`SESSION_SECRET` is provisioned but unused**: sessions are high-entropy random tokens looked up in the DB (a bearer-token model), not signed cookies. Secure, but I'd either wire it into cookie signing or remove it to avoid confusion.
- No rate-limiting on login/register, and profile fields like `birthday` are free-text strings, not typed dates.

## 2. System Design & Architecture

**Q5 — Data model, why Cloud SQL over Firestore, and data integrity.**
Four tables: `User`, `Session`, `Friendship` (a join row with `requesterId`/`addresseeId` + a `PENDING|ACCEPTED` enum), `WallPost` (two FKs to `User`: author and wall-owner). The data is inherently **relational** — symmetric friendships, join queries for "friends of X," directory filters — which is exactly what a SQL engine + foreign keys do well; Firestore would force denormalization and make the both-directions friendship query and search awkward. **Integrity:** FK constraints with `onDelete: Cascade`, `@@unique([requesterId, addresseeId])` to stop duplicate friend rows, a unique `email`, and the status enum. Prisma migrations are the schema source of truth.

**Q6 — Backend API design (Server Actions / Route Handlers).**
Mutations are **Server Actions** in `lib/actions.ts` (`register`, `login`, `logout`, `updateProfile`, `sendRequest`, `respondRequest`, `postToWall`), invoked directly from `<form action={...}>` — no hand-rolled REST layer, and progressive-enhancement friendly. I used **Route Handlers only where the Web Request/Response API is the right tool**: `POST /api/upload` (multipart in) and `GET /api/photo/[...path]` (bytes out). Reads are plain async calls in Server Components via `lib/queries.ts`. After each mutation I `revalidatePath` the affected route.

**Q7 — Authentication across the front/back boundary.**
`bcryptjs` hashes the password. On login I create a `Session` row whose **id is a 32-byte random token**, and set that token in an **httpOnly, Secure, SameSite=Lax** cookie. `getCurrentUser()` (in `lib/auth.ts`) reads the cookie → looks up the session → checks `expiresAt` (lazily deleting expired ones) → returns the user. Sessions are **server-side**, so logout and expiry are authoritative (no stateless-JWT revocation problem). Because Server Actions are just POST endpoints, **every action and every protected page re-checks `getCurrentUser()`** — authorization never lives only in the UI.

**Q8 — How does Next securely reach the Cloud DB in the sandbox?**
Prisma 7 connects through the **node-postgres driver adapter** (`@prisma/adapter-pg`). The `DATABASE_URL` (a **private-IP** connection string) lives in **Secret Manager**, mounted as an env var; the runtime service account has `secretAccessor`. Cloud SQL has **no public IP** (org policy), so Cloud Run reaches it via **Direct VPC egress** (`--network=default --vpc-egress=private-ranges-only`) into the `default` VPC, which is peered to Cloud SQL through Private Service Access. Nothing about the DB is exposed to the internet.

## 3. Claude Code Workflow & Proficiency

**Q9 — CLAUDE.md structure and the standards you gave the agent.**
`CLAUDE.md` imports `AGENTS.md` (which mandates **reading the in-repo Next.js 16 docs before writing code**, because this version has breaking changes vs training data) and then pins the **strict, non-negotiable deployment architecture**: target project, private-IP + VPC egress, private-bucket-via-proxy, IAP-not-allUsers, plus an operational command reference and "deploy invariants." Crucially these were promoted into `CLAUDE.md` **after** I discovered each org constraint the hard way — so the rules persist and future sessions don't repeat the mistakes.

**Q10 — How plan.md evolved; how you blocked the work.**
`plan.md` started as a phased plan with a time budget: foundation → early deploy de-risk → shared contracts → parallel UI sprint → deploy → seed/polish. It **evolved on contact with reality**: Prisma 7's breaking changes deleted the planned `binaryTargets` step, and the org policies rewrote the whole deploy block (public socket → private IP + VPC + IAP; public bucket → proxy). The decomposition that let Claude execute cleanly: **write shared contracts first on the main thread** (schema, `lib/db`, `lib/auth`, and the `lib/actions`/`lib/queries` signatures), then fan out independent UI on top of them.

**Q11 — Subagents: parallelization, context, conflict prevention.**
Yes — after committing the shared foundation, I launched **three subagents in parallel on non-overlapping files**: Agent A = Profile UI (`profile/[id]`, `profile/edit`), Agent B = Social UI (`friends`, `directory`), Agent C = upload route + `lib/storage`. Conflict prevention was **structural, not hopeful**: each agent was given the exact contract signatures to import, the list of CSS classes to use, the Next 16 conventions, and an explicit ban on editing any shared file — so two agents literally never touched the same file. Context was managed by handing each a tight interface rather than the whole codebase. Each landed as its **own commit** so the history shows the parallel sprint, and the main thread integrated + `tsc`-checked each.

**Q12 — Debugging strategy when Claude produced broken code / terminal errors.**
Read the *actual* error, reproduce it minimally, fix the root cause — don't re-prompt blindly. Examples from this build: Prisma's `P1012` ("`url` no longer supported") sent me to the v7 config model; a build failure was reproduced locally by running `prisma generate` **with `.env` moved aside**, which proved the throwing `env()` helper was the cause; the GCP `400/412/FAILED_PRECONDITION` errors were read literally ("violates constraints/sql.restrictPublicIp", "public access prevention is enforced", "do not belong to a permitted customer") and each triggered an architecture pivot rather than a retry.

**Q13 — A time you modified or rejected Claude's output.**
The clearest: a subagent typed a field list as `keyof Awaited<ReturnType<typeof getProfile>>`, which collapses to `never` (because `getProfile` returns `User | null` and `keyof null` is `never`) — `tsc` caught it at integration and I rewrote it to `keyof User`. I also **rejected the model's Prisma ≤6 assumptions** (URL in `schema.prisma`, `binaryTargets` for Cloud Run) after reading the v7 docs, and **overrode Agent C's original design** of returning a public `storage.googleapis.com` URL, replacing it with the private proxy once the org policy was known.

## 4. Code Deep Dive

**Q14 — Explain one of the most complex functions line-by-line.**
`getRelationState(viewerId, profileId)` in `lib/queries.ts` — it drives the profile's friend button and has to treat friendship as **symmetric**:
1. `if (viewerId === profileId) return "self"` — you don't friend yourself.
2. `findFirst` with an `OR` of both orderings (`requester=viewer,addressee=profile` **or** the reverse) — because either party could have initiated.
3. `if (!fr) return "none"` — no row → offer "Add to Friends".
4. `if (fr.status === "ACCEPTED") return "friends"`.
5. Otherwise it's `PENDING`, so `return fr.requesterId === viewerId ? "outgoing" : "incoming"` — "outgoing" shows "request pending"; "incoming" points them to the friends page to accept. That single value lets the view render the correct control without any other logic. (Runner-up for complexity: the **deploy path** — Cloud Run → Direct VPC egress → PSA-peered private Cloud SQL, with migrations run from a baked-engine Job because the DB is unreachable off-VPC and there's no public egress to download the engine at runtime.)

**Q15 — % Claude-generated vs. hand-refined for a file, and why you intervened.**
`app/profile/[id]/page.tsx`: ~90% subagent-generated against my contract; my intervention was the `keyof User` type fix (a real compile bug the agent couldn't see without the whole type graph). Inverse example: `lib/db.ts`, `lib/auth.ts`, and the `lib/storage.ts` proxy are ~mostly **hand-written/heavily-directed**, because they encode security- and infra-critical decisions (Prisma 7 adapter wiring, session/cookie flags, private-bucket streaming) where I wanted to own every line. All **infrastructure** (VPC, IAP, Jobs, secrets) was main-thread, not generated.

**Q16 — Runtime error handling / edge cases so it doesn't crash in prod.**
`POST /api/upload`: 401 if unauthenticated, rejects non-images and >5MB, and wraps the GCS call in try/catch → 500 with a logged error (never an unhandled throw). `GET /api/photo/[...path]`: a `profile-photos/` **prefix guard** (can't be used to read arbitrary objects) and a 404 when the object doesn't exist. `respondRequest`: only the **addressee** of a still-`PENDING` request can act — anything else is a silent no-op, so replaying a stale form can't corrupt state. `getCurrentUser`: missing/expired sessions return `null` (and expired rows are deleted) rather than throwing.

## 5. Production, Security & Growth

**Q17 — Public repo: how did you keep secrets out, and where do they live?**
`.gitignore` excludes `.env*` (with a `!.env.example` exception) and service-account-key patterns; I **verified `git status` didn't include `.env` before the very first commit**. There are **no key files at all** — everything uses **Application Default Credentials** (the Cloud Run service account), so there's nothing to leak. Real secrets (`DATABASE_URL`, `SESSION_SECRET`) live in **Secret Manager** and are mounted as env vars at deploy time; the runtime SA has `secretAccessor`.

**Q18 — Scaling on a traffic spike; first bottlenecks.**
Cloud Run scales the stateless web container horizontally on its own. The **first bottleneck is Cloud SQL connections** — `db-f1-micro` supports only ~25–50, and N instances × a pool each exhausts that fast; the memoized single `PrismaClient` per instance helps, but the fix is a **connection pooler** (PgBouncer / the Cloud SQL connector's pooling) and then bumping the instance tier. The **second is the photo proxy** — every image render is an authenticated GCS download through the app; I'd move that to signed URLs or a CDN. Cold starts (scale-to-zero) are the third; `--min-instances=1` removes them when worth the cost.

**Q19 — Production-grade migrations, testing, CI/CD logging with Cloud Build.**
**Migrations** already run as a dedicated **Cloud Run Job** (`omkar-migrate`, roll-forward, reviewed under `prisma/migrations`) — decoupled from web startup so instances don't race. **CI/CD:** a `cloudbuild.yaml` triggered on push to `main` → build image → push to Artifact Registry → **run the migrate Job** → deploy the service, gated on `tsc`/lint/tests; build + step logs land in Cloud Build/Cloud Logging. **Testing:** unit tests for pure logic (`isEduEmail`, `networkFromEmail`, `getRelationState`), integration tests for Server Actions against an ephemeral Postgres (the same local-Docker pattern), and a Playwright smoke test of register→friend→wall. **Observability:** Cloud Logging + Error Reporting, an uptime check on `/`, and alerts on 5xx rate and DB connection errors.

**Q20 — With another 2 hours, immediate next steps.**
In priority order: (1) **CDN/signed-URL photos** to kill the proxy bottleneck; (2) a **Cloud Build CI/CD pipeline** + the test suite above; (3) **pagination** on directory/wall; (4) **rate-limiting** on login/register and basic abuse protection; (5) decide `SESSION_SECRET` — either sign the cookie with it or remove it; (6) typed profile fields (real date for birthday, enum for relationship status); (7) `--min-instances=1` + a small monitoring dashboard. None are architectural rewrites — the foundation holds.

---

# Part A — Narrative notes

## 1. Live Demo (10 min)

**URL:** https://omkar-app-cxkix43qtq-uc.a.run.app — the org policy blocks fully-public (`allUsers`) services, so it's behind **Identity-Aware Proxy**: sign in with an `@smlcrm.com` Google account, then log into the app with a demo account (`user-details.md`, password `harvard2004`).

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
