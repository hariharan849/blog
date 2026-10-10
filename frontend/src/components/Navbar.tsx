"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { apiRequest } from "@/lib/client-api";
import type { User } from "@/lib/types";

export default function Navbar({ user }: { user: User | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function logout() {
    await apiRequest("/api/v1/auth/logout/", "POST");
    router.push("/");
    router.refresh();
  }

  return (
    <nav className="navbar navbar-expand-lg navbar-dark navbar-brand-gradient">
      <div className="container">
        <Link className="navbar-brand fw-bold" href="/">
          PyChanter
        </Link>
        <button
          className="navbar-toggler"
          type="button"
          aria-label="Toggle navigation"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          <span className="navbar-toggler-icon" />
        </button>
        <div className={`collapse navbar-collapse${open ? " show" : ""}`}>
          <ul className="navbar-nav me-auto">
            <li className="nav-item">
              <Link className="nav-link" href="/">Home</Link>
            </li>
            <li className="nav-item">
              <Link className="nav-link" href="/about/hariharan/">About</Link>
            </li>
            {user?.is_superuser && (
              <li className="nav-item">
                <Link className="nav-link" href="/add/">New Post</Link>
              </li>
            )}
            {user?.is_staff && (
              <li className="nav-item">
                <Link className="nav-link" href="/bytes/">Daily Bytes</Link>
              </li>
            )}
          </ul>
          <form className="d-flex my-2 my-lg-0" action="/search/" method="get" role="search">
            <input className="form-control me-2" type="search" name="q" placeholder="Search posts..." aria-label="Search" />
            <button className="btn btn-outline-light" type="submit">Search</button>
          </form>
          <ul className="navbar-nav ms-lg-3">
            {user ? (
              <>
                <li className="nav-item">
                  <span className="nav-link disabled text-light">Hi, {user.name}</span>
                </li>
                <li className="nav-item">
                  <button className="btn btn-link nav-link" type="button" onClick={logout}>Logout</button>
                </li>
              </>
            ) : (
              <>
                <li className="nav-item">
                  <Link className="nav-link" href="/login/">Login</Link>
                </li>
                <li className="nav-item">
                  <Link className="nav-link" href="/register/">Register</Link>
                </li>
              </>
            )}
          </ul>
        </div>
      </div>
    </nav>
  );
}
