"use client";

import { useActionState } from "react";
import { register, type FormState } from "@/lib/actions";

const initial: FormState = {};

export default function RegisterForm() {
  const [state, action, pending] = useActionState(register, initial);

  return (
    <form action={action}>
      {state.error ? <p className="tf-error">{state.error}</p> : null}
      <label htmlFor="reg-name">Full Name</label>
      <input id="reg-name" type="text" name="name" required />
      <label htmlFor="reg-email">School Email (.edu)</label>
      <input
        id="reg-email"
        type="email"
        name="email"
        placeholder="you@harvard.edu"
        required
      />
      <label htmlFor="reg-password">Password</label>
      <input id="reg-password" type="password" name="password" required />
      <div className="tf-actions">
        <button type="submit" disabled={pending}>
          {pending ? "registering..." : "Register"}
        </button>
      </div>
    </form>
  );
}
