@AGENTS.md

# Deployment architecture — STRICT, non-negotiable

**Target GCP project:** `sml-interview-sandbox-501222` (region `us-central1`). Authenticate as `omkar@smlcrm.com`. This is a locked-down org: `constraints/sql.restrictPublicIp` and `constraints/storage.publicAccessPrevention` are enforced org-wide and CANNOT be relaxed.

**Database connection:** Cloud SQL is on a **private IP via VPC** (no public IP — org policy forbids it). Cloud Run **must** be configured with **VPC egress** (Direct VPC egress or a Serverless VPC connector into the `default` network) to reach the database. **Local development uses a local Postgres Docker container** (container `tf-pg`, `localhost:5433`), never the Cloud SQL instance directly.

**Storage architecture:** The GCS bucket (`omkar-fb-uploads`) is **strictly private** due to org policy. **All image URLs must route through a custom Next.js API proxy handler** (`app/api/photo/[...path]/route.ts`) that fetches the file securely via the GCP SDK using the service account's ADC. `uploadProfilePhoto` returns an app-relative `/api/photo/...` URL, never a `storage.googleapis.com` URL. **Do NOT attempt to make the bucket public** (no `allUsers` IAM bindings, no `makePublic()`) — it will fail and is explicitly forbidden.
