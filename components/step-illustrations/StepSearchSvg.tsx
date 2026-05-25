/**
 * StepSearchSvg — landing-page illustration of the postal search
 * typeahead. Mirrors the real `PostalSearch` typeahead aesthetic at a
 * glance. Decorative; the surrounding copy carries the meaning.
 */
export function StepSearchSvg() {
  return (
    <svg
      viewBox="0 0 260 160"
      aria-hidden
      className="h-auto w-full"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <filter id="search-shadow" x="-10%" y="-10%" width="120%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.08" />
        </filter>
      </defs>

      {/* search input */}
      <g filter="url(#search-shadow)">
        <rect x="8" y="8" width="244" height="30" rx="8" fill="#fffcf4" stroke="#e7dfc9" strokeWidth="1.25" />
        {/* pin icon */}
        <g transform="translate(18 14)" stroke="#7b7466" strokeWidth="1.4" fill="none" strokeLinejoin="round">
          <path d="M9 16 s-5-4-5-9 a5 5 0 0 1 10 0 c0 5 -5 9 -5 9 z" />
          <circle cx="9" cy="7.2" r="1.7" fill="#7b7466" stroke="none" />
        </g>
        <text x="36" y="28" fontFamily="ui-sans-serif, system-ui" fontSize="11" fill="#1b1812">
          Tampines St 21
        </text>
        <rect x="223" y="14" width="20" height="18" rx="4" fill="#0e5346" />
        <path d="M229 23 l4 0 m-2 -2 l2 2 -2 2" stroke="#fffcf4" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>

      {/* dropdown */}
      <g filter="url(#search-shadow)" transform="translate(0 46)">
        <rect x="8" y="0" width="244" height="106" rx="8" fill="#fffcf4" stroke="#e7dfc9" strokeWidth="1" />

        {/* highlighted row */}
        <rect x="10" y="2" width="240" height="32" rx="6" fill="#f2e8cf" opacity="0.7" />
        <g transform="translate(20 12)" fill="#7b7466">
          <circle cx="6" cy="8" r="2.6" />
          <path d="M6 0 c-3.3 0 -6 2.7 -6 6 c0 4 6 11 6 11 s6 -7 6 -11 c0 -3.3 -2.7 -6 -6 -6 z" fill="none" stroke="#7b7466" strokeWidth="1.2" />
        </g>
        <text x="36" y="14" fontSize="10" fill="#1b1812" fontWeight="600">238 <tspan fontWeight="700">Tampines</tspan> Street 21</text>
        <text x="36" y="26" fontSize="8.5" fill="#7b7466">Singapore 521238</text>

        {/* row 2 */}
        <g transform="translate(20 47)" fill="#7b7466">
          <path d="M6 0 c-3.3 0 -6 2.7 -6 6 c0 4 6 11 6 11 s6 -7 6 -11 c0 -3.3 -2.7 -6 -6 -6 z" fill="none" stroke="#7b7466" strokeWidth="1.2" />
          <circle cx="6" cy="6" r="2.2" />
        </g>
        <text x="36" y="48" fontSize="10" fill="#1b1812">Tampines MRT Station</text>
        <text x="36" y="60" fontSize="8.5" fill="#7b7466">Singapore 529536</text>

        {/* row 3 */}
        <g transform="translate(20 81)" fill="#7b7466">
          <path d="M6 0 c-3.3 0 -6 2.7 -6 6 c0 4 6 11 6 11 s6 -7 6 -11 c0 -3.3 -2.7 -6 -6 -6 z" fill="none" stroke="#7b7466" strokeWidth="1.2" />
          <circle cx="6" cy="6" r="2.2" />
        </g>
        <text x="36" y="82" fontSize="10" fill="#1b1812">238B <tspan fontWeight="700">Tampines</tspan> Street 21</text>
        <text x="36" y="94" fontSize="8.5" fill="#7b7466">Singapore 522238</text>
      </g>
    </svg>
  );
}
