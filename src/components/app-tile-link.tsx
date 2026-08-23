"use client";

import Link from "next/link";

export function AppTileLink({
  href,
  className,
  children,
  clickSoundSrc,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
  clickSoundSrc?: string;
}) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => {
        if (!clickSoundSrc) return;
        try {
          void new Audio(clickSoundSrc).play().catch(() => {});
        } catch {
          /* ignore playback errors */
        }
      }}
    >
      {children}
    </Link>
  );
}
