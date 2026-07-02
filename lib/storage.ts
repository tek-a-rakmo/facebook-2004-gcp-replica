// Google Cloud Storage client for profile-photo uploads.
//
// Assumptions:
// - Runs on Cloud Run using Application Default Credentials (ADC): the service
//   account attached to the service supplies credentials automatically, so we
//   never reference a key file.
// - The org enforces `storage.publicAccessPrevention`, so objects CANNOT be made
//   public. We therefore keep the bucket private and serve photos through an
//   authenticated app route (GET /api/photo/<objectName>) that streams the bytes
//   using the same service-account credentials. uploadProfilePhoto returns that
//   app-relative URL, which is stored on the User and used directly in <img src>.
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

// Upload bytes to the private bucket and return the app URL that serves them.
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

  return `/api/photo/${name}`;
}

// Download an object's bytes + content type for the serve route. Returns null
// if the object doesn't exist.
export async function getPhoto(
  objectName: string,
): Promise<{ bytes: Buffer; contentType: string } | null> {
  const file = storage.bucket(BUCKET).file(objectName);
  const [exists] = await file.exists();
  if (!exists) return null;

  const [metadata] = await file.getMetadata();
  const [bytes] = await file.download();
  return {
    bytes,
    contentType: (metadata.contentType as string) ?? "application/octet-stream",
  };
}
