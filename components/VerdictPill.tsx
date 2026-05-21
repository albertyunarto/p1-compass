import { TONE_COLOR, type InsightTone } from "@/lib/insight";

const SIZE = {
  sm: "px-2 py-0.5 text-[10.5px]",
  md: "px-2.5 py-1 text-[11.5px]",
  lg: "px-3.5 py-1.5 text-[13px]",
};

/** Solid-fill rounded verdict label, coloured by insight tone. */
export function VerdictPill({
  tone,
  label,
  size = "md",
}: {
  tone: InsightTone;
  label: string;
  size?: keyof typeof SIZE;
}) {
  return (
    <span
      style={{ background: TONE_COLOR[tone] }}
      className={`inline-block whitespace-nowrap rounded-full font-bold text-white ${SIZE[size]}`}
    >
      {label}
    </span>
  );
}
