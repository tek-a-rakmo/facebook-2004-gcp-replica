// Google Cloud Storage client for profile-photo uploads.
//
// Assumptions:
// - Runs on Cloud Run using Application Default Credentials (ADC): the service
//   account attached to the service supplies credentials automatically, so we
//   never reference a key file.
// - The bucket uses uniform bucket-level access with public read granted at the
//   bucket level. We therefore do NOT call makePublic() (that errors under
//   uniform access) — we just construct and return the public URL.
import { Storage } from "@google-cloud/storage";
import { randomUUID } from "node:crypto";

const BUCKET = process.env.GCS_BUCKET ?? "omkar-fb-uploads";

const storage = new Storage();

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
};

function extFor(contentType: string, originalName?: string): string {
  const byType = EXT_BY_TYPE[contentType];
  if (byType) return byType;

  const fromName = originalName?.split(".").pop()?.toLowerCase();
  if (fromName && fromName !== originalName?.toLowerCase()) return fromName;

  return "jpg";
}

export async function uploadProfilePhoto(
  bytes: Buffer,
  contentType: string,
  originalName?: string,
): Promise<string> {
  const ext = extFor(contentType, originalName);
  const name = `profile-photos/${randomUUID()}.${ext}`;

  await storage.bucket(BUCKET).file(name).save(bytes, {
    contentType,
    resumable: false,
    metadata: { cacheControl: "public, max-age=31536000" },
  });

  return `https://storage.googleapis.com/${BUCKET}/${name}`;
}
