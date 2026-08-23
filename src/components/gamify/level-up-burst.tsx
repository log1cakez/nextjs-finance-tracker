"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const PARTICLE_COLORS = ["#4deaff", "#ff5cd6", "#ffe14d", "#52ff9d", "#ff6b6b", "#a78bfa"];
const PARTICLE_COUNT = 26;
const BURST_MS = 2200;

export function LevelUpBurst({ trigger, level, name }: { trigger: number; level: number; name: string }) {
  const [show, setShow] = useState(false);
  const firstRun = useRef(true);

  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    setShow(true);
    const t = setTimeout(() => setShow(false), BURST_MS);
    return () => clearTimeout(t);
  }, [trigger]);

  if (!show) return null;
  const portalTarget = document.getElementById("gamify-portal-root");
  if (!portalTarget) return null;

  const particles = Array.from({ length: PARTICLE_COUNT }, (_, i) => {
    const angle = (360 / PARTICLE_COUNT) * i + (i % 2 === 0 ? 6 : -6);
    const dist = 110 + (i % 4) * 26;
    const size = 5 + (i % 3) * 3;
    const delay = (i % 5) * 0.03;
    const spin = 180 + (i % 3) * 120;
    return { angle, dist, size, delay, spin, color: PARTICLE_COLORS[i % PARTICLE_COLORS.length] };
  });

  return createPortal(
    <div className="gamify-levelup-burst" aria-live="polite">
      <span className="gamify-levelup-flash" />
      <span className="gamify-levelup-rays" />
      <span className="gamify-levelup-ring gamify-levelup-ring-1" />
      <span className="gamify-levelup-ring gamify-levelup-ring-2" />
      {particles.map((p, i) => (
        <span
          key={i}
          className="gamify-levelup-particle"
          style={{
            ["--angle" as string]: `${p.angle}deg`,
            ["--dist" as string]: `${p.dist}px`,
            ["--p-color" as string]: p.color,
            ["--size" as string]: `${p.size}px`,
            ["--delay" as string]: `${p.delay}s`,
            ["--spin" as string]: `${p.spin}deg`,
          }}
        />
      ))}
      <div className="gamify-levelup-label pixel-font">
        <span className="gamify-levelup-spark" aria-hidden>
          ◆
        </span>
        LEVEL UP!
        <span className="gamify-levelup-spark" aria-hidden>
          ◆
        </span>
        <span className="sub">
          {name} reached Level {level}
        </span>
      </div>
    </div>,
    portalTarget,
  );
}
