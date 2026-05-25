/**
 * StepVerdictSvg — three stacked verdict rows mirroring the look of the
 * real VerdictPill + BallotBars on the results page. Decorative.
 */
type Row = {
  tone: "good" | "caution" | "unlikely";
  label: string;
  school: string;
  bars: ("good" | "caution" | "unlikely")[];
};

const TONE: Record<Row["tone"], { fg: string; bg: string }> = {
  good:     { fg: "#1f7a56", bg: "#e0f0e8" },
  caution:  { fg: "#b45a1d", bg: "#fbeada" },
  unlikely: { fg: "#a8362a", bg: "#f8dad5" },
};

const ROWS: Row[] = [
  { tone: "good",     label: "LIKELY",     school: "Tampines Primary",   bars: ["good","good","good","caution","good"] },
  { tone: "caution",  label: "BORDERLINE", school: "Angsana Primary",    bars: ["caution","good","caution","caution","unlikely"] },
  { tone: "unlikely", label: "UNLIKELY",   school: "Kong Hwa School",    bars: ["unlikely","unlikely","unlikely","caution","unlikely"] },
];

export function StepVerdictSvg() {
  return (
    <svg
      viewBox="0 0 260 160"
      aria-hidden
      className="h-auto w-full"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <filter id="card-shadow" x="-5%" y="-10%" width="110%" height="140%">
          <feDropShadow dx="0" dy="1.2" stdDeviation="1.4" floodOpacity="0.08" />
        </filter>
      </defs>
      {ROWS.map((row, i) => {
        const y = 6 + i * 50;
        const { fg, bg } = TONE[row.tone];
        return (
          <g key={row.label} filter="url(#card-shadow)" transform={`translate(0 ${y})`}>
            <rect x="6" y="0" width="248" height="44" rx="9" fill="#fffcf4" stroke="#e7dfc9" strokeWidth="1" />
            {/* pill */}
            <rect x="14" y="9" width="74" height="18" rx="9" fill={bg} stroke={fg} strokeWidth="1" />
            <circle cx="22" cy="18" r="2.6" fill={fg} />
            <text x="29" y="22" fontSize="9" fontWeight="700" fill={fg} fontFamily="ui-sans-serif, system-ui" letterSpacing="0.5">
              {row.label}
            </text>
            {/* school name */}
            <text x="14" y="38" fontSize="9.5" fill="#1b1812" fontWeight="600" fontFamily="ui-sans-serif, system-ui">
              {row.school}
            </text>
            {/* ballot mini bars */}
            <g transform="translate(160 9)">
              <text x="0" y="-1" fontSize="6.5" fill="#7b7466" fontFamily="ui-sans-serif, system-ui" letterSpacing="0.5">
                BALLOT 2021-25
              </text>
              {row.bars.map((b, j) => (
                <rect
                  key={j}
                  x={j * 17}
                  y="4"
                  width="13"
                  height={b === "good" ? 14 : b === "caution" ? 22 : 30}
                  rx="2"
                  fill={TONE[b].fg}
                  opacity="0.85"
                />
              ))}
              <line x1="-2" y1="34" x2="86" y2="34" stroke="#e7dfc9" strokeWidth="1" />
            </g>
          </g>
        );
      })}
    </svg>
  );
}
