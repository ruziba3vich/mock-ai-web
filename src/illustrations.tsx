import type { ReactNode } from "react";

/**
 * Spot illustrations. Flat, two-tone, drawn on a 120×120 grid.
 *
 * Every colour comes from CSS (see "Illustrations" in world.css): the main
 * colour is `currentColor`, set per skill or per page, so a centre's re-skin
 * recolours the art along with the rest of the product. Classes:
 *   a-main   solid main colour        a-tint   pale wash of the main colour
 *   a-paper  paper/white surface      a-ink    main-colour strokes
 *   a-accent warm accent fill         a-stroke main-colour outline, no fill
 */
type ArtProps = { className?: string };

function Art({ name, className, children }: { name: string; className?: string; children: ReactNode }) {
  return (
    <svg viewBox="0 0 120 120" className={`art art-${name}${className ? ` ${className}` : ""}`} aria-hidden="true" focusable="false">
      <circle className="a-tint" cx="60" cy="62" r="48" />
      {children}
    </svg>
  );
}

function Sparkle({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return <path className="a-accent" transform={`translate(${x} ${y}) scale(${s})`} d="M0 -7 C1 -2 2 -1 7 0 C2 1 1 2 0 7 C-1 2 -2 1 -7 0 C-2 -1 -1 -2 0 -7 Z" />;
}

export function ReadingArt({ className }: ArtProps) {
  return (
    <Art name="reading" className={className}>
      <path className="a-paper a-edge" d="M20 40 C33 33 47 34 58 42 V92 C47 85 33 84 20 90 Z" />
      <path className="a-paper a-edge" d="M100 40 C87 33 73 34 62 42 V92 C73 85 87 84 100 90 Z" />
      <path className="a-main" d="M57 41 Q60 38 63 41 V93 Q60 90 57 93 Z" />
      <path className="a-ink" d="M28 52 Q38 48 50 53 M28 62 Q38 58 50 63 M28 72 Q36 69 44 72" />
      <path className="a-ink" d="M70 53 Q82 48 92 52 M70 63 Q82 58 92 62 M70 73 Q80 69 92 72" />
      <path className="a-accent" d="M80 34 V56 L85.5 51 L91 56 V32 Z" />
      <Sparkle x={24} y={26} s={0.9} />
    </Art>
  );
}

export function ListeningArt({ className }: ArtProps) {
  return (
    <Art name="listening" className={className}>
      <path className="a-stroke" strokeWidth="8" d="M30 70 V60 A30 30 0 0 1 90 60 V70" />
      <rect className="a-main" x="20" y="62" width="18" height="30" rx="8" />
      <rect className="a-main" x="82" y="62" width="18" height="30" rx="8" />
      <rect className="a-paper" x="25" y="68" width="4" height="16" rx="2" />
      <rect className="a-paper" x="91" y="68" width="4" height="16" rx="2" />
      <rect className="a-accent" x="46" y="70" width="5" height="12" rx="2.5" />
      <rect className="a-accent" x="54" y="62" width="5" height="28" rx="2.5" />
      <rect className="a-accent" x="62" y="66" width="5" height="20" rx="2.5" />
      <rect className="a-accent" x="70" y="71" width="5" height="10" rx="2.5" />
      <Sparkle x={96} y={30} />
    </Art>
  );
}

export function WritingArt({ className }: ArtProps) {
  return (
    <Art name="writing" className={className}>
      <g transform="rotate(-6 54 62)">
        <rect className="a-paper a-edge" x="26" y="24" width="54" height="72" rx="7" />
        <path className="a-ink" d="M36 40 H70 M36 52 H70 M36 64 H62 M36 76 H56" />
      </g>
      <g transform="rotate(38 84 62)">
        <rect className="a-main" x="77" y="24" width="15" height="52" rx="3" />
        <rect className="a-accent" x="77" y="16" width="15" height="10" rx="3" />
        <path className="a-paper a-edge" d="M77 76 H92 L84.5 92 Z" />
        <path className="a-main" d="M82 86 H87 L84.5 92 Z" />
      </g>
      <Sparkle x={26} y={22} s={0.8} />
    </Art>
  );
}

export function SpeakingArt({ className }: ArtProps) {
  return (
    <Art name="speaking" className={className}>
      <rect className="a-main" x="42" y="22" width="32" height="50" rx="16" />
      <path className="a-paper-stroke" d="M48 38 H68 M48 46 H68 M48 54 H68" />
      <path className="a-stroke" strokeWidth="6" d="M34 58 A24 24 0 0 0 82 58 M58 82 V96 M44 97 H72" />
      <path className="a-accent" d="M80 16 H104 A8 8 0 0 1 112 24 V36 A8 8 0 0 1 104 44 H92 L84 52 V44 H80 A8 8 0 0 1 72 36 V24 A8 8 0 0 1 80 16 Z" />
      <circle className="a-paper" cx="84" cy="30" r="2.6" />
      <circle className="a-paper" cx="92" cy="30" r="2.6" />
      <circle className="a-paper" cx="100" cy="30" r="2.6" />
    </Art>
  );
}

export function ExamArt({ className }: ArtProps) {
  return (
    <Art name="exam" className={className}>
      <rect className="a-paper a-edge" x="20" y="26" width="50" height="66" rx="7" />
      <rect className="a-main" x="33" y="20" width="24" height="10" rx="4" />
      <path className="a-ink" d="M30 46 L34 50 L41 42 M48 46 H60 M30 62 L34 66 L41 58 M48 62 H60 M48 78 H60" />
      <circle className="a-paper a-edge-bold" cx="80" cy="74" r="24" />
      <rect className="a-main" x="76" y="42" width="8" height="8" rx="2" />
      <path className="a-accent-stroke" d="M80 74 L91 63" />
      <path className="a-ink" d="M80 56 V60 M98 74 H94 M80 92 V88 M62 74 H66" />
      <circle className="a-main" cx="80" cy="74" r="4" />
      <Sparkle x={100} y={32} />
    </Art>
  );
}

export function PracticeArt({ className }: ArtProps) {
  return (
    <Art name="practice" className={className}>
      <circle className="a-paper a-edge-bold" cx="56" cy="66" r="34" />
      <circle className="a-tint-strong" cx="56" cy="66" r="22" />
      <circle className="a-main" cx="56" cy="66" r="10" />
      <path className="a-accent-stroke" d="M56 66 L94 28" />
      <path className="a-accent" d="M90 20 L100 18 L98 28 L104 26 L102 34 L94 36 L88 30 Z" />
      <Sparkle x={24} y={28} s={0.8} />
    </Art>
  );
}

export function ReviewArt({ className }: ArtProps) {
  return (
    <Art name="review" className={className}>
      <rect className="a-paper a-edge" x="22" y="22" width="54" height="72" rx="7" />
      <path className="a-ink" d="M32 38 H64 M32 50 H64 M32 62 H54" />
      <circle className="a-tint-strong a-edge-bold" cx="74" cy="70" r="18" />
      <path className="a-stroke" strokeWidth="9" d="M87 83 L100 96" />
      <path className="a-accent-stroke" d="M66 70 L72 76 L82 64" />
      <Sparkle x={100} y={34} s={0.9} />
    </Art>
  );
}

export function NotebookArt({ className }: ArtProps) {
  return (
    <Art name="notebook" className={className}>
      <rect className="a-main" x="28" y="18" width="60" height="82" rx="8" />
      <rect className="a-paper" x="38" y="24" width="44" height="70" rx="4" />
      <path className="a-paper-stroke" d="M24 32 H34 M24 46 H34 M24 60 H34 M24 74 H34 M24 88 H34" />
      <path className="a-ink" d="M46 38 H74 M46 50 H70" />
      <path className="a-wrong" d="M47 62 L55 70 M55 62 L47 70" />
      <path className="a-accent-stroke" d="M46 82 L51 87 L60 77" />
      <path className="a-ink" d="M62 66 H74 M66 82 H74" />
      <Sparkle x={100} y={30} />
    </Art>
  );
}

export function ProgressArt({ className }: ArtProps) {
  return (
    <Art name="progress" className={className}>
      <rect className="a-tint-strong" x="24" y="70" width="16" height="24" rx="4" />
      <rect className="a-main a-soft" x="46" y="56" width="16" height="38" rx="4" />
      <rect className="a-main" x="68" y="40" width="16" height="54" rx="4" />
      <path className="a-ink-strong" d="M18 96 H102" />
      <path className="a-accent-stroke" d="M22 62 L46 44 L60 52 L92 26" />
      <path className="a-accent" d="M84 22 L98 20 L96 34 Z" />
      <Sparkle x={104} y={50} s={0.8} />
    </Art>
  );
}

export function ExploreArt({ className }: ArtProps) {
  return (
    <Art name="explore" className={className}>
      <path className="a-accent-stroke-thin" d="M38 34 H26 V42 A14 14 0 0 0 42 56 M82 34 H94 V42 A14 14 0 0 1 78 56" />
      <path className="a-accent" d="M36 26 H84 V48 A24 24 0 0 1 36 48 Z" />
      <path className="a-paper" d="M60 34 L63.5 41 L71 42 L65.5 47 L67 55 L60 51 L53 55 L54.5 47 L49 42 L56.5 41 Z" />
      <rect className="a-main" x="54" y="70" width="12" height="12" />
      <rect className="a-main" x="40" y="82" width="40" height="12" rx="4" />
      <Sparkle x={24} y={78} s={0.9} />
      <Sparkle x={98} y={74} s={0.7} />
    </Art>
  );
}

export const SKILL_ART: Record<string, typeof ReadingArt> = {
  reading: ReadingArt,
  listening: ListeningArt,
  writing: WritingArt,
  speaking: SpeakingArt,
};
