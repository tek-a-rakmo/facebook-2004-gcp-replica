import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "./db";
import type { User } from "@prisma/client";

const COOKIE_NAME = "tf_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Create a Session row keyed by a random token and drop the token into an
// httpOnly, Secure, SameSite=Lax cookie.
export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await prisma.session.create({
    data: { id: token, userId, expiresAt },
  });

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { id: token } });
    cookieStore.delete(COOKIE_NAME);
  }
}

// Read cookie → session → user. Returns null when unauthenticated or expired.
export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { id: token },
    include: { user: true },
  });
  if (!session) return null;

  if (session.expiresAt < new Date()) {
    await prisma.session.deleteMany({ where: { id: token } });
    return null;
  }

  return session.user;
}

// Derive a display network from an .edu email, e.g. jdoe@harvard.edu -> "Harvard".
export function networkFromEmail(email: string): string {
  const domain = email.split("@")[1] ?? "";
  const label = domain.replace(/\.edu$/i, "").split(".").pop() ?? domain;
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function isEduEmail(email: string): boolean {
  return /^[^@\s]+@[^@\s]+\.edu$/i.test(email.trim());
}
