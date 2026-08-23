"use client";

import { useActionState, useEffect, useState } from "react";
import { updateGamifyCharacterName, type GamifyProfileActionState } from "@/app/actions/gamify-profile";
import { useCenterToast, useToastOnActionError } from "@/components/center-toast";
import { RankAvatar } from "@/components/gamify/rank-avatar";
import { XpBar } from "@/components/gamify/xp-bar";
import type { LevelProgress } from "@/lib/gamify-level";
import { rankTitleForLevel } from "@/lib/gamify-rank";

const initial: GamifyProfileActionState = {};

export function CharacterPanel({
  characterName,
  character,
}: {
  characterName: string;
  character: LevelProgress;
}) {
  const [state, formAction, pending] = useActionState(updateGamifyCharacterName, initial);
  const { showToast } = useCenterToast();
  useToastOnActionError(state.error, pending, "Could not update name");
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState(characterName);

  useEffect(() => {
    if (state.success) {
      setEditing(false);
      showToast({ kind: "success", title: "Name updated", timeoutMs: 1600 });
    }
  }, [state.success, showToast]);

  return (
    <div className="pixel-panel pixel-corners p-5 sm:p-6">
      <div className="flex items-start gap-4">
        <RankAvatar level={character.level} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              {editing ? (
                <form action={formAction} className="flex items-center gap-2">
                  <input
                    name="characterName"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    autoFocus
                    maxLength={40}
                    className="pixel-font w-40 border-2 border-[var(--gb-border)] bg-[var(--gb-panel-alt)] px-2 py-1.5 text-[10px] text-[var(--gb-text)] outline-none focus:border-[var(--gb-cyan)] sm:w-56"
                  />
                  <button
                    type="submit"
                    disabled={pending}
                    className="pixel-btn pixel-corners-sm pixel-font px-3 py-1.5 text-[9px] text-[var(--gb-green)]"
                  >
                    {pending ? "…" : "OK"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(false);
                      setNameInput(characterName);
                    }}
                    className="text-xs text-[var(--gb-dim)] hover:text-[var(--gb-text)]"
                  >
                    Cancel
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="pixel-font truncate text-left text-sm text-[var(--gb-yellow)] hover:underline sm:text-base"
                  title="Click to rename"
                >
                  {characterName}
                </button>
              )}
              <p className="pixel-font mt-2 text-[10px] text-[var(--gb-dim)]">
                LEVEL {character.level}{" "}
                <span className="text-[var(--gb-magenta)]">· {rankTitleForLevel(character.level)}</span>
              </p>
            </div>
            <div className="text-left sm:text-right">
              <p className="pixel-font text-[10px] text-[var(--gb-cyan)]">
                {character.totalXp.toLocaleString()} XP
              </p>
            </div>
          </div>
          <div className="mt-4">
            <div className="mb-1 flex justify-between text-[10px] text-[var(--gb-dim)]">
              <span>
                {character.xpIntoLevel} / {character.xpForNextLevel} XP to next level
              </span>
              <span>{character.progressPct}%</span>
            </div>
            <XpBar progressPct={character.progressPct} color="var(--gb-cyan)" />
          </div>
        </div>
      </div>
    </div>
  );
}
