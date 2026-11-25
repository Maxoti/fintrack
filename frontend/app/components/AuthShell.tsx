import Logo from "./Logo";
import ThemeToggle from "./ThemeToggle";

type Props = {
  headline: React.ReactNode;
  blurb: string;
  showFeatures?: boolean;
  children: React.ReactNode;
};

export default function AuthShell({ headline, blurb, showFeatures, children }: Props) {
  return (
    <div className="auth">
      <section className="auth__brand">
        <div className="auth__top">
          <Logo />
          <div className="auth__top-right">
            <p className="auth__tagline">Track. Grow. Achieve.</p>
            <ThemeToggle />
          </div>
        </div>
        <div className="auth__hero">
          <h1>{headline}</h1>
          <p>{blurb}</p>
          {showFeatures && (
            <ul className="auth__features">
              <li>Portfolio Management</li>
              <li>Real-Time Analytics</li>
              <li>Secure &amp; Reliable</li>
            </ul>
          )}
        </div>
      </section>
      <main className="auth__panel">
        <div className="auth__card">{children}</div>
      </main>
      <footer className="auth__footer">
        <span>Your data is secure with FinTrack</span>
        <span>FinTrack by Finnet Technologies © 2026. All rights reserved.</span>
      </footer>
    </div>
  );
}
