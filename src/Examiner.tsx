import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import Poster from "./Poster";

/**
 * The live examiner: a speaking poster used as a portrait. Its waveform is
 * the examiner's voice; the bars follow --level, and the ring answers the
 * student's own voice while the examiner listens.
 *
 * Amplitude arrives through a CSS custom property rather than React state:
 * this updates every animation frame, and re-rendering a component sixty times
 * a second to move the bars would cost far more than it is worth.
 */
export type ExaminerPhase = "paused" | "connecting" | "speaking" | "listening" | "thinking";

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
      <Poster skill="speaking" tag="Examiner" className="examiner-poster" />
      <span className="examiner-ring" aria-hidden="true" />
      <span className="examiner-bars" aria-hidden="true">
        {BARS.map((k, i) => <i key={i} style={{ "--k": k } as CSSProperties} />)}
      </span>
    </div>
  );
}

/** Relative height of each bar: tall in the middle, like a voice print. */
const BARS = [0.35, 0.6, 0.85, 1, 0.75, 0.95, 0.65, 0.4];
