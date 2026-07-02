import { getCurrentUser } from "@/lib/auth";
import { uploadProfilePhoto } from "@/lib/storage";

const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "No file" }, { status: 400 });
  }

  if (!file.type.startsWith("image/")) {
    return Response.json(
      { error: "Only image files are allowed" },
      { status: 400 },
    );
  }

  if (file.size > MAX_BYTES) {
    return Response.json(
      { error: "Image must be under 5MB" },
      { status: 400 },
    );
  }

  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const url = await uploadProfilePhoto(bytes, file.type, file.name);
    return Response.json({ url }, { status: 200 });
  } catch (err) {
    console.error("Profile photo upload failed:", err);
    return Response.json({ error: "Upload failed" }, { status: 500 });
  }
}
