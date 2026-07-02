# TheFacebook (2004) — Build Plan

A period-accurate replica of **TheFacebook, February 2004**, deployed to Google Cloud.

## Product scope

Faithful to what TheFacebook actually was in early 2004 — scoping by authenticity, not by cutting corners.

**Included**
- `.edu`-only signup & login (email/password)
- Rich student profiles (concentration, hometown, interests, relationship status, courses…) with a profile photo
- Friend requests → accept / reject
- **The Wall** (post short messages on a profile)
- Member **directory** with name / network search

**Deliberately excluded** (did not exist in Feb 2004):
News Feed (2006), Likes & comments, Groups, Messenger. Leaving these out keeps the replica honest.

## Stack

| Concern | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router), `output: 'standalone'`, TypeScript |
| Mutations | Server Actions; a Route Handler for photo upload |
| Database | Cloud SQL for PostgreSQL, accessed via Prisma |
| Auth | Hand-rolled: `bcryptjs` hashing + `Session` row keyed by a random token in an httpOnly, Secure, SameSite=Lax cookie |
| File storage | Cloud Storage (server-side upload via `@google-cloud/storage`) |
| Hosting | Cloud Run (container), connected to Cloud SQL via socket |
| Styling | Hand-written CSS reproducing the 2004 look (`#3B5998` header, Lucida/Verdana, boxy tables). No component library. |

## Data model (Prisma)

- **User** — email (unique, must end `.edu`), passwordHash, name, network (from email domain), photoUrl, and profile fields (concentration, hometown, highSchool, residence, birthday, relationshipStatus, interestedIn, lookingFor, aboutMe, favoriteBooks/Music/Movies, courses).
- **Session** — token id, userId, expiresAt.
- **Friendship** — requesterId, addresseeId, status (`PENDING` | `ACCEPTED`), unique on the pair.
- **WallPost** — authorId, profileId (wall owner), body, createdAt.

## App structure

```
app/
  layout.tsx            retro header bar + nav
  globals.css           2004 design tokens
  page.tsx              landing = login (redirects to /directory when authed)
  (auth)/register/      .edu signup
  directory/            member list + ?q= search
  profile/[id]/         profile view: info panel, photo, friend button, The Wall
  profile/edit/         edit own profile + photo upload
  friends/              incoming requests (accept/reject) + friends list
  api/upload/route.ts   receives file → Cloud Storage → returns public URL
lib/
  db.ts                 Prisma singleton
  auth.ts               hash/verify, create/destroy/get session, getCurrentUser
  actions.ts            Server Actions (register, login, logout, updateProfile, sendRequest, respondRequest, postToWall)
  storage.ts            Cloud Storage client
prisma/schema.prisma    + optional seed (Harvard demo users)
Dockerfile              binaryTargets includes debian-openssl-3.0.x
```

## Claude Code workflow — parallel subagents

Once the shared foundation is committed (schema, `lib/db.ts`, `lib/auth.ts`, `lib/actions.ts` signatures, design tokens), independent UI/integration work fans out to **parallel subagents** with non-overlapping files, so file-level conflicts are impossible:

- **Agent A — Profile UI:** `profile/[id]` + `profile/edit`
- **Agent B — Social UI:** `friends/` + `directory/`
- **Agent C — Upload:** `api/upload/route.ts` + `lib/storage.ts`

Shared contracts (`lib/actions.ts`, `schema.prisma`) are written on the main thread first; subagents only import them. The main thread integrates each diff, runs `tsc --noEmit`, and commits per agent so the git history shows the parallelized work.

## Build order (2 hours from first commit)

1. **0:00** — scaffold + **first commit** (starts clock): Next.js, Prisma, retro layout, `output:'standalone'`.
2. **0:00–0:20** — Prisma schema + migrate, `lib/db.ts`, `lib/auth.ts`, register/login/logout.
3. **0:20–0:30** — derisk deploy early: throwaway Cloud Run deploy to prove the pipeline.
4. **0:30–0:35** — finalize shared contracts (`lib/actions.ts` + helper signatures).
5. **0:35–1:15** — parallel subagent sprint (Agents A/B/C); integrate + typecheck + commit per agent.
6. **1:15–1:40** — Dockerfile (binaryTargets!), secrets, `migrate deploy` to Cloud SQL, redeploy, smoke test.
7. **1:40–2:00** — seed demo users, polish styling, README with live URL, final commit + push.

## Verification

- **Local:** register with an `@harvard.edu` email, edit profile + upload photo, second account, send/accept friend request, post to a Wall, search directory; confirm the session cookie is httpOnly and logout clears it.
- **Prod:** repeat the flow on the live Cloud Run URL; confirm the uploaded photo renders from its public Cloud Storage URL and data persists in Cloud SQL.
- **Security:** no secrets in the repo (`.env*` gitignored), `.edu` validation rejects non-edu emails, Wall/friend actions require an authenticated session.
