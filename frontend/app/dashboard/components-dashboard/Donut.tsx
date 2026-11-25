import { pct } from "../../lib/format";

const COLORS = ["#123f9c", "#f5b301", "#0a7d3c", "#7c3aed", "#0891b2", "#be185d", "#ea580c", "#5b6678"];
export const sliceColor = (i: number) => COLORS[i % COLORS.length]!;

interface Slice {
  label: string;
  pct: number;
}

/** Allocation donut. Percentages are also written out in the legend, so colour is never the only cue. */
export default function Donut({ slices }: { slices: Slice[] }) {
  const total = slices.reduce((s, x) => s + x.pct, 0) || 1;
  const arcs = slices.map((s, i) => {
    const before = slices.slice(0, i).reduce((sum, x) => sum + x.pct, 0);
    const len = (s.pct / total) * 100;
    return (
      <circle
        key={s.label}
        cx="21"
        cy="21"
        r="15.9155"
        fill="none"
        stroke={sliceColor(i)}
        strokeWidth="6"
        strokeDasharray={`${len} ${100 - len}`}
        strokeDashoffset={25 - (before / total) * 100} // 25 = start at 12 o'clock
      />
    );
  });

  return (
    <div className="d-donut">
      <svg viewBox="0 0 42 42" role="img" aria-label={`Allocation: ${slices.map((s) => `${s.label} ${pct(s.pct)}`).join(", ")}`}>
        <circle cx="21" cy="21" r="15.9155" fill="none" stroke="#e8edf6" strokeWidth="6" />
        {arcs}
        <text x="21" y="22.5" textAnchor="middle" fontSize="5" fontWeight="700" fill="#111827">
          {slices.length}
        </text>
        <text x="21" y="27" textAnchor="middle" fontSize="2.6" fill="#5b6678">
          {slices.length === 1 ? "holding" : "holdings"}
        </text>
      </svg>
      <ul className="d-legend">
        {slices.map((s, i) => (
          <li key={s.label}>
            <span className="d-swatch" style={{ background: sliceColor(i) }} aria-hidden="true" />
            <span>{s.label}</span>
            <strong>{pct(s.pct)}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}
