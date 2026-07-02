import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import RegisterForm from "./register-form";

export default async function RegisterPage() {
  const user = await getCurrentUser();
  if (user) redirect("/directory");

  return (
    <div>
      <div className="tf-subbar">Register for thefacebook</div>
      <div className="tf-box" style={{ maxWidth: 340 }}>
        <div className="tf-box-title">Create an account</div>
        <div className="tf-box-body">
          <RegisterForm />
          <hr className="tf-hr" />
          <p className="tf-small">
            Already a member? <Link href="/">Login</Link>
          </p>
        </div>
      </div>
      <p className="tf-small tf-muted">
        You must use a valid college email ending in .edu.
      </p>
    </div>
  );
}
