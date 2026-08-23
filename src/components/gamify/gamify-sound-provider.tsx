"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  GAMIFY_BG_MUSIC_SRC,
  GAMIFY_MUTE_STORAGE_KEY,
  GAMIFY_SFX,
  type GamifySfxName,
} from "@/lib/gamify-sounds";

type GamifySoundApi = {
  play: (name: GamifySfxName) => void;
  muted: boolean;
  toggleMuted: () => void;
};

const GamifySoundContext = createContext<GamifySoundApi | null>(null);

const noop: GamifySoundApi = {
  play: () => {},
  muted: true,
  toggleMuted: () => {},
};

/** SFX that should briefly pause bg music so the celebration cue is heard clearly. */
const DUCKS_BG_MUSIC = new Set<GamifySfxName>(["levelUp", "statLevelUp"]);

/** Every SFX (not bg music, which loops freely) is cut off at this length. */
const SFX_MAX_MS = 5000;

export function useGamifySound(): GamifySoundApi {
  return useContext(GamifySoundContext) ?? noop;
}

export function GamifySoundProvider({ children }: { children: React.ReactNode }) {
  const sfxRef = useRef<Partial<Record<GamifySfxName, HTMLAudioElement>>>({});
  const sfxCleanupRef = useRef<Partial<Record<GamifySfxName, { timer: number; onEnded: () => void }>>>({});
  const bgRef = useRef<HTMLAudioElement | null>(null);
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(muted);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  useEffect(() => {
    setMounted(true);
    setMuted(window.localStorage.getItem(GAMIFY_MUTE_STORAGE_KEY) === "1");
  }, []);

  // Preload SFX once.
  useEffect(() => {
    for (const [name, src] of Object.entries(GAMIFY_SFX) as [GamifySfxName, string][]) {
      const el = new Audio(src);
      el.preload = "auto";
      el.volume = 0.55;
      sfxRef.current[name] = el;
    }
  }, []);

  const play = useCallback(
    (name: GamifySfxName) => {
      if (muted) return;
      const el = sfxRef.current[name];
      if (!el) return;

      // Clear any pending cap/cleanup from a previous play of this same SFX.
      const prevCleanup = sfxCleanupRef.current[name];
      if (prevCleanup) {
        window.clearTimeout(prevCleanup.timer);
        el.removeEventListener("ended", prevCleanup.onEnded);
        delete sfxCleanupRef.current[name];
      }

      // Level-up moments should be heard clearly — duck bg music while they play.
      const bg = bgRef.current;
      const didDuck = DUCKS_BG_MUSIC.has(name) && Boolean(bg) && !bg!.paused;
      if (didDuck) {
        bg!.pause();
      }

      const finish = () => {
        const active = sfxCleanupRef.current[name];
        if (active) {
          window.clearTimeout(active.timer);
          el.removeEventListener("ended", active.onEnded);
          delete sfxCleanupRef.current[name];
        }
        if (didDuck && !mutedRef.current) {
          void bg!.play().catch(() => {});
        }
      };
      const onEnded = () => finish();
      // Every SFX (not bg music) is capped at SFX_MAX_MS, even if the file itself is longer.
      const timer = window.setTimeout(() => {
        el.pause();
        finish();
      }, SFX_MAX_MS);
      sfxCleanupRef.current[name] = { timer, onEnded };
      el.addEventListener("ended", onEnded, { once: true });

      try {
        el.currentTime = 0;
        void el.play().catch(() => {});
      } catch {
        /* ignore playback errors (autoplay policy, interrupted play) */
      }
    },
    [muted],
  );

  const toggleMuted = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      window.localStorage.setItem(GAMIFY_MUTE_STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }, []);

  // Background music: create once, loop, try to autoplay, retry on first user gesture if blocked.
  useEffect(() => {
    if (!mounted) return;
    const el = new Audio(GAMIFY_BG_MUSIC_SRC);
    el.loop = true;
    el.volume = 0.3;
    bgRef.current = el;

    let cancelled = false;
    function tryPlay() {
      if (cancelled || muted) return;
      el.play().catch(() => {
        const resume = () => {
          if (!cancelled && !muted) void el.play().catch(() => {});
          window.removeEventListener("pointerdown", resume);
        };
        window.addEventListener("pointerdown", resume, { once: true });
      });
    }
    tryPlay();

    return () => {
      cancelled = true;
      el.pause();
      bgRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  useEffect(() => {
    const el = bgRef.current;
    if (!el) return;
    if (muted) {
      el.pause();
    } else {
      void el.play().catch(() => {});
    }
  }, [muted]);

  const api = useMemo<GamifySoundApi>(() => ({ play, muted, toggleMuted }), [play, muted, toggleMuted]);

  return <GamifySoundContext.Provider value={api}>{children}</GamifySoundContext.Provider>;
}
