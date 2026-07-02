import { prisma } from "./db";
import type { User, WallPost } from "@prisma/client";

// Read-side helpers. Server Components and the UI subagents import these by
// signature; all mutations live in lib/actions.ts.

export type RelationState =
  | "self"
  | "none"
  | "friends"
  | "outgoing" // viewer sent a pending request
  | "incoming"; // viewer received a pending request

export async function getProfile(id: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { id } });
}

// Directory listing with optional name/network search.
export async function searchMembers(query?: string): Promise<User[]> {
  const q = query?.trim();
  return prisma.user.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { network: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { name: "asc" },
    take: 200,
  });
}

// Relationship of `viewerId` to `profileId`, for rendering the friend button.
export async function getRelationState(
  viewerId: string,
  profileId: string,
): Promise<RelationState> {
  if (viewerId === profileId) return "self";

  const fr = await prisma.friendship.findFirst({
    where: {
      OR: [
        { requesterId: viewerId, addresseeId: profileId },
        { requesterId: profileId, addresseeId: viewerId },
      ],
    },
  });
  if (!fr) return "none";
  if (fr.status === "ACCEPTED") return "friends";
  return fr.requesterId === viewerId ? "outgoing" : "incoming";
}

// Accepted friends of a user (either direction).
export async function getFriends(userId: string): Promise<User[]> {
  const friendships = await prisma.friendship.findMany({
    where: {
      status: "ACCEPTED",
      OR: [{ requesterId: userId }, { addresseeId: userId }],
    },
    include: { requester: true, addressee: true },
  });
  return friendships.map((f) =>
    f.requesterId === userId ? f.addressee : f.requester,
  );
}

export type IncomingRequest = { id: string; requester: User };

// Pending requests awaiting this user's response.
export async function getIncomingRequests(
  userId: string,
): Promise<IncomingRequest[]> {
  const rows = await prisma.friendship.findMany({
    where: { addresseeId: userId, status: "PENDING" },
    include: { requester: true },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((r) => ({ id: r.id, requester: r.requester }));
}

export type WallPostWithAuthor = WallPost & { author: User };

export async function getWallPosts(
  profileId: string,
): Promise<WallPostWithAuthor[]> {
  return prisma.wallPost.findMany({
    where: { profileId },
    include: { author: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}
