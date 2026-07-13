"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setError(null);

    const supabase = createClient();
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setStatus("error");
      return;
    }

    setStatus("sent");
  }

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <Link href="/" className="mono text-xs uppercase tracking-widest" style={{ color: "var(--signal)" }}>
          NetPulse AI
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">Create your account</h1>
        <p className="mt-2 text-sm" style={{ color: "var(--text-dim)" }}>
          No sales call. Sign up and go straight to uploading your spreadsheet.
        </p>

        {status === "sent" ? (
          <div className="card p-5 mt-8">
            <p className="text-sm">
              Check <span className="font-medium">{email}</span> for a confirmation
              link to finish signing up.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div>
              <label htmlFor="email" className="text-sm block mb-1.5">
                Work email
              </label>
              <input
                id="email"
                type="email"
                required
                className="input-field"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
            <div>
              <label htmlFor="password" className="text-sm block mb-1.5">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                className="input-field"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>

            {error && (
              <p className="text-sm" style={{ color: "var(--danger)" }}>
                {error}
              </p>
            )}

            <button type="submit" className="btn-primary w-full" disabled={status === "loading"}>
              {status === "loading" ? "Creating account…" : "Create account"}
            </button>
          </form>
        )}

        <p className="mt-6 text-sm" style={{ color: "var(--text-dim)" }}>
          Already have an account?{" "}
          <Link href="/login" className="underline">
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}
