"use client";

interface Props {
  kind: "success" | "error" | "info";
  children: React.ReactNode;
  onRetry?: () => void;
  onDismiss?: () => void;
}

export default function Banner({ kind, children, onRetry, onDismiss }: Props) {
  return (
    <div className={`d-banner d-banner--${kind}`} role={kind === "error" ? "alert" : "status"}>
      <span>{children}</span>
      <span className="d-banner__actions">
        {onRetry && (
          <button type="button" className="d-btn d-btn--small" onClick={onRetry}>
            Retry
          </button>
        )}
        {onDismiss && (
          <button type="button" className="d-btn d-btn--ghost d-btn--small" onClick={onDismiss} aria-label="Dismiss message">
            ✕
          </button>
        )}
      </span>
    </div>
  );
}
