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
        strokeWidth="1.75"
      />
      <path d="M16 3.5 L19.8 15 L16 16 Z" fill="currentColor" />
      <path d="M16 28.5 L12.2 17 L16 16 Z" fill="currentColor" opacity="0.4" />
      <circle cx="16" cy="16" r="2.4" fill="currentColor" />
      <circle cx="16" cy="16" r="0.9" fill="#fbf7ee" />
    </svg>
  );
}
