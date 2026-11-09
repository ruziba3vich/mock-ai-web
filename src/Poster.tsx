import type { CSSProperties } from "react";

export type PosterSkill = "listening" | "reading" | "writing" | "speaking" | "full";
export type PosterSize = "sm" | "md" | "lg" | "hero";

type Props = {
  skill: PosterSkill;
  /** Lettering in Big Shoulders, set uppercase by CSS. Omit for art only. */
  title?: string;
  /** Small label top-left, e.g. "Task 2", "Drill". */
  tag?: string;
  /** IELTS band badge top-right. Shown with one decimal; null/undefined hides it. */
  band?: number | null;
  size?: PosterSize;
  /** Wipe-open entrance; plays only inside a `.play` root (useEntrance). */
  enter?: boolean;
  className?: string;
  style?: CSSProperties;
};

/**
 * Skill poster tile. Purely visual: it is aria-hidden, so the control that
 * contains it must carry the accessible name (visible text or aria-label).
 * Width comes from the parent; height follows the 2:3 ratio (hero fills it).
 */
export default function Poster({ skill, title, tag, band, size = "md", enter, className, style }: Props) {
  const classes = ["poster", `p-${skill}`, `poster-${size}`, enter && "p-enter", className].filter(Boolean).join(" ");
  return (
    <div className={classes} style={style} aria-hidden="true">
      {skill === "speaking" && <span className="p-wave" />}
      {skill === "writing" && (size === "lg" || size === "hero") && (
        <svg className="p-pen" viewBox="0 0 300 260" focusable="false">
          <path pathLength={900} d="M18 170c30-60 52-92 70-92 22 0-8 96 16 96 20 0 34-70 58-70 20 0 4 58 26 58 18 0 30-34 52-34 16 0 22 18 40 18" />
        </svg>
      )}
      {tag && <span className="p-tag">{tag}</span>}
      {band != null && <span className="p-band">{band.toFixed(1)}</span>}
      {title && <span className="p-title">{title}</span>}
    </div>
  );
}

/** The poster for an exam/practice skill string from the API. */
export function posterSkill(skill: string): PosterSkill {
  return skill === "listening" || skill === "reading" || skill === "writing" || skill === "speaking" ? skill : "full";
}

/**
 * Poster lettering for an exam title. Posters are narrow, so long titles like
 * "Cambridge IELTS 4 · Reading Test 4" become "Cam 4 Test 4"; the full title
 * always sits in text next to the poster.
 */
export function posterTitle(title: string): string {
  const book = title.match(/\bcambridge(?:\s+ielts)?\s+(\d+)/i)?.[1];
  const test = title.match(/\b(?:test|part|task)\s*\d+/i)?.[0];
  if (test) return book ? `Cam ${book} ${test}` : test;
  return title.replace(/\b(academic|general training|ielts|reading|listening)\b/gi, "").replace(/[·\-–—:]+/g, " ").replace(/\s+/g, " ").trim() || title;
}
