import { createElement, useEffect, useRef } from "react";
import type { CSSProperties, RefObject } from "react";
import { flushSync } from "react-dom";

/**
 * Motion helpers. The choreography lives in CSS (base.css "Motion vocabulary",
 * poster.css); these only start it, skip it and roll numbers.
 * Contract: nothing animates unless an ancestor has `.play`; reduced motion
 * (and environments without matchMedia, e.g. tests) get the final state.
 */

export function prefersReducedMotion(): boolean {
  return typeof window.matchMedia !== "function" || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const SKIP = "motion-skip";

/**
 * Plays a signature entrance once on mount: holds the first frame until the
 * fonts are ready (max 1.5 s), then adds `.play` to the root. Any pointerdown
 * or keydown during the entrance jumps everything to its final state, so input
 * is never blocked. Returns nothing; style children with .rise/.blurin/… and --d.
 */
export function useEntrance(ref: RefObject<HTMLElement | null>, enabled = true) {
  useEffect(() => {
    const root = ref.current;
    if (!root || !enabled || prefersReducedMotion()) return;
    root.dataset.entrance = "";
    root.classList.add("wait", "play");
    let done = false;
    const release = () => root.classList.remove("wait");
    const cap = window.setTimeout(release, 1500);
    void document.fonts?.ready.then(release);
    const opts = { capture: true } as const;
    const detach = () => {
      done = true;
      window.clearTimeout(cap); window.clearTimeout(settle);
      root.removeEventListener("pointerdown", skip, opts); window.removeEventListener("keydown", skip, opts);
    };
    const skip = () => {
      if (done) return;
      detach();
      release();
      for (const a of root.getAnimations({ subtree: true })) {
        try { a.finish(); } catch { /* infinite ambient loops cannot finish; leave them */ }
      }
      root.dispatchEvent(new Event(SKIP));
    };
    // entrances run 2.5–4 s; after that a tap is just a tap
    const settle = window.setTimeout(detach, 5000);
    root.addEventListener("pointerdown", skip, opts);
    window.addEventListener("keydown", skip, opts);
    return detach;
  }, [ref, enabled]);
}

/** Inline style for one element of a staggered group: delay = base + i * step (ms). */
export function stagger(i: number, base = 0, step = 70, dur?: number): CSSProperties {
  return { "--d": `${base + i * step}ms`, ...(dur ? { "--dur": `${dur}ms` } : {}) } as CSSProperties;
}

type RollProps = {
  value: number;
  from?: number;
  /** Valid step: 0.5 for IELTS bands, 1 for counts. Every frame shows a real value. */
  step?: number;
  decimals?: number;
  delay?: number;
  duration?: number;
  className?: string;
};

/**
 * A number that counts up in valid steps (expo-out) when it is inside a
 * `.play` root. React renders the final value; the roll only rewrites the
 * text while it runs, and a skip lands it on the final value at once.
 */
export function Roll({ value, from = 0, step = 1, decimals = step < 1 ? 1 : 0, delay = 0, duration = 1000, className }: RollProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const final = value.toFixed(decimals);
  useEffect(() => {
    const el = ref.current;
    const root = el?.closest<HTMLElement>(".play");
    if (!el || !root || prefersReducedMotion()) return;
    let frame = 0;
    const t0 = performance.now();
    const stop = () => { cancelAnimationFrame(frame); el.textContent = final; };
    const tick = (now: number) => {
      const p = Math.min(1, Math.max(0, (now - t0 - delay) / duration));
      const e = 1 - Math.pow(1 - p, 4);
      el.textContent = (from + Math.round(((value - from) * e) / step) * step).toFixed(decimals);
      if (p < 1) frame = requestAnimationFrame(tick); else stop();
    };
    el.textContent = from.toFixed(decimals);
    frame = requestAnimationFrame(tick);
    root.addEventListener(SKIP, stop, { once: true });
    return () => { stop(); root.removeEventListener(SKIP, stop); };
  }, [value, from, step, decimals, delay, duration, final]);
  return <span ref={ref} className={["num", className].filter(Boolean).join(" ")}>{final}</span>;
}

type RevealProps = {
  text: string;
  as?: "h1" | "h2" | "h3" | "span" | "p";
  /** Delay before the first character, ms. */
  base?: number;
  /** Delay between characters, ms. */
  charStep?: number;
  className?: string;
  id?: string;
};

/**
 * Heading whose characters rise out of word masks in reading order (inside
 * `.play`). The accessible name stays the plain text.
 */
export function RevealText({ text, as = "h1", base = 0, charStep = 32, className, id }: RevealProps) {
  let i = 0;
  const words = text.trim().split(/\s+/);
  const style = { "--base": `${base}ms`, "--ch-step": `${charStep}ms` } as CSSProperties;
  return createElement(as, { className, id, style, "aria-label": text },
    words.map((word, w) => (
      <span key={w} aria-hidden="true">
        {w > 0 && " "}
        <span className="w">{[...word].map((c) => <span key={i} className="ch" style={{ "--i": i++ } as CSSProperties}>{c}</span>)}</span>
      </span>
    )));
}

/**
 * Runs a view change inside document.startViewTransition when available and
 * motion is allowed; otherwise applies it directly.
 */
export function viewTransition(update: () => void) {
  if (typeof document.startViewTransition !== "function" || prefersReducedMotion()) { update(); return; }
  document.startViewTransition(() => flushSync(update));
}
