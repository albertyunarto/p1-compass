"use client";

/** Star toggle for adding/removing a school from the shortlist. */
export function StarButton({
  active,
  onToggle,
  className = "",
}: {
  active: boolean;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={active ? "Remove from shortlist" : "Add to shortlist"}
      title={active ? "Remove from shortlist" : "Add to shortlist"}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={
        "shrink-0 rounded leading-none transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 " +
        (active ? "text-primary" : "text-ink-muted hover:text-primary") +
        " " +
        className
      }
    >
      <span aria-hidden className="text-lg">
        {active ? "★" : "☆"}
      </span>
    </button>
  );
}
