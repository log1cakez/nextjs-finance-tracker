"use client";

import { RetroModal } from "@/components/gamify/retro-modal";

function Section({
  title,
  color,
  children,
}: {
  title: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div className="pixel-panel pixel-corners-sm p-3">
      <p className="pixel-font text-[10px]" style={{ color }}>
        {title}
      </p>
      <div className="mt-2 space-y-1.5 text-xs leading-relaxed text-[var(--gb-text)]">{children}</div>
    </div>
  );
}

export function GamifyHelpModal({ onClose }: { onClose: () => void }) {
  return (
    <RetroModal title="HOW TO PLAY" onClose={onClose} widthClassName="max-w-xl">
      <div className="max-h-[65vh] space-y-3 overflow-y-auto pr-1">
        <Section title="THE BASICS" color="var(--gb-cyan)">
          <p>
            Create <strong>Stats</strong> (like Strength or Wisdom) and <strong>Quests</strong> tagged to
            them. Completing a quest awards XP to both your character and that stat.
          </p>
        </Section>

        <Section title="QUESTS" color="var(--gb-magenta)">
          <p>
            <strong>Daily</strong> quests reset every day — optionally restrict them to specific weekdays
            (e.g. only Mon/Wed/Fri) in the quest form.
          </p>
          <p>
            <strong>Weekly</strong> quests reset every Sunday. <strong>Monthly</strong> quests reset on the
            1st of the month.
          </p>
          <p>Quests not due today still show up (dimmed) so you can find and edit them anytime.</p>
        </Section>

        <Section title="STATS" color="var(--gb-yellow)">
          <p>
            Stats are your own custom trackers — add, rename, recolor, or delete them anytime. Each one
            levels up independently from the XP earned by quests tagged to it.
          </p>
        </Section>

        <Section title="LEVELING & RANKS" color="var(--gb-green)">
          <p>
            Both your character and each stat use the same curve: level N needs 250 × N × (N−1) total XP.
            Leveling up earns a Rank title (Greenhorn → Ascendant One) — see them all under 🏆 RANKS.
          </p>
        </Section>

        <Section title="STREAKS" color="var(--gb-cyan)">
          <p>
            Complete at least one quest a day to keep your streak alive — it doesn&apos;t break the moment
            a new day starts, only if a full day passes with nothing done. Your last ~10 weeks of activity
            show as a heatmap under the streak counter.
          </p>
        </Section>

        <Section title="XP MODES" color="var(--gb-magenta)">
          <p>
            <strong>Auto</strong> (default): suggested XP for new quests scales with your level, so
            rewards stay meaningful as you grow. <strong>Manual</strong>: always suggests fixed XP (10
            daily / 50 weekly / 200 monthly). Switch modes in ⚙️ SETTINGS — either way you can still type
            your own XP per quest.
          </p>
        </Section>

        <Section title="SOUND" color="var(--gb-yellow)">
          <p>
            Toggle music and sound effects with the speaker icon. Your preference is remembered on this
            device.
          </p>
        </Section>
      </div>
    </RetroModal>
  );
}
