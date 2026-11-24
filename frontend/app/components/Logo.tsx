// Inline SVG mark: no image files needed.
export default function Logo() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <svg width="44" height="40" viewBox="0 0 44 40" aria-hidden="true">
        <rect x="2" y="24" width="8" height="14" rx="1" fill="#4c8dff" />
        <rect x="14" y="16" width="8" height="22" rx="1" fill="#2f74f0" />
        <rect x="26" y="8" width="8" height="30" rx="1" fill="#1f5fd6" />
        <path d="M2 18 L16 8 L24 12 L42 2" stroke="#f5b301" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div style={{ lineHeight: 1.1 }}>
        <div style={{ fontSize: "1.6rem", fontWeight: 700 }}>FinTrack</div>
        <div style={{ fontSize: "0.85rem", opacity: 0.85 }}>by Finnet Technologies</div>
      </div>
    </div>
  );
}