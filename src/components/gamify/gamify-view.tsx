"use client";

import { useEffect, useRef, useState } from "react";
import type { GamifyDashboardData, GamifyQuestSummary } from "@/app/actions/gamify-dashboard";
import { useCenterToast } from "@/components/center-toast";
import { CharacterPanel } from "@/components/gamify/character-panel";
import { GamifyHelpModal } from "@/components/gamify/gamify-help-modal";
import { GamifySettingsModal } from "@/components/gamify/gamify-settings-modal";
import { GamifySoundProvider, useGamifySound } from "@/components/gamify/gamify-sound-provider";
import { pixelFont } from "@/components/gamify/gamify-font";
import { LevelUpBurst } from "@/components/gamify/level-up-burst";
import { QuestEditorModal } from "@/components/gamify/quest-editor-modal";
import { QuestSection } from "@/components/gamify/quest-section";
import { RanksModal } from "@/components/gamify/ranks-modal";
import { StatGrid } from "@/components/gamify/stat-grid";
import { StreakHeatmap } from "@/components/gamify/streak-heatmap";
import { useGamifyUiSounds } from "@/components/gamify/use-gamify-ui-sounds";

function MuteToggle() {
  const { muted, toggleMuted } = useGamifySound();
  return (
    <button
      type="button"
      onClick={toggleMuted}
      aria-label={muted ? "Unmute sound" : "Mute sound"}
      title={muted ? "Unmute sound" : "Mute sound"}
      className="pixel-btn pixel-corners-sm flex h-8 w-8 shrink-0 items-center justify-center text-sm"
    >
      {muted ? "🔇" : "🔊"}
    </button>
  );
}

function GamifyViewInner({ data }: { data: GamifyDashboardData }) {
  const { play } = useGamifySound();
  const uiSounds = useGamifyUiSounds();
  const { showToast } = useCenterToast();
  const prevLevelRef = useRef(data.character.level);
  const prevStatLevelsRef = useRef<Map<string, number>>(
    new Map(data.stats.map((s) => [s.id, s.progress.level])),
  );
  const [questModal, setQuestModal] = useState<null | { quest: GamifyQuestSummary | null }>(null);
  const [showRanks, setShowRanks] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [levelUpKey, setLevelUpKey] = useState(0);
  const [shaking, setShaking] = useState(false);
  const [leveledUpStatIds, setLeveledUpStatIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const leveledUp = data.character.level > prevLevelRef.current;
    prevLevelRef.current = data.character.level;
    if (!leveledUp) return;

    showToast({
      kind: "success",
      title: "LEVEL UP!",
      message: `${data.characterName} reached Level ${data.character.level}!`,
      timeoutMs: 3200,
    });
    play("levelUp");
    setLevelUpKey((k) => k + 1);
    setShaking(true);
    const t = setTimeout(() => setShaking(false), 450);
    return () => clearTimeout(t);
  }, [data.character.level, data.characterName, showToast, play]);

  useEffect(() => {
    const prevLevels = prevStatLevelsRef.current;
    const leveled = new Set<string>();
    for (const s of data.stats) {
      const prev = prevLevels.get(s.id);
      if (prev !== undefined && s.progress.level > prev) {
        leveled.add(s.id);
      }
      prevLevels.set(s.id, s.progress.level);
    }
    if (leveled.size > 0) {
      play("statLevelUp");
      setLeveledUpStatIds(leveled);
      const t = setTimeout(() => setLeveledUpStatIds(new Set()), 1200);
      return () => clearTimeout(t);
    }
  }, [data.stats, play]);

  return (
    <div
      className={`gamify-root min-w-0 ${pixelFont.variable} ${shaking ? "gamify-shaking" : ""}`}
      {...uiSounds}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowRanks(true)}
            className="pixel-btn pixel-corners-sm pixel-font flex items-center gap-1.5 px-3 py-1.5 text-[9px]"
          >
            🏆 RANKS
          </button>
          <button
            type="button"
            onClick={() => setShowSettings(true)}
            aria-label="Settings"
            title="Settings"
            className="pixel-btn pixel-corners-sm flex h-8 w-8 shrink-0 items-center justify-center text-sm"
          >
            ⚙️
          </button>
          <button
            type="button"
            onClick={() => setShowHelp(true)}
            aria-label="How to play"
            title="How to play"
            className="pixel-btn pixel-corners-sm flex h-8 w-8 shrink-0 items-center justify-center text-sm"
          >
            ❓
          </button>
        </div>
        <MuteToggle />
      </div>
      <div className="space-y-6">
        <CharacterPanel characterName={data.characterName} character={data.character} />
        <StreakHeatmap activity={data.activity} />
        <StatGrid stats={data.stats} leveledUpStatIds={leveledUpStatIds} />
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="pixel-font text-xs text-[var(--gb-cyan)]">QUESTS</h2>
            <button
              type="button"
              onClick={() => setQuestModal({ quest: null })}
              className="pixel-btn pixel-corners-sm pixel-font px-3 py-1.5 text-[9px]"
            >
              + NEW QUEST
            </button>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <QuestSection section={data.daily} onEditQuest={(quest) => setQuestModal({ quest })} />
            <QuestSection section={data.weekly} onEditQuest={(quest) => setQuestModal({ quest })} />
            <QuestSection section={data.monthly} onEditQuest={(quest) => setQuestModal({ quest })} />
          </div>
        </div>
      </div>
      {questModal ? (
        <QuestEditorModal
          initialQuest={questModal.quest}
          stats={data.stats}
          defaultCadence={questModal.quest?.cadence ?? "daily"}
          xpMode={data.xpMode}
          characterLevel={data.character.level}
          onClose={() => setQuestModal(null)}
        />
      ) : null}
      {showRanks ? <RanksModal currentLevel={data.character.level} onClose={() => setShowRanks(false)} /> : null}
      {showSettings ? (
        <GamifySettingsModal xpMode={data.xpMode} onClose={() => setShowSettings(false)} />
      ) : null}
      {showHelp ? <GamifyHelpModal onClose={() => setShowHelp(false)} /> : null}
      <LevelUpBurst trigger={levelUpKey} level={data.character.level} name={data.characterName} />
      {/* Modals portal here (not document.body) so they still see the --gb-* theme vars. */}
      <div id="gamify-portal-root" />
    </div>
  );
}

export function GamifyView({ data }: { data: GamifyDashboardData }) {
  return (
    <GamifySoundProvider>
      <GamifyViewInner data={data} />
    </GamifySoundProvider>
  );
}
