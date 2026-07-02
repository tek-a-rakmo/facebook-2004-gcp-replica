import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getProfile, getRelationState, getWallPosts } from "@/lib/queries";
import { sendRequest, postToWall } from "@/lib/actions";
import type { User } from "@prisma/client";

const INFO_FIELDS: { label: string; key: keyof User }[] = [
  { label: "Concentration", key: "concentration" },
  { label: "Hometown", key: "hometown" },
  { label: "High School", key: "highSchool" },
  { label: "Residence", key: "residence" },
  { label: "Birthday", key: "birthday" },
  { label: "Relationship Status", key: "relationshipStatus" },
  { label: "Interested In", key: "interestedIn" },
  { label: "Looking For", key: "lookingFor" },
  { label: "About Me", key: "aboutMe" },
  { label: "Favorite Books", key: "favoriteBooks" },
  { label: "Favorite Music", key: "favoriteMusic" },
  { label: "Favorite Movies", key: "favoriteMovies" },
  { label: "Courses", key: "courses" },
];

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const viewer = await getCurrentUser();
  if (!viewer) redirect("/");

  const profile = await getProfile(id);
  if (!profile) notFound();

  const rel = await getRelationState(viewer.id, profile.id);
  const wallPosts = await getWallPosts(profile.id);

  const rows = INFO_FIELDS.map((f) => ({
    label: f.label,
    value: profile[f.key] as string | null,
  })).filter((r) => r.value != null && r.value !== "");

  return (
    <>
      <div className="tf-subbar">Profile</div>

      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        <div style={{ flex: "0 0 auto" }}>
          {profile.photoUrl ? (
            <img
              className="tf-photo"
              src={profile.photoUrl}
              width={180}
              alt={profile.name}
            />
          ) : (
            <div
              className="tf-photo tf-muted"
              style={{
                width: 180,
                height: 180,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#eee",
              }}
            >
              no photo
            </div>
          )}
        </div>

        <div style={{ flex: "1 1 auto" }}>
          <h1>{profile.name}</h1>
          <div className="tf-muted">{profile.network}</div>

          <div className="tf-actions">
            {rel === "self" && <a href="/profile/edit">Edit My Profile</a>}
            {rel === "none" && (
              <form action={sendRequest}>
                <input type="hidden" name="addresseeId" value={profile.id} />
                <button type="submit">Add to Friends</button>
              </form>
            )}
            {rel === "outgoing" && (
              <span className="tf-muted">Friend Request Pending</span>
            )}
            {rel === "incoming" && (
              <span className="tf-muted">
                Respond to this request on your{" "}
                <a href="/friends">friends page</a>.
              </span>
            )}
            {rel === "friends" && <span>&#10003; You are friends</span>}
          </div>

          <div className="tf-box" style={{ marginTop: 12 }}>
            <div className="tf-box-title">Information</div>
            <div className="tf-box-body">
              {rows.length === 0 ? (
                <span className="tf-muted">
                  This member hasn&apos;t filled out their profile yet.
                </span>
              ) : (
                <table className="tf-info">
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.label}>
                        <th>{r.label}:</th>
                        <td>{r.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="tf-box">
        <div className="tf-box-title">The Wall</div>
        <div className="tf-box-body">
          <form action={postToWall}>
            <input type="hidden" name="profileId" value={profile.id} />
            <textarea name="body" required placeholder="Write something..." />
            <div className="tf-actions">
              <button type="submit">Post</button>
            </div>
          </form>

          <hr className="tf-hr" />

          {wallPosts.length === 0 ? (
            <span className="tf-muted">
              The wall is empty. Be the first to write something!
            </span>
          ) : (
            wallPosts.map((post) => (
              <div className="tf-wall-post" key={post.id}>
                <div>{post.body}</div>
                <div className="tf-wall-meta">
                  <Link href={`/profile/${post.author.id}`}>
                    {post.author.name}
                  </Link>{" "}
                  &middot; {new Date(post.createdAt).toLocaleString()}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
