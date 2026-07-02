import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { searchMembers } from "@/lib/queries";
import type { User } from "@prisma/client";

function MemberRow({ u }: { u: User }) {
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
      </div>
    </div>
  );
}

export default async function DirectoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const viewer = await getCurrentUser();
  if (!viewer) redirect("/");

  const { q } = await searchParams;
  const members = await searchMembers(q);

  return (
    <>
      <div className="tf-subbar">Member Directory</div>
      <div className="tf-box">
        <div className="tf-box-title">Search</div>
        <div className="tf-box-body">
          <form method="get">
            <input
              type="text"
              name="q"
              defaultValue={q ?? ""}
              placeholder="Search by name or network"
            />
            <button type="submit">Search</button>
          </form>
        </div>
      </div>

      <div className="tf-box">
        <div className="tf-box-title">Members</div>
        <div className="tf-box-body">
          <div className="tf-muted tf-small">{members.length} members</div>
          <hr className="tf-hr" />
          {members.length === 0 ? (
            <div className="tf-muted">No members found.</div>
          ) : (
            members.map((u) => <MemberRow key={u.id} u={u} />)
          )}
        </div>
      </div>
    </>
  );
}
