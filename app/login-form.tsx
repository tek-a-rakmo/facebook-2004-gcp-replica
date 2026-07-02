"use client";

import { useActionState } from "react";
import { login, type FormState } from "@/lib/actions";

const initial: FormState = {};

export default function LoginForm() {
  const [state, action, pending] = useActionState(login, initial);

  return (
    <form action={action}>
      {state.error ? <p className="tf-error">{state.error}</p> : null}
      <label htmlFor="login-email">Email</label>
      <input id="login-email" type="email" name="email" required />
      <label htmlFor="login-password">Password</label>
      <input id="login-password" type="password" name="password" required />
      <div className="tf-actions">
        <button type="submit" disabled={pending}>
          {pending ? "logging in..." : "Login"}
        </button>
      </div>
    </form>
  );
}
