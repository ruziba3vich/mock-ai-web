import { useRef } from "react";
import type { CSSProperties, ReactNode } from "react";
import Poster from "./Poster";
import { RevealText, Roll, stagger, useEntrance } from "./motion";
import { ArrowIcon } from "./icons";

/** Plays the report entrance each time it mounts; key it by the report id. */
export function ReportStage({ className, children }: { className: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEntrance(ref);
  return <div ref={ref} className={className}>{children}</div>;
}

/*
 * Shared pieces of the Writing and Speaking reports (styles/report.css).
 * Entrance acts, inside a useEntrance root: 0–1.6 s the title card opens,
 * 1.1–3.3 s the band and criteria roll in, 2.7–4.2 s the marks are drawn.
 */

export function TitleCard({ skill, kicker, title, back }: {
  skill: "writing" | "speaking"; kicker: string; title: string;
  back?: { label: string; onClick: () => void; disabled?: boolean };
}) {
  return <header className={`rp-card k-${skill}`}>
    <Poster skill={skill} size="hero" enter style={stagger(0, 100, 0, 1500)} className="rp-card-art" />
    <span className="rp-lb t" aria-hidden="true" /><span className="rp-lb b" aria-hidden="true" />
    {back && <button type="button" className="rp-back blurin" style={stagger(0, 900)} aria-label={back.label} disabled={back.disabled} onClick={back.onClick}><ArrowIcon /></button>}
    <h1 className="rp-card-title" aria-label={`${kicker} ${title}`}>
      <RevealText as="span" className="l1" text={kicker} base={450} />
      <RevealText as="span" className="l2" text={title} base={620} charStep={28} />
    </h1>
  </header>;
}

/** Overall band in a ruled box; the number rolls in half-band steps. */
export function BandBox({ label, value, suffix }: { label: string; value: number | null; suffix?: ReactNode }) {
  return <div className="rp-band-box wipe" style={stagger(0, 1100, 0, 900)}>
    <p className="eyebrow">{label}</p>
    <strong>{value == null ? "—" : <Roll value={value} step={0.5} delay={1400} duration={1100} />}{suffix}</strong>
  </div>;
}

export type Criterion = { key: string; name: string; score: number | null; body: ReactNode };

/** The weakest scored criterion, unless every criterion scored the same. */
export function weakest(items: Criterion[]) {
  const scored = items.filter(c => c.score != null) as (Criterion & { score: number })[];
  const min = Math.min(...scored.map(c => c.score));
  return scored.some(c => c.score !== min) ? scored.filter(c => c.score === min) : [];
}

const BASE = 2000;
export function Criteria({ items }: { items: Criterion[] }) {
  const low = new Set(weakest(items).map(c => c.key));
  return <div className="rp-crit writing-criteria">
    {items.map((c, i) => <article key={c.key} className={`rise${low.has(c.key) ? " low" : ""}`} style={{ ...stagger(i, BASE, 90), "--v": (c.score ?? 0) / 9 } as CSSProperties}>
      <h3>{c.name}</h3>
      <strong className="rp-v">{c.score == null ? "—" : <Roll value={c.score} step={0.5} delay={BASE + 100 + i * 110} duration={1100} />}</strong>
      <span className="rp-bar" aria-hidden="true"><i className="grow" style={stagger(i, BASE + 100, 110, 1100)} /></span>
      <div className="rp-crit-body">{c.body}</div>
    </article>)}
  </div>;
}

/**
 * Text with each found quote underlined and numbered. The active one is a
 * <mark>; quotes that are missing or overlap an earlier one are skipped.
 */
export function Marked({ text, marks, active }: { text: string; marks: { quote: string; n: number }[]; active?: number | null }) {
  const found: { at: number; end: number; n: number }[] = [];
  for (const m of marks) {
    const at = m.quote ? text.indexOf(m.quote) : -1;
    if (at >= 0 && !found.some(f => at < f.end && at + m.quote.length > f.at)) found.push({ at, end: at + m.quote.length, n: m.n });
  }
  found.sort((a, b) => a.at - b.at);
  const out: ReactNode[] = [];
  let pos = 0;
  found.forEach((f, k) => {
    out.push(text.slice(pos, f.at));
    // the number is CSS content (data-n), so the text itself stays the quote
    const props = { "data-n": f.n, style: { "--k": k } as CSSProperties };
    out.push(f.n === active ? <mark key={f.n} {...props} className="rp-mk on">{text.slice(f.at, f.end)}</mark> : <span key={f.n} {...props} className="rp-mk">{text.slice(f.at, f.end)}</span>);
    pos = f.end;
  });
  out.push(text.slice(pos));
  return <>{out}</>;
}
