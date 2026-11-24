"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, Lock } from "lucide-react";
import AuthShell from "../components/AuthShell";
import TextField from "../components/TextField";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function LoginPage() {
  const router = useRouter();
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
      setFormError(err instanceof Error ? err.message : "Something went wrong. Try again.");
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
        {formError && <div className="alert" role="alert">{formError}</div>}
        <TextField id="email" label="Email address" type="email" icon={<Mail size={18} />} value={email} onChange={setEmail} error={errors.email} autoComplete="email" />
        <TextField id="password" label="Password" type="password" icon={<Lock size={18} />} value={password} onChange={setPassword} error={errors.password} autoComplete="current-password" />
        <div className="row">
          <label><input type="checkbox" defaultChecked /> Remember me</label>
          <Link href="/forgot-password">Forgot password?</Link>
        </div>
        <button className="btn" type="submit" disabled={loading}>{loading ? "Signing in…" : "Login"}</button>
      </form>
      <p className="auth__switch">Don&apos;t have an account? <Link href="/register">Register here</Link></p>
    </AuthShell>
  );
}