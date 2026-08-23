/** Rank title shown next to the character's level, one per level 1-100. */
export const RANK_TITLES: readonly string[] = [
  // 1–10: Novice
  "Greenhorn",
  "Wanderer",
  "Initiate",
  "Apprentice",
  "Trainee",
  "Pathfinder",
  "Seeker",
  "Aspirant",
  "Journeyman",
  "Adept",
  // 11–20: Skilled
  "Vanguard",
  "Rover",
  "Duelist",
  "Tracker",
  "Sentinel",
  "Ranger",
  "Blade",
  "Striker",
  "Marksman",
  "Warden",
  // 21–30: Veteran
  "Veteran",
  "Outrider",
  "Stalker",
  "Bladesworn",
  "Shadowhand",
  "Ironclad",
  "Stormbringer",
  "Nightblade",
  "Bloodguard",
  "Warbringer",
  // 31–40: Expert
  "Expert",
  "Battlelord",
  "Runeblade",
  "Frostguard",
  "Emberwarden",
  "Dreadknight",
  "Doomhunter",
  "Grimwalker",
  "Voidstalker",
  "Soulreaver",
  // 41–50: Elite
  "Elite",
  "Warchief",
  "Battlemaster",
  "Dragonheart",
  "Stormlord",
  "Nightreaver",
  "Shadowmonarch",
  "Ironwraith",
  "Bloodmoon",
  "Deathbringer",
  // 51–60: Master
  "Master",
  "Grandblade",
  "Runeforger",
  "Voidbreaker",
  "Skyshatterer",
  "Doomweaver",
  "Chaosbane",
  "Soulforge",
  "Netherwalker",
  "Titanslayer",
  // 61–70: Grandmaster
  "Grandmaster",
  "Warlord",
  "Godslayer",
  "Astralknight",
  "Etherblade",
  "Fatereaper",
  "Worldbreaker",
  "Starforged",
  "Voidmonarch",
  "Eternalguard",
  // 71–80: Legend
  "Legend",
  "Mythborn",
  "Ashenlord",
  "Skyrend",
  "Oblivionwalker",
  "Dawnbreaker",
  "Duskweaver",
  "Starforger",
  "Realmshaker",
  "Timeless",
  // 81–90: Mythic
  "Mythic",
  "Divinewrath",
  "Celestial",
  "Abyssal Sovereign",
  "Empyreal",
  "Chronolord",
  "Voidsovereign",
  "Astral Ascendant",
  "Worldsoul",
  "Eternal Flame",
  // 91–100: Transcendent
  "Transcendent",
  "Cosmic Herald",
  "Fatesworn",
  "Realmforger",
  "Godtouched",
  "Infinity Warden",
  "Omniblade",
  "Origin Sovereign",
  "Apex Immortal",
  "Ascendant One",
];

/** Levels beyond 100 keep the level-100 title. */
export function rankTitleForLevel(level: number): string {
  const idx = Math.min(Math.max(Math.trunc(level), 1), RANK_TITLES.length) - 1;
  return RANK_TITLES[idx];
}

/** One entry per 10-level tier (Novice, Skilled, ... Transcendent) — drives the avatar's look. */
export type RankTier = {
  name: string;
  primary: string;
  eye: string;
  glow: string;
  ring: boolean;
  wings: boolean;
  crown: boolean;
  shimmer: boolean;
};

export const RANK_TIERS: readonly RankTier[] = [
  { name: "Novice", primary: "#8a8a9e", eye: "#e8e8ff", glow: "#8a8a9e", ring: false, wings: false, crown: false, shimmer: false },
  { name: "Skilled", primary: "#52a8ff", eye: "#ffffff", glow: "#52a8ff", ring: false, wings: false, crown: false, shimmer: false },
  { name: "Veteran", primary: "#52ff9d", eye: "#ffffff", glow: "#52ff9d", ring: false, wings: false, crown: false, shimmer: false },
  { name: "Expert", primary: "#a78bfa", eye: "#ffffff", glow: "#a78bfa", ring: false, wings: false, crown: false, shimmer: false },
  { name: "Elite", primary: "#ff6b6b", eye: "#ffe14d", glow: "#ff6b6b", ring: false, wings: false, crown: false, shimmer: false },
  { name: "Master", primary: "#4deaff", eye: "#ffffff", glow: "#4deaff", ring: true, wings: false, crown: false, shimmer: false },
  { name: "Grandmaster", primary: "#ff5cd6", eye: "#ffe14d", glow: "#ff5cd6", ring: true, wings: false, crown: false, shimmer: false },
  { name: "Legend", primary: "#ffe14d", eye: "#ff5cd6", glow: "#ffe14d", ring: true, wings: true, crown: false, shimmer: false },
  { name: "Mythic", primary: "#f2f4ff", eye: "#4deaff", glow: "#f2f4ff", ring: true, wings: true, crown: false, shimmer: true },
  { name: "Transcendent", primary: "#ffd76b", eye: "#fff6df", glow: "#ffd76b", ring: true, wings: true, crown: true, shimmer: true },
] as const;

export function rankTierForLevel(level: number): RankTier {
  const clamped = Math.min(Math.max(Math.trunc(level), 1), 100);
  const idx = Math.min(9, Math.floor((clamped - 1) / 10));
  return RANK_TIERS[idx];
}
