import { rankTierForLevel } from "@/lib/gamify-rank";

/** 11x9 pixel grid for a classic retro ghost/blob mascot. X = body, O = eye. */
const SPRITE = [
  "...XXXXX...",
  "..XXXXXXX..",
  ".XXXXXXXXX.",
  "XXXXXXXXXXX",
  "XXXXXXXXXXX",
  "XXXOXXXOXXX",
  "XXXXXXXXXXX",
  "XXXXXXXXXXX",
  "XX.XX.XX.XX",
];

const CELL = 6;
const COLS = SPRITE[0].length;
const ROWS = SPRITE.length;
const PAD = 14;
const WIDTH = COLS * CELL + PAD * 2;
const HEIGHT = ROWS * CELL + PAD * 2;

export function RankAvatar({
  level,
  size = 72,
}: {
  level: number;
  /** Number (px) or any CSS length, e.g. "clamp(56px, 16vw, 72px)" for fluid sizing. */
  size?: number | string;
}) {
  const tier = rankTierForLevel(level);

  const cells: { x: number; y: number; color: string }[] = [];
  SPRITE.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch === "X") cells.push({ x, y, color: tier.primary });
      if (ch === "O") cells.push({ x, y, color: tier.eye });
    });
  });

  return (
    <div
      className="rank-avatar-wrap"
      style={{ width: size, height: size, ["--rank-glow" as string]: tier.glow }}
    >
      {tier.ring ? <span className="rank-avatar-ring" style={{ borderColor: tier.glow }} /> : null}
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        width="100%"
        height="100%"
        role="img"
        aria-label={`${tier.name} rank avatar`}
        className={`rank-avatar-sprite ${tier.shimmer ? "rank-avatar-shimmer" : ""}`}
      >
        {tier.wings ? (
          <>
            <polygon
              points={`${PAD - 2},${PAD + 18} ${PAD - 14},${PAD + 10} ${PAD - 12},${PAD + 26} ${PAD - 2},${PAD + 30}`}
              fill={tier.glow}
              opacity={0.85}
            />
            <polygon
              points={`${WIDTH - PAD + 2},${PAD + 18} ${WIDTH - PAD + 14},${PAD + 10} ${WIDTH - PAD + 12},${PAD + 26} ${WIDTH - PAD + 2},${PAD + 30}`}
              fill={tier.glow}
              opacity={0.85}
            />
          </>
        ) : null}
        {tier.crown ? (
          <>
            <rect x={PAD + 2 * CELL} y={PAD - CELL} width={CELL} height={CELL} fill={tier.eye} />
            <rect x={PAD + 5 * CELL} y={PAD - CELL * 1.6} width={CELL} height={CELL * 1.6} fill={tier.eye} />
            <rect x={PAD + 8 * CELL} y={PAD - CELL} width={CELL} height={CELL} fill={tier.eye} />
          </>
        ) : null}
        {cells.map((c) => (
          <rect
            key={`${c.x}-${c.y}`}
            x={PAD + c.x * CELL}
            y={PAD + c.y * CELL}
            width={CELL}
            height={CELL}
            fill={c.color}
          />
        ))}
      </svg>
    </div>
  );
}
