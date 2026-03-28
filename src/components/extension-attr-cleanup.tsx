"use client";

import { useEffect } from "react";

/** Strips extension-injected body attrs (e.g. ColorZilla) that cause hydration noise. */
export function ExtensionAttrCleanup() {
  useEffect(() => {
    try {
      document.body.removeAttribute("cz-shortcut-listen");
    } catch {
      // ignore
    }
  }, []);
  return null;
}
