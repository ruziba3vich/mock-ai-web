import { lazy, Suspense, useEffect, useRef } from "react";
import Poster from "./Poster";

/** three.js is large; only the live interview pays for it. If the chunk fails
 *  to load (offline, stale deploy), the poster stays and the interview goes on. */
const Robot3D = lazy(() => import("./Robot3D").catch(() => ({ default: () => <></> })));

/**
 * The live examiner: a 3D robot standing on the speaking poster. Its LED mouth
 * is the examiner's voice; while it listens, the head turns toward the student
 * and the ears, chest and the ring around the card follow the student's voice.
 *
 * The ring's amplitude arrives through a CSS custom property rather than React
 * state: it updates every animation frame, and re-rendering sixty times a
 * second would cost far more than it is worth.
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
      // the ring; attack faster than release, as a voice does.
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
      <Suspense fallback={null}>
        <Robot3D phase={phase} levelRef={levelRef} />
      </Suspense>
    </div>
  );
}
