@AGENTS.md

# Deployment architecture — STRICT, non-negotiable

**Target GCP project:** `sml-interview-sandbox-501222` (region `us-central1`). Authenticate as `omkar@smlcrm.com`. This is a locked-down org: `constraints/sql.restrictPublicIp` and `constraints/storage.publicAccessPrevention` are enforced org-wide and CANNOT be relaxed.

**Database connection:** Cloud SQL is on a **private IP via VPC** (no public IP — org policy forbids it). Cloud Run **must** be configured with **VPC egress** (Direct VPC egress or a Serverless VPC connector into the `default` network) to reach the database. **Local development uses a local Postgres Docker container** (container `tf-pg`, `localhost:5433`), never the Cloud SQL instance directly.

**Storage architecture:** The GCS bucket (`omkar-fb-uploads`) is **strictly private** due to org policy. **All image URLs must route through a custom Next.js API proxy handler** (`app/api/photo/[...path]/route.ts`) that fetches the file securely via the GCP SDK using the service account's ADC. `uploadProfilePhoto` returns an app-relative `/api/photo/...` URL, never a `storage.googleapis.com` URL. **Do NOT attempt to make the bucket public** (no `allUsers` IAM bindings, no `makePublic()`) — it will fail and is explicitly forbidden.

**Public access:** `allUsers` is blocked org-wide (domain-restricted sharing). The service is fronted by **Identity-Aware Proxy** and access is granted to `domain:smlcrm.com` — do not try to add `allUsers` as `run.invoker` or IAP accessor.

# Operational reference (already deployed)

- **Live:** https://omkar-app-cxkix43qtq-uc.a.run.app (IAP → sign in with `@smlcrm.com`).
- **Region/repo:** `us-central1`, Artifact Registry `omkar-repo` (images `web:v1`, `migrator:v1`).
- **Resources:** Cloud Run service `omkar-app`; Cloud SQL `omkar-fb-db` (private IP, ENTERPRISE, `db-f1-micro`, db `thefacebook`, user `fbapp`); bucket `omkar-fb-uploads`; secrets `DATABASE_URL` + `SESSION_SECRET`; Cloud Run Jobs `omkar-migrate` (runs `prisma migrate deploy`) and `omkar-seed` (`prisma db seed`).
- **Runtime SA:** `789546278193-compute@developer.gserviceaccount.com` (has `storage.objectAdmin` on the bucket + `secretAccessor` on both secrets).

Common commands (all `--region=us-central1`):

```bash
# Rebuild + push after code changes
docker build --target runner   -t us-central1-docker.pkg.dev/sml-interview-sandbox-501222/omkar-repo/web:v1 .
docker build --target migrator -t us-central1-docker.pkg.dev/sml-interview-sandbox-501222/omkar-repo/migrator:v1 .
docker push us-central1-docker.pkg.dev/sml-interview-sandbox-501222/omkar-repo/web:v1
docker push us-central1-docker.pkg.dev/sml-interview-sandbox-501222/omkar-repo/migrator:v1

# Apply migrations / reseed (Cloud Run Jobs — reach the private DB via VPC egress)
gcloud run jobs execute omkar-migrate --region=us-central1
gcloud run jobs execute omkar-seed    --region=us-central1

# Redeploy the web service (keeps VPC egress + secrets)
gcloud run services update omkar-app --region=us-central1 \
  --image=us-central1-docker.pkg.dev/sml-interview-sandbox-501222/omkar-repo/web:v1

# Stop all cost after the interview
gcloud sql instances delete omkar-fb-db --project=sml-interview-sandbox-501222
```

**Deploy invariants (never drop these flags):** the web service and both Jobs MUST keep `--network=default --subnet=default --vpc-egress=private-ranges-only` (to reach the private DB) and the web service MUST keep `--set-secrets=DATABASE_URL=DATABASE_URL:latest,SESSION_SECRET=SESSION_SECRET:latest --set-env-vars=GCS_BUCKET=omkar-fb-uploads`. Migrations run via the `migrator` image (schema engine baked in) because Cloud Run has no public egress to download it and the DB is unreachable from a laptop.
