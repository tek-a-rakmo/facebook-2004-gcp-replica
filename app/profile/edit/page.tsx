import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import EditForm from "./edit-form";

export default async function EditProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  return (
    <>
      <div className="tf-subbar">Edit Profile</div>
      <EditForm user={user} />
    </>
  );
}
