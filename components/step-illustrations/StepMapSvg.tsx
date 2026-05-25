/**
 * StepMapSvg — landing-page mockup of the real GeoMap: tile-ish backdrop,
 * 1 km / 2 km rings, home pin, coloured school pins. Decorative.
 */
export function StepMapSvg() {
  const cx = 130;
  const cy = 80;
  const inner = 36;
  const outer = 68;
  // Coloured pins placed across the rings.
  const pins: { x: number; y: number; color: string }[] = [
    { x: cx + 18, y: cy - 16, color: "#1f7a56" }, // good, inside inner
    { x: cx - 22, y: cy + 10, color: "#1f7a56" }, // good, inside inner
    { x: cx + 30, y: cy + 28, color: "#b45a1d" }, // caution, on inner edge
    { x: cx - 48, y: cy - 22, color: "#b45a1d" }, // caution, in outer ring
    { x: cx + 56, y: cy - 30, color: "#a8362a" }, // unlikely, near outer edge
    { x: cx - 60, y: cy + 38, color: "#a8362a" }, // unlikely, near outer edge
  ];
  return (
    <svg
      viewBox="0 0 260 160"
      aria-hidden
      className="h-auto w-full"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <pattern id="map-grid" width="22" height="22" patternUnits="userSpaceOnUse">
          <rect width="22" height="22" fill="#f6efd9" />
          <path d="M22 0 L0 0 0 22" stroke="#ece2c4" strokeWidth="0.6" fill="none" />
        </pattern>
        <filter id="pin-shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="1" stdDeviation="0.6" floodOpacity="0.35" />
        </filter>
      </defs>

      <rect x="4" y="4" width="252" height="152" rx="10" fill="url(#map-grid)" stroke="#e7dfc9" strokeWidth="1" />

      {/* faint "road" strokes — purely decorative */}
      <path d="M0 60 Q 80 70 130 80 T 260 100" stroke="#d9cda4" strokeWidth="2" fill="none" opacity="0.55" />
      <path d="M40 0 Q 90 40 130 80 T 200 160" stroke="#d9cda4" strokeWidth="2" fill="none" opacity="0.55" />

      {/* 1 km good-zone ring */}
      <circle cx={cx} cy={cy} r={inner} fill="#1f7a56" fillOpacity="0.09" stroke="#1f7a56" strokeWidth="1" strokeDasharray="3 3" />
      {/* 2 km outer ring */}
      <circle cx={cx} cy={cy} r={outer} fill="none" stroke="#b89c5c" strokeWidth="1.25" />

      {/* home pin */}
      <g filter="url(#pin-shadow)">
        <circle cx={cx} cy={cy} r="6" fill="#13231d" stroke="#fbf7ee" strokeWidth="2.4" />
      </g>

      {/* school pins */}
      {pins.map((p, i) => (
        <g key={i} filter="url(#pin-shadow)">
          <circle cx={p.x} cy={p.y} r="5" fill={p.color} stroke="#fbf7ee" strokeWidth="1.6" />
        </g>
      ))}

      {/* ring labels */}
      <text x={cx + inner + 2} y={cy - inner + 4} fontSize="8" fill="#1f7a56" fontWeight="700" fontFamily="ui-sans-serif, system-ui">1 km</text>
      <text x={cx + outer - 4} y={cy - outer - 2} fontSize="8" fill="#8a6f2f" fontWeight="700" fontFamily="ui-sans-serif, system-ui">2 km</text>
    </svg>
  );
}
