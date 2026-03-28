"use client";

import { useEffect, useState } from "react";

/** True when viewport width is below `maxWidthPx` (default: &lt; 640px). */
export function useIsNarrow(maxWidthPx = 640) {
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${maxWidthPx - 1}px)`);
    const sync = () => setNarrow(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [maxWidthPx]);

  return narrow;
}
