import type { Metadata } from "next";
import { CompareView } from "@/components/CompareView";

export const metadata: Metadata = {
  title: "Compare your shortlist",
  description:
    "Compare your shortlisted Singapore primary schools side by side — distance, ballot trends and Phase verdicts in one table.",
};

export default function ComparePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <CompareView />
    </div>
  );
}
