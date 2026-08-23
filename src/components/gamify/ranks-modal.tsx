"use client";

import { RankAvatar } from "@/components/gamify/rank-avatar";
import { RetroModal } from "@/components/gamify/retro-modal";
import { totalXpForLevel } from "@/lib/gamify-level";
import { RANK_TIERS, RANK_TITLES } from "@/lib/gamify-rank";

export function RanksModal({ currentLevel, onClose }: { currentLevel: number; onClose: () => void }) {
  return (
    <RetroModal title="RANKS" onClose={onClose} widthClassName="max-w-xl">
      <div className="max-h-[65vh] space-y-4 overflow-y-auto pr-1">
        {RANK_TIERS.map((tier, tierIdx) => {
          const startLevel = tierIdx * 10 + 1;
          const endLevel = tierIdx * 10 + 10;
          const isCurrentTier = currentLevel >= startLevel && currentLevel <= endLevel;

          return (
            <div
              key={tier.name}
              className="pixel-panel pixel-corners-sm p-3"
              style={isCurrentTier ? { borderColor: tier.glow } : undefined}
            >
              <div className="flex items-center gap-3">
                <RankAvatar level={startLevel} size={40} />
                <div className="min-w-0">
                  <p className="pixel-font text-[10px]" style={{ color: tier.primary }}>
                    {tier.name.toUpperCase()}
                  </p>
                  <p className="mt-1 text-[10px] text-[var(--gb-dim)]">
                    Levels {startLevel}–{endLevel}
                  </p>
                </div>
              </div>
              <ul className="mt-2 space-y-0.5">
                {Array.from({ length: 10 }, (_, i) => {
                  const level = startLevel + i;
                  const title = RANK_TITLES[level - 1];
                  const isCurrent = level === currentLevel;
                  return (
                    <li
                      key={level}
                      className={`flex items-center justify-between gap-2 px-2 py-1 text-xs ${
                        isCurrent ? "pixel-corners-sm bg-[var(--gb-panel-alt)]" : ""
                      }`}
                    >
                      <span
                        className={
                          isCurrent
                            ? "pixel-font truncate text-[9px] text-[var(--gb-yellow)]"
                            : "truncate text-[var(--gb-text)]"
                        }
                      >
                        Lv {level} — {title}
                        {isCurrent ? " ◀ YOU" : ""}
                      </span>
                      <span className="shrink-0 text-[10px] text-[var(--gb-dim)]">
                        {totalXpForLevel(level).toLocaleString()} XP
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </RetroModal>
  );
}
