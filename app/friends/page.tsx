import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getFriends, getIncomingRequests } from "@/lib/queries";
import { respondRequest } from "@/lib/actions";
import type { User } from "@prisma/client";

function MemberRow({ u, children }: { u: User; children?: React.ReactNode }) {
  return (
    <div className="tf-member">
      {u.photoUrl ? (
        <img className="tf-photo" width={50} src={u.photoUrl} alt={u.name} />
      ) : (
        <div
          className="tf-photo tf-muted tf-small"
          style={{ width: 50, height: 50, textAlign: "center" }}
        >
          no photo
        </div>
      )}
      <div>
        <a className="tf-member-name" href={"/profile/" + u.id}>
          {u.name}
        </a>
        <div className="tf-muted tf-small">
          {u.network}
          {u.concentration ? " · " + u.concentration : ""}
        </div>
        {children}
      </div>
    </div>
  );
}

export default async function FriendsPage() {
  const viewer = await getCurrentUser();
  if (!viewer) redirect("/");

  const requests = await getIncomingRequests(viewer.id);
  const friends = await getFriends(viewer.id);

  return (
    <>
      <div className="tf-subbar">My Friends</div>

      <div className="tf-box">
        <div className="tf-box-title">Friend Requests</div>
        <div className="tf-box-body">
          {requests.length === 0 ? (
            <div className="tf-muted">No pending friend requests.</div>
          ) : (
            requests.map((req) => (
              <MemberRow key={req.id} u={req.requester}>
                <div className="tf-actions">
                  <form action={respondRequest}>
                    <input
                      type="hidden"
                      name="friendshipId"
                      value={req.id}
                    />
                    <input type="hidden" name="accept" value="true" />
                    <button>Confirm</button>
                  </form>
                  <form action={respondRequest}>
                    <input
                      type="hidden"
                      name="friendshipId"
                      value={req.id}
                    />
                    <input type="hidden" name="accept" value="false" />
                    <button>Reject</button>
                  </form>
                </div>
              </MemberRow>
            ))
          )}
        </div>
      </div>

      <div className="tf-box">
        <div className="tf-box-title">My Friends</div>
        <div className="tf-box-body">
          {friends.length === 0 ? (
            <div className="tf-muted">
              You haven&apos;t added any friends yet. Find people in the
              directory.
            </div>
          ) : (
            friends.map((u) => <MemberRow key={u.id} u={u} />)
          )}
        </div>
      </div>
    </>
  );
}
