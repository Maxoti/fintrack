"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, Lock } from "lucide-react";
import AuthShell from "../components/AuthShell";
import TextField from "../components/TextField";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

function LoginForm() {
  const router = useRouter();
  const justRegistered = useSearchParams().get("registered") === "1";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (!email.trim()) next.email = "Email is required";
    else if (!/^\S+@\S+\.\S+$/.test(email)) next.email = "Enter a valid email address";
    if (!password) next.password = "Password is required";
    setErrors(next);
    setFormError("");
    if (Object.keys(next).length) return;

    setLoading(true);
    try {
      const res = await fetch(`${API}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message ?? "Login failed. Check your details and try again.");
      localStorage.setItem("token", data.token);
      router.push("/dashboard");
    } catch (err) {
      // fetch() rejects with a TypeError when the API is unreachable or blocked by CORS
      if (err instanceof TypeError) {
        setFormError("Can't reach the server. Check your connection and try again.");
      } else {
        setFormError(err instanceof Error ? err.message : "Something went wrong. Try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      headline={<>Welcome back</>}
      blurb="Sign in to access your portfolios and continue your financial journey."
    >
      <h2>Login to FinTrack</h2>
      <p className="sub">Enter your credentials to continue.</p>
      <form onSubmit={onSubmit} noValidate>
        {justRegistered && !formError && (
          <div className="alert alert--success" role="status">Account created. Please log in.</div>
        )}
        {formError && <div className="alert" role="alert">{formError}</div>}
        <TextField id="email" label="Email address" type="email" icon={<Mail size={18} />} value={email} onChange={setEmail} error={errors.email} autoComplete="email" />
        <TextField id="password" label="Password" type="password" icon={<Lock size={18} />} value={password} onChange={setPassword} error={errors.password} autoComplete="current-password" />
        <button className="btn" type="submit" disabled={loading}>{loading ? "Signing in…" : "Login"}</button>
      </form>
      <p className="auth__switch">Don&apos;t have an account? <Link href="/register">Register here</Link></p>
    </AuthShell>
  );
}

// useSearchParams() must sit inside a Suspense boundary or `next build` fails.
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}