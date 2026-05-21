"use client";

import { useId, useRef } from "react";
import { useFocusTrap } from "@/lib/useFocusTrap";
import type { NearbySchool, Phase } from "@/lib/types";
import { SchoolDetailPanel } from "./SchoolDetailPanel";

/**
 * Responsive detail container: a side drawer beside the map on desktop, a
 * bottom sheet over the map on mobile. The map stays visible behind it.
 */
export function SchoolDetailShell({
  school,
  phase,
  onClose,
}: {
  school: NearbySchool;
  phase: Phase;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useFocusTrap(panelRef, true, onClose);

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="anim-fade absolute inset-0 bg-ink/35 lg:bg-ink/15"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={
          "detail-panel-anim fixed flex flex-col overflow-hidden bg-paper shadow-2xl outline-none " +
          "inset-x-0 bottom-0 max-h-[85vh] rounded-t-2xl " +
          "lg:inset-y-0 lg:left-auto lg:right-0 lg:max-h-none lg:w-[460px] lg:rounded-none lg:border-l lg:border-line"
        }
      >
        <SchoolDetailPanel
          school={school}
          phase={phase}
          onClose={onClose}
          titleId={titleId}
        />
      </div>
    </div>
  );
}
