import { useEffect, useRef } from "react";

/**
 * The live examiner.
 *
 * Friendly rather than mechanical: a soft-cornered head, round eyes with a
 * catchlight, and a mouth that rests as a smile and opens into the voice when
 * the examiner talks. Still built from the product's own geometry — it is not
 * a cartoon mascot — but the hard square eyes and the row of flat "teeth" that
 * read as a grimace are gone.
 *
 * Amplitude arrives through a CSS custom property rather than React state:
 * this updates every animation frame, and re-rendering a component sixty times
 * a second to move a mouth would cost far more than it is worth.
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

  const talking = phase === "speaking";

  return (
    <div className={`examiner examiner--${phase}`} ref={root} role="img" aria-label={label}>
      <svg viewBox="0 0 120 124" aria-hidden="true">
        {/* listening halo: answers the student's own voice */}
        <circle className="examiner-ring" cx="60" cy="64" r="54" />
        {/* a small antenna, so it reads as someone rather than a panel */}
        <line className="examiner-stalk" x1="60" y1="6" x2="60" y2="18" />
        <circle className="examiner-spark" cx="60" cy="5" r="4.5" />
        {/* head: soft corners, not a cut tile */}
        <rect className="examiner-head" x="14" y="18" width="92" height="88" rx="26" />
        {/* eyes: round, with a catchlight */}
        <g className="examiner-eyes">
          <circle className="examiner-eye" cx="44" cy="56" r="8" />
          <circle className="examiner-eye" cx="76" cy="56" r="8" />
          <circle className="examiner-glint" cx="46.5" cy="53.5" r="2.4" />
          <circle className="examiner-glint" cx="78.5" cy="53.5" r="2.4" />
        </g>
        {/* mouth: a smile at rest; one open shape when the voice carries it,
            because a row of separate bars reads as teeth */}
        <path className="examiner-smile" d="M46 80 Q60 91 74 80" />
        <ellipse className="examiner-mouth" cx="60" cy="82" rx="12" ry="3.6" style={{ opacity: talking ? 1 : 0 }} />
      </svg>
    </div>
  );
}
