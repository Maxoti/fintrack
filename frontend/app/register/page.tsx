"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { User, Mail, Phone, Lock } from "lucide-react";
import AuthShell from "../components/AuthShell";
import TextField from "../components/TextField";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type FieldKey = "name" | "email" | "phone" | "password";
const FIELDS: FieldKey[] = ["name", "email", "phone", "password"];

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", confirm: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const lenOk = form.password.length >= 8;
  const mixOk = /\d/.test(form.password) && /[A-Za-z]/.test(form.password);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!form.name.trim()) next.name = "Full name is required";
    if (!form.email.trim()) next.email = "Email is required";
    else if (!/^\S+@\S+\.\S+$/.test(form.email)) next.email = "Enter a valid email address";
    if (!lenOk || !mixOk) next.password = "Use at least 8 characters with a number and a letter";
    if (form.confirm !== form.password) next.confirm = "Passwords do not match";
    setErrors(next);
    setFormError("");
    if (Object.keys(next).length) return;

    setLoading(true);
    try {
      const res = await fetch(`${API}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, email: form.email, phone: form.phone || undefined, password: form.password }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const apiErr = data?.error;

        // Duplicate email -> show it under the email field
        if (apiErr?.code === "EMAIL_TAKEN") {
          setErrors({ email: apiErr.message });
          return;
        }
        // Server-side validation errors -> show each under its own field
        const details = apiErr?.details as Record<string, string[]> | undefined;
        if (details) {
          const mapped: Record<string, string> = {};
          for (const key of FIELDS) if (details[key]?.[0]) mapped[key] = details[key][0];
          if (Object.keys(mapped).length) {
            setErrors(mapped);
            return;
          }
        }
        throw new Error(apiErr?.message ?? "Registration failed. Try again.");
      }

      router.push("/login?registered=1");
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
      headline={<>Take control of your finances</>}
      blurb="Track your investments, monitor performance and grow your wealth with FinTrack."
      showFeatures
    >
      <h2>Create your account</h2>
      <p className="sub">Join FinTrack and start your investment journey today.</p>
      <form onSubmit={onSubmit} noValidate>
        {formError && <div className="alert" role="alert">{formError}</div>}
        <TextField id="name" label="Full name" icon={<User size={18} />} value={form.name} onChange={set("name")} error={errors.name} autoComplete="name" />
        <TextField id="email" label="Email address" type="email" icon={<Mail size={18} />} value={form.email} onChange={set("email")} error={errors.email} autoComplete="email" />
        <TextField id="phone" label="Phone number (optional)" type="tel" icon={<Phone size={18} />} value={form.phone} onChange={set("phone")} error={errors.phone} autoComplete="tel" />
        <TextField id="password" label="Password" type="password" icon={<Lock size={18} />} value={form.password} onChange={set("password")} error={errors.password} autoComplete="new-password" />
        <TextField id="confirm" label="Confirm password" type="password" icon={<Lock size={18} />} value={form.confirm} onChange={set("confirm")} error={errors.confirm} autoComplete="new-password" />
        <ul className="hint">
          <li data-ok={lenOk}>{lenOk ? "✓" : "○"} Password must be at least 8 characters</li>
          <li data-ok={mixOk}>{mixOk ? "✓" : "○"} Include a number and a letter</li>
        </ul>
        <button className="btn" type="submit" disabled={loading}>{loading ? "Creating account…" : "Register"}</button>
      </form>
      <p className="auth__switch">Already have an account? <Link href="/login">Login here</Link></p>
    </AuthShell>
  );
}