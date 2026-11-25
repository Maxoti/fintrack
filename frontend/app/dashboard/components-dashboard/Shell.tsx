"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { Briefcase, LogOut } from "lucide-react";
import Logo from "../../components/Logo";
import ThemeToggle from "../../components/ThemeToggle";
import { clearToken } from "../../lib/api";

const subscribe = (cb: () => void) => {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
};
const readToken = (): string | null | undefined => localStorage.getItem("token");
const serverToken = (): string | null | undefined => undefined; // unknown until hydrated

/** Reads email and expiry from the JWT payload. Display only: the API still verifies every request. */
function readSession(token: string): { email: string } | null {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]!.replace(/-/g, "+").replace(/_/g, "/")));
    if (typeof payload.exp === "number" && payload.exp * 1000 < Date.now()) return null;
    return { email: String(payload.email ?? "") };
  } catch {
    return null;
  }
}

export default function Shell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const token = useSyncExternalStore(subscribe, readToken, serverToken);
  const session = token ? readSession(token) : null;

  useEffect(() => {
    if (token === undefined) return; // still hydrating
    if (!session) {
      clearToken();
      router.replace("/login");
    }
  }, [token, session, router]);

  if (!session) {
    return (
      <p className="d-boot" role="status">
        Loading…
      </p>
    );
  }

  const logout = () => {
    clearToken();
    router.replace("/login");
  };

  return (
    <div className="d-app">
      <a className="d-skip" href="#main">
        Skip to content
      </a>
      <aside className="d-side">
        <Link href="/dashboard" aria-label="FinTrack home">
          <Logo />
        </Link>
        <nav aria-label="Main" className="d-nav-list">
          <Link href="/dashboard" className="d-nav" aria-current={pathname.startsWith("/dashboard") ? "page" : undefined}>
            <Briefcase size={18} aria-hidden="true" /> Portfolios
          </Link>
          <button type="button" className="d-nav" onClick={logout}>
            <LogOut size={18} aria-hidden="true" /> Log out
          </button>
        </nav>
        <p className="d-tagline">Track. Grow. Achieve.</p>
      </aside>
      <div className="d-main">
        <header className="d-top">
          <span>
            <strong>FinTrack</strong> by Finnet Technologies
          </span>
          <span className="d-top__right">
            <span className="d-user">{session.email}</span>
            <ThemeToggle />
          </span>
        </header>
        <main id="main" className="d-content">
          {children}
        </main>
      </div>
    </div>
  );
}
