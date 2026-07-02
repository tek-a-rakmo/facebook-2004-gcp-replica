import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import LoginForm from "./login-form";

export default async function Home() {
  const user = await getCurrentUser();
  if (user) redirect("/directory");

  return (
    <div>
      <div className="tf-subbar">Welcome to thefacebook</div>
      <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          <p>
            Thefacebook is an online directory that connects people through
            social networks at colleges.
          </p>
          <p>
            We have opened up thefacebook for popular consumption at your
            university. You can use thefacebook to:
          </p>
          <ul>
            <li>Search for people at your school</li>
            <li>Find out who is in your classes</li>
            <li>Look up your friends&apos; friends</li>
            <li>See a visualization of your social network</li>
          </ul>
          <p className="tf-muted tf-small">
            To get started, register with your school email address, then login
            below.
          </p>
        </div>
        <div className="tf-box" style={{ width: 300 }}>
          <div className="tf-box-title">Login</div>
          <div className="tf-box-body">
            <LoginForm />
            <hr className="tf-hr" />
            <p className="tf-small">
              Don&apos;t have an account?{" "}
              <Link href="/register">Register for thefacebook</Link>
            </p>
          </div>
        </div>
      </div>
      <hr className="tf-hr" />
      <p className="tf-small tf-muted" style={{ textAlign: "center" }}>
        A Mark Zuckerberg production. Thefacebook &copy; 2004
      </p>
    </div>
  );
}
