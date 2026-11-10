import { useEffect, useRef } from "react";

/**
 * The live examiner: a friendly robot face. The mouth rests as a smile and
 * opens with the examiner's voice; while it listens, a ring around the head
 * follows the student's voice.
 *
 * Amplitude arrives through a CSS custom property rather than React state: it
 * updates every animation frame, and re-rendering sixty times a second would
 * cost far more than it is worth.
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
      <svg className="examiner-face" viewBox="0 0 120 124" aria-hidden="true">
        {/* listening halo: answers the student's own voice */}
        <circle className="examiner-ring" cx="60" cy="64" r="54" />
        <line className="examiner-stalk" x1="60" y1="6" x2="60" y2="18" />
        <circle className="examiner-spark" cx="60" cy="5" r="4.5" />
        <rect className="examiner-head" x="14" y="18" width="92" height="88" rx="26" />
        <circle className="examiner-eye" cx="44" cy="56" r="8" />
        <circle className="examiner-eye" cx="76" cy="56" r="8" />
        <circle className="examiner-glint" cx="46.5" cy="53.5" r="2.4" />
        <circle className="examiner-glint" cx="78.5" cy="53.5" r="2.4" />
        <path className="examiner-smile" d="M46 80 Q60 91 74 80" />
        <ellipse className="examiner-mouth" cx="60" cy="82" rx="12" ry="3.6" />
      </svg>
    </div>
  );
}
