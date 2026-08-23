export const GAMIFY_SFX = {
  click: "/gamify/audio/click.mp3",
  hover: "/gamify/audio/hover.mp3",
  questDone: "/gamify/audio/quest-done.mp3",
  levelUp: "/gamify/audio/level-up.mp3",
  statLevelUp: "/gamify/audio/stat-level-up.mp3",
  save: "/gamify/audio/save.mp3",
  delete: "/gamify/audio/delete.mp3",
} as const;

export type GamifySfxName = keyof typeof GAMIFY_SFX;

export const GAMIFY_BG_MUSIC_SRC = "/gamify/audio/bg-music.mp3";
export const GAMIFY_SELECT_SRC = "/gamify/audio/select-gamify.mp3";

export const GAMIFY_MUTE_STORAGE_KEY = "midas-gamify-muted";
