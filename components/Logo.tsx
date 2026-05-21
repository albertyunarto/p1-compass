export function CompassMark({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      role="img"
      aria-label="P1 Compass"
    >
      <circle
        cx="16"
        cy="16"
        r="14"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path d="M16 4 L19.2 14.4 L16 16 Z" fill="currentColor" />
      <path d="M16 28 L12.8 17.6 L16 16 Z" fill="currentColor" opacity="0.45" />
      <circle cx="16" cy="16" r="2.4" fill="currentColor" />
    </svg>
  );
}
