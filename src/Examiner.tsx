import { useEffect, useRef } from "react";

/**
 * The live examiner's face.
 *
 * Built from the product's own tile geometry rather than a cartoon mascot —
 * a mascot is an explicit anti-goal for this audience. The head is a girih
 * tile with cut corners; the mouth is a row of bars that follows the real
 * audio, so when the examiner speaks the face speaks with it.
 *
 * Amplitude arrives through a CSS custom property rather than React state:
 * this updates every animation frame, and re-rendering a component sixty
 * times a second to move a mouth would cost far more than it is worth.
 */
export type ExaminerPhase = "paused" | "connecting" | "speaking" | "listening" | "thinking";

const BARS = 5;

export default function Examiner({ phase, levelRef }: { phase: ExaminerPhase; levelRef: { current: number } }) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      root.current?.style.setProperty("--level", "0.35");
      return;
    }
    let raf = 0;
    let shown = 0;
    const tick = () => {
      // Ease toward the measured level so a single loud frame does not snap
      // the mouth open; attack faster than release, as a voice does.
      const target = levelRef.current;
      shown += (target - shown) * (target > shown ? 0.45 : 0.14);
      root.current?.style.setProperty("--level", shown.toFixed(3));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [levelRef]);

  const label =
    phase === "speaking" ? "The examiner is speaking"
    : phase === "listening" ? "The examiner is listening to you"
    : phase === "thinking" ? "The examiner is thinking"
    : phase === "connecting" ? "Connecting to the examiner"
    : "The examiner is paused";

  return (
    <div className={`examiner examiner--${phase}`} ref={root} role="img" aria-label={label}>
      <svg viewBox="0 0 120 120" aria-hidden="true">
        {/* listening ring: follows the student's own voice */}
        <rect className="examiner-ring" x="6" y="6" width="108" height="108" />
        {/* head — a tile with cut corners, not a circle */}
        <path
          className="examiner-head"
          d="M34 16 H86 L104 34 V86 L86 104 H34 L16 86 V34 Z"
        />
        {/* eyes */}
        <rect className="examiner-eye" x="40" y="46" width="12" height="12" />
        <rect className="examiner-eye examiner-eye--right" x="68" y="46" width="12" height="12" />
        {/* mouth: bars rise with amplitude, tallest at the centre */}
        <g className="examiner-mouth">
          {Array.from({ length: BARS }, (_, i) => {
            const centre = Math.abs(i - (BARS - 1) / 2);
            const weight = 1 - centre / BARS;
            return <rect key={i} style={{ ["--w" as string]: weight.toFixed(2) }} x={40 + i * 9} y="86" width="5" height="6" />;
          })}
        </g>
      </svg>
    </div>
  );
}
