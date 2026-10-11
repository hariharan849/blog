"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ApiError, apiRequest } from "@/lib/client-api";
import { alertError, buttonPrimary, card, cn, input, label } from "@/lib/ui";

type Mode = "login" | "register";

const FIELDS: Record<Mode, { name: string; label: string; type: string; autoComplete: string }[]> = {
  login: [
    { name: "username", label: "Username", type: "text", autoComplete: "username" },
    { name: "password", label: "Password", type: "password", autoComplete: "current-password" },
  ],
  register: [
    { name: "username", label: "Username", type: "text", autoComplete: "username" },
    { name: "email", label: "Email", type: "email", autoComplete: "email" },
    { name: "password1", label: "Password", type: "password", autoComplete: "new-password" },
    { name: "password2", label: "Confirm password", type: "password", autoComplete: "new-password" },
  ],
};

export default function AuthForm({ mode, next }: { mode: Mode; next: string }) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setFieldErrors({});
    try {
      await apiRequest(`/api/v1/auth/${mode}/`, "POST", { json: values });
      router.push(next);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFieldErrors(err.fields);
      } else {
        setError("Something went wrong. Please try again.");
      }
      setBusy(false);
    }
  }

  const isLogin = mode === "login";
  return (
    <div className="flex min-h-[calc(100vh-12rem)] items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="text-center">
          <h1 className="font-serif text-3xl font-semibold tracking-tight">{isLogin ? "Welcome back" : "Create your account"}</h1>
          <p className="mt-2 text-sm text-zinc-500">
            {isLogin ? "Sign in to comment and follow the discussion." : "Join to comment on posts."}
          </p>
        </div>
        <form onSubmit={submit} noValidate className={cn(card, "mt-8 space-y-4 p-6")}>
          {error && <div className={alertError} role="alert">{error}</div>}
          {FIELDS[mode].map((field) => (
            <div key={field.name}>
              <label htmlFor={field.name} className={label}>{field.label}</label>
              <input
                id={field.name}
                name={field.name}
                type={field.type}
                autoComplete={field.autoComplete}
                aria-invalid={!!fieldErrors[field.name]}
                className={cn(input, fieldErrors[field.name] && "border-red-400 focus:border-red-500 focus:ring-red-500/15")}
                value={values[field.name] ?? ""}
                onChange={(event) => setValues({ ...values, [field.name]: event.target.value })}
                required
              />
              {fieldErrors[field.name]?.map((message) => (
                <p className="mt-1.5 text-xs text-red-600 dark:text-red-400" key={message}>{message}</p>
              ))}
            </div>
          ))}
          <button type="submit" className={cn(buttonPrimary, "w-full py-2.5")} disabled={busy}>
            {busy ? "Please wait…" : isLogin ? "Login" : "Register"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-zinc-500">
          {isLogin ? (
            <>New here? <Link className="font-medium text-indigo-600 dark:text-indigo-400" href={`/register/?next=${encodeURIComponent(next)}`}>Register</Link></>
          ) : (
            <>Already have an account? <Link className="font-medium text-indigo-600 dark:text-indigo-400" href={`/login/?next=${encodeURIComponent(next)}`}>Login</Link></>
          )}
        </p>
      </div>
    </div>
  );
}
