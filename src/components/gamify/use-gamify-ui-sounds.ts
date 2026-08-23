import { useRef } from "react";
import { useGamifySound } from "@/components/gamify/gamify-sound-provider";

/** Delegated click/hover SFX for every `<button>` inside the wrapped element. */
export function useGamifyUiSounds() {
  const { play } = useGamifySound();
  const lastHovered = useRef<Element | null>(null);

  return {
    onClickCapture: (e: React.MouseEvent) => {
      const target = e.target as Element;
      if (target.closest("button")) {
        play("click");
      }
    },
    onMouseOverCapture: (e: React.MouseEvent) => {
      const target = e.target as Element;
      const btn = target.closest("button");
      if (btn && btn !== lastHovered.current) {
        lastHovered.current = btn;
        play("hover");
      } else if (!btn) {
        lastHovered.current = null;
      }
    },
  };
}
