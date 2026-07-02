"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "./db";
import {
  hashPassword,
  verifyPassword,
  createSession,
  destroySession,
  getCurrentUser,
  networkFromEmail,
  isEduEmail,
} from "./auth";

// Shape returned by form actions used with useActionState.
export type FormState = { error?: string };

// ---- Auth ----

export async function register(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!name || !email || !password) {
    return { error: "All fields are required." };
  }
  if (!isEduEmail(email)) {
    return { error: "You must register with a valid .edu email address." };
  }
  if (password.length < 6) {
    return { error: "Password must be at least 6 characters." };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "An account with that email already exists." };
  }

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash: await hashPassword(password),
      network: networkFromEmail(email),
    },
  });

  await createSession(user.id);
  redirect("/directory");
}

export async function login(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "Incorrect email or password." };
  }

  await createSession(user.id);
  redirect("/directory");
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/");
}

// ---- Profile ----

// Persist edits to the current user's own profile. Called from the edit form;
// photoUrl is set separately by the upload route and passed through as a hidden field.
export async function updateProfile(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  const field = (key: string) => {
    const v = String(formData.get(key) ?? "").trim();
    return v.length ? v : null;
  };

  await prisma.user.update({
    where: { id: user.id },
    data: {
      name: field("name") ?? user.name,
      photoUrl: field("photoUrl") ?? user.photoUrl,
      concentration: field("concentration"),
      hometown: field("hometown"),
      highSchool: field("highSchool"),
      residence: field("residence"),
      birthday: field("birthday"),
      relationshipStatus: field("relationshipStatus"),
      interestedIn: field("interestedIn"),
      lookingFor: field("lookingFor"),
      aboutMe: field("aboutMe"),
      favoriteBooks: field("favoriteBooks"),
      favoriteMusic: field("favoriteMusic"),
      favoriteMovies: field("favoriteMovies"),
      courses: field("courses"),
    },
  });

  revalidatePath(`/profile/${user.id}`);
  redirect(`/profile/${user.id}`);
}

// ---- Friendship ----

// Send a friend request to another member. No-op if a relationship already exists.
export async function sendRequest(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  const addresseeId = String(formData.get("addresseeId") ?? "");
  if (!addresseeId || addresseeId === user.id) return;

  const existing = await prisma.friendship.findFirst({
    where: {
      OR: [
        { requesterId: user.id, addresseeId },
        { requesterId: addresseeId, addresseeId: user.id },
      ],
    },
  });
  if (existing) return;

  await prisma.friendship.create({
    data: { requesterId: user.id, addresseeId, status: "PENDING" },
  });

  revalidatePath(`/profile/${addresseeId}`);
  revalidatePath("/friends");
}

// Accept or reject an incoming request. `accept=true` → ACCEPTED, otherwise deleted.
export async function respondRequest(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  const friendshipId = String(formData.get("friendshipId") ?? "");
  const accept = String(formData.get("accept") ?? "") === "true";

  const fr = await prisma.friendship.findUnique({
    where: { id: friendshipId },
  });
  // Only the addressee of a PENDING request may respond to it.
  if (!fr || fr.addresseeId !== user.id || fr.status !== "PENDING") return;

  if (accept) {
    await prisma.friendship.update({
      where: { id: friendshipId },
      data: { status: "ACCEPTED" },
    });
  } else {
    await prisma.friendship.delete({ where: { id: friendshipId } });
  }

  revalidatePath("/friends");
  revalidatePath(`/profile/${fr.requesterId}`);
}

// ---- The Wall ----

// Post a message onto someone's Wall (may be your own).
export async function postToWall(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  const profileId = String(formData.get("profileId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!profileId || !body) return;

  const target = await prisma.user.findUnique({ where: { id: profileId } });
  if (!target) return;

  await prisma.wallPost.create({
    data: { authorId: user.id, profileId, body: body.slice(0, 1000) },
  });

  revalidatePath(`/profile/${profileId}`);
}
