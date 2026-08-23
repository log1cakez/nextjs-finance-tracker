"use client";

import { useState } from "react";
import type { GamifyStatSummary } from "@/app/actions/gamify-dashboard";
import { StatEditorModal } from "@/components/gamify/stat-editor-modal";
import { XpBar } from "@/components/gamify/xp-bar";

export function StatGrid({
  stats,
  leveledUpStatIds,
}: {
  stats: GamifyStatSummary[];
  leveledUpStatIds?: Set<string>;
}) {
  const [modal, setModal] = useState<null | { stat: GamifyStatSummary | null }>(null);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="pixel-font text-xs text-[var(--gb-magenta)]">CHARACTER STATS</h2>
        <button
          type="button"
          onClick={() => setModal({ stat: null })}
          className="pixel-btn pixel-corners-sm pixel-font px-3 py-1.5 text-[9px]"
        >
          + STAT
        </button>
      </div>
      {stats.length === 0 ? (
        <p className="pixel-panel pixel-corners p-4 text-xs text-[var(--gb-dim)]">
          No stats yet — add one (e.g. Trading, Strength, Wisdom) to start tagging quests.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {stats.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setModal({ stat: s })}
              className={`pixel-panel pixel-corners-sm min-w-0 p-3 text-left transition hover:brightness-110 ${
                leveledUpStatIds?.has(s.id) ? "gamify-stat-tile-leveled" : ""
              }`}
              style={{ borderColor: s.color }}
            >
              <div className="flex items-center justify-between">
                <span className="text-lg" aria-hidden>
                  {s.icon || "⭐"}
                </span>
                <span className="pixel-font text-[9px]" style={{ color: s.color }}>
                  LV {s.progress.level}
                </span>
              </div>
              <p className="mt-2 truncate text-xs font-semibold text-[var(--gb-text)]">{s.name}</p>
              <div className="mt-2">
                <XpBar progressPct={s.progress.progressPct} color={s.color} />
              </div>
              <p className="mt-1 text-[10px] text-[var(--gb-dim)]">{s.progress.totalXp.toLocaleString()} XP</p>
            </button>
          ))}
        </div>
      )}
      {modal ? <StatEditorModal initialStat={modal.stat} onClose={() => setModal(null)} /> : null}
    </div>
  );
}
