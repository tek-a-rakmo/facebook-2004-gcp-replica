import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { getCurrentUser } from "@/lib/auth";
import { logout } from "@/lib/actions";

export const metadata: Metadata = {
  title: "thefacebook",
  description: "A Mark Zuckerberg production.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();

  return (
    <html lang="en">
      <body>
        <div className="tf-header">
          <div className="tf-header-inner">
            <Link
              href={user ? "/directory" : "/"}
              className="tf-wordmark"
            >
              [ thefacebook ]
            </Link>
            <nav className="tf-nav">
              {user ? (
                <>
                  <Link href="/directory">directory</Link>
                  <Link href="/friends">my friends</Link>
                  <Link href={`/profile/${user.id}`}>my profile</Link>
                  <Link href="/profile/edit">edit</Link>
                  <form action={logout}>
                    <button type="submit">logout</button>
                  </form>
                </>
              ) : (
                <>
                  <Link href="/">login</Link>
                  <Link href="/register">register</Link>
                </>
              )}
            </nav>
          </div>
        </div>
        <div className="tf-container">{children}</div>
      </body>
    </html>
  );
}
