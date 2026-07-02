import { getPhoto } from "@/lib/storage";

// Streams a profile photo from the private GCS bucket. The org enforces
// public-access-prevention, so objects can't be served directly from GCS;
// this route reads them with the service-account credentials instead.
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path } = await ctx.params;
  const objectName = path.join("/");

  // Only ever serve uploaded profile photos.
  if (!objectName.startsWith("profile-photos/")) {
    return new Response("Not found", { status: 404 });
  }

  const photo = await getPhoto(objectName);
  if (!photo) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(new Uint8Array(photo.bytes), {
    status: 200,
    headers: {
      "Content-Type": photo.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
