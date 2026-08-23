export function XpBar({
  progressPct,
  color,
  className = "",
}: {
  progressPct: number;
  color?: string;
  className?: string;
}) {
  return (
    <div className={`pixel-xp-track ${className}`}>
      <div
        className="pixel-xp-fill"
        style={{ width: `${Math.max(0, Math.min(100, progressPct))}%`, ["--fill-color" as string]: color }}
      />
    </div>
  );
}
