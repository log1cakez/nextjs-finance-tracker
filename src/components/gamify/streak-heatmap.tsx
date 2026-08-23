import type { GamifyActivity, GamifyActivityDay } from "@/app/actions/gamify-dashboard";

function intensityColor(count: number): string {
  if (count <= 0) return "var(--gb-track-bg)";
  if (count === 1) return "color-mix(in srgb, var(--gb-cyan) 35%, var(--gb-track-bg))";
  if (count <= 3) return "color-mix(in srgb, var(--gb-cyan) 65%, var(--gb-track-bg))";
  return "var(--gb-cyan)";
}

export function StreakHeatmap({ activity }: { activity: GamifyActivity }) {
  const weeks: GamifyActivityDay[][] = [];
  for (let i = 0; i < activity.heatmap.length; i += 7) {
    weeks.push(activity.heatmap.slice(i, i + 7));
  }

  return (
    <div className="pixel-panel pixel-corners p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xl" aria-hidden>
            🔥
          </span>
          <div>
            <p className="pixel-font text-xs text-[var(--gb-yellow)]">
              {activity.streakDays} DAY{activity.streakDays === 1 ? "" : "S"}
            </p>
            <p className="mt-1 text-[10px] text-[var(--gb-dim)]">Current streak</p>
          </div>
        </div>
        <div className="flex gap-[3px] overflow-x-auto pb-1">
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[3px]">
              {week.map((d) => (
                <span
                  key={d.date}
                  title={`${d.date} — ${d.count} quest${d.count === 1 ? "" : "s"} done`}
                  className="block h-[10px] w-[10px]"
                  style={{ background: intensityColor(d.count) }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
