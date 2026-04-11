"use client";

import { useCallback, useState } from "react";
import {
  FloatingBottomNavShell,
  floatingNavItemClass,
} from "@/components/floating-nav-bar";
import { EOD_SECTION_IDS } from "@/lib/eod-section-ids";

const ITEMS: { id: string; label: string }[] = [
  { id: EOD_SECTION_IDS.accounts, label: "Accounts" },
  { id: EOD_SECTION_IDS.pnlCalendar, label: "P&L calendar" },
  { id: EOD_SECTION_IDS.journalTable, label: "Journal table" },
  { id: EOD_SECTION_IDS.aiReview, label: "AI month review" },
  { id: EOD_SECTION_IDS.analytics, label: "Analytics" },
];

export function EodSectionNav() {
  const [active, setActive] = useState<string>(EOD_SECTION_IDS.accounts);

  const go = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setActive(id);
  }, []);

  return (
    <FloatingBottomNavShell aria-label="Trading dashboard sections">
      {ITEMS.map((item) => {
        const isActive = active === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => go(item.id)}
            className={`touch-manipulation ${floatingNavItemClass(isActive)}`}
          >
            {item.label}
          </button>
        );
      })}
    </FloatingBottomNavShell>
  );
}
