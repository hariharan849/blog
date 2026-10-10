"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ApiError, apiRequest } from "@/lib/client-api";

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

  return (
    <div className="row justify-content-center">
      <div className="col-md-6 col-lg-5">
        <div className="card shadow-sm">
          <div className="card-body p-4">
            <h1 className="h3 text-center mb-4">{mode === "login" ? "Login" : "Create an account"}</h1>
            {error && <div className="alert alert-danger">{error}</div>}
            <form onSubmit={submit} noValidate>
              {FIELDS[mode].map((field) => (
                <div className="mb-3" key={field.name}>
                  <label htmlFor={field.name} className="form-label">{field.label}</label>
                  <input
                    id={field.name}
                    name={field.name}
                    type={field.type}
                    autoComplete={field.autoComplete}
                    className={`form-control${fieldErrors[field.name] ? " is-invalid" : ""}`}
                    value={values[field.name] ?? ""}
                    onChange={(event) => setValues({ ...values, [field.name]: event.target.value })}
                    required
                  />
                  {fieldErrors[field.name]?.map((message) => (
                    <div className="invalid-feedback" key={message}>{message}</div>
                  ))}
                </div>
              ))}
              <button type="submit" className="btn btn-primary w-100" disabled={busy}>
                {busy ? "Please wait…" : mode === "login" ? "Login" : "Register"}
              </button>
            </form>
            <p className="text-center mt-3 mb-0">
              {mode === "login" ? (
                <>Don&apos;t have an account? <Link href={`/register/?next=${encodeURIComponent(next)}`}>Register</Link></>
              ) : (
                <>Already have an account? <Link href={`/login/?next=${encodeURIComponent(next)}`}>Login</Link></>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
