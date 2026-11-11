import { useEffect, useRef, useState } from "react";
import type { CSSProperties, RefObject } from "react";
import { TELEGRAM_BOT } from "./AuthScreen";
import { StarIcon, TelegramIcon } from "./icons";
import { prefersReducedMotion, RevealText, stagger, useEntrance } from "./motion";
import Poster, { PosterSkill } from "./Poster";
import Wordmark from "./Wordmark";

/**
 * The public front door at mock-ai.uz.
 *
 * Two audiences arrive here and they want different things. A student wants to
 * know what they can practise and what the feedback is worth; a learning centre
 * wants to know whether the platform can hold their own material and their own
 * students. The page answers the student first, because they are the larger
 * group and the centre's question only makes sense once the product is clear.
 *
 * Every claim here is something the product actually does. Reading and
 * Listening are marked against a stored answer key, not by a model, and saying
 * otherwise would be a lie a student could catch on their first attempt.
 *
 * Entrance (3.9 s): the headline rises letter by letter while three rows of
 * skill posters stream in from alternating sides; then the wall falls back,
 * Full mock steps forward and its card wipes open with the four skill bars.
 * Sections below play as they scroll into view.
 */
const TELEGRAM = `https://t.me/${TELEGRAM_BOT}`;

export default function LandingPage({ onSignIn }: { onSignIn: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  useEntrance(root);
  useRevealOnScroll(root);
  return (
    <div className="landing" ref={root}>
      <LandingHeader onSignIn={onSignIn} />
      <main>
        <Hero onSignIn={onSignIn} />
        <Skills />
        <Feedback />
        <Centres />
        <Closing onSignIn={onSignIn} />
      </main>
      <footer className="landing-footer">
        <span>mock-ai.uz</span>
        <p>IELTS practice built in Uzbekistan. Band estimates are practice feedback, not official IELTS scores.</p>
      </footer>
    </div>
  );
}

function useRevealOnScroll(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = root.current;
    if (!el || typeof IntersectionObserver === "undefined" || prefersReducedMotion()) return;
    const sections = el.querySelectorAll(".lp-reveal");
    sections.forEach(s => s.classList.add("lp-hold"));
    const io = new IntersectionObserver(entries => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add("on"); io.unobserve(e.target);
        // a jump (anchor link) skips sections above; show those at once, unanimated
        for (const s of sections) {
          if (s === e.target) break;
          if (!s.classList.contains("on")) { s.classList.add("on", "lp-now"); io.unobserve(s); }
        }
      }
    }, { rootMargin: "0px 0px -12% 0px" });
    sections.forEach(s => io.observe(s));
    return () => io.disconnect();
  }, [root]);
}

function TelegramLink({ className = "btn btn-primary", style }: { className?: string; style?: CSSProperties }) {
  return <a className={className} style={style} href={TELEGRAM}><TelegramIcon /> Open in Telegram</a>;
}

function LandingHeader({ onSignIn }: { onSignIn: () => void }) {
  const [solid, setSolid] = useState(false);
  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <header className={solid ? "landing-header is-solid" : "landing-header"}>
      <a className="brand blurin" style={stagger(0, 0, 60, 800)} href="#top" aria-label="mock-ai home"><Wordmark /></a>
      <nav aria-label="Sections">
        <a className="blurin" style={stagger(1, 0, 60, 800)} href="#skills">How it scores</a>
        <a className="blurin" style={stagger(2, 0, 60, 800)} href="#centres">For centres</a>
        <a className="blurin" style={stagger(3, 0, 60, 800)} href="/join">Join with an exam code</a>
        <a className="blurin" style={stagger(3, 0, 60, 800)} href="/pc" title="Show this computer's QR code and code, so a centre admin can add it">Join PC</a>
        <button type="button" className="lp-link blurin" style={stagger(3, 0, 60, 800)} onClick={onSignIn}>Sign in on the web</button>
      </nav>
      <TelegramLink className="btn btn-primary blurin lp-header-tg" style={stagger(4, 0, 60, 800)} />
    </header>
  );
}

const ROWS: [PosterSkill, string][][] = [
  [["listening", "Section 4"], ["reading", "Test 2"], ["writing", "Opinion essays"], ["speaking", "Cue card"], ["listening", "Maps"], ["reading", "Headings"]],
  [["writing", "Line graphs"], ["speaking", "Live interview"], ["full", "Full mock"], ["reading", "True False Not Given"], ["listening", "Forms"], ["writing", "Discussion"]],
  [["speaking", "Part 3"], ["reading", "Test 3"], ["listening", "Section 1"], ["writing", "Linking"], ["speaking", "Part 1"], ["reading", "Summary"]],
];
const BARS: PosterSkill[] = ["listening", "reading", "writing", "speaking"];

function Wall() {
  let k = 0;
  return (
    <div className="lp-wall-frame" aria-hidden="true">
      <div className="lp-wall">
        {ROWS.map((row, r) => (
          <div className="lp-row" key={r}>
            {row.map(([skill, title]) => (
              <div key={title} className={skill === "full" ? "lp-cell hit" : "lp-cell"} style={{ "--sd": `${300 + k++ * 50}ms` } as CSSProperties}>
                <Poster skill={skill} title={title} tag={skill === "full" ? "All four" : skill[0].toUpperCase() + skill.slice(1)} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Desktop only: the wall leans a degree or two toward the pointer (one write per frame). */
function useWallTilt(hero: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = hero.current;
    const wall = el?.querySelector<HTMLElement>(".lp-wall");
    if (!el || !wall || prefersReducedMotion() || !window.matchMedia("(hover: hover) and (pointer: fine) and (min-width: 1024px)").matches) return;
    let frame = 0;
    const move = (e: PointerEvent) => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const b = el.getBoundingClientRect();
        wall.style.setProperty("--ry", `${((e.clientX - b.left) / b.width - 0.5) * 4}deg`);
        wall.style.setProperty("--rx", `${(0.5 - (e.clientY - b.top) / b.height) * 3}deg`);
      });
    };
    el.addEventListener("pointermove", move);
    return () => { el.removeEventListener("pointermove", move); cancelAnimationFrame(frame); };
  }, [hero]);
}

function Hero({ onSignIn }: { onSignIn: () => void }) {
  const hero = useRef<HTMLElement>(null);
  useWallTilt(hero);
  return (
    <section className="landing-hero" id="top" ref={hero}>
      <div className="landing-hero-copy">
        <h1 aria-label="Know your IELTS band. Then move it.">
          <RevealText as="span" text="Know your IELTS band." base={200} charStep={18} />{" "}
          <RevealText as="span" className="lp-accent" text="Then move it." base={580} charStep={18} />
        </h1>
        <p className="lp-lede blurin" style={stagger(0, 900, 0, 1000)}>
          An honest band estimate across <b>Listening, Reading, Writing and Speaking</b>.
          AI scores your essays and your recorded or live Speaking interview, then names the exact
          sentence that cost you marks. It runs inside Telegram, so there is nothing to install.
        </p>
        <div className="landing-cta">
          <TelegramLink className="btn btn-primary rise" style={stagger(0, 1100)} />
          <button type="button" className="btn btn-ghost rise" style={stagger(1, 1100, 90)} onClick={onSignIn}>Sign in on the web</button>
        </div>
        <p className="lp-star-note blurin" style={stagger(0, 1350)}>
          <StarIcon />
          <span>Every new account gets one free full mock, one Writing check and one Speaking interview. Reading and Listening practice is free.</span>
        </p>
        <a className="lp-centre-link blurin" style={stagger(0, 1450)} href="#centres">I run a learning centre →</a>
      </div>
      <Wall />
      <div className="lp-flyout">
        <h2>Full mock</h2>
        <p>Listening, Reading, Writing and Speaking in one sitting, ending in one band estimate. Costs one star; your first is free.</p>
        <div className="lp-bars" aria-hidden="true">
          {BARS.map((s, i) => <i key={s} className={`grow lp-bar-${s}`} style={stagger(i, 3450, 100, 700)} />)}
        </div>
      </div>
    </section>
  );
}

const SKILLS: { key: PosterSkill; name: string; body: string; mark: string }[] = [
  { key: "listening", name: "Listening", body: "Timed sections with audio and a question map, scored to a band the moment you submit.", mark: "Answer key" },
  { key: "reading", name: "Reading", body: "Three passages with the real question types, notes, highlights and autosave, marked against the key.", mark: "Answer key" },
  { key: "writing", name: "Writing", body: "Task 2 essays scored on all four criteria: the band, the reason, the quoted sentence and its fix.", mark: "AI estimate" },
  { key: "speaking", name: "Speaking", body: "A recorded three-part interview or a live conversation, with per-criterion bands, a transcript and timestamped issues.", mark: "AI estimate" },
];

function Skills() {
  return (
    <section className="lp-band lp-reveal" id="skills">
      <div className="lp-wrap lp-split">
        <div className="lp-split-head">
          <h2 className="lp-in">Four skills. Every one scored.</h2>
          <p className="lp-in" style={stagger(1, 0, 90)}>Work on one skill, or sit the full mock from end to end.</p>
        </div>
        <ol className="landing-skills">
          {SKILLS.map((skill, i) => (
            <li key={skill.key} className="lp-ep lp-in" style={stagger(i, 150, 90)}>
              <Poster skill={skill.key} title={skill.name} />
              <div>
                <h3>{skill.name}</h3>
                <p>{skill.body}</p>
                <span className="lp-mark">{skill.mark}</span>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Feedback() {
  return (
    <section className="lp-band lp-fixes lp-reveal" id="feedback">
      <div className="lp-wrap lp-split">
        <div className="lp-split-head">
          <h2 className="lp-in">Corrections, not compliments.</h2>
          <p className="lp-in" style={stagger(1, 0, 90)}>Every report quotes your own words, shows the fix, and says which criterion it cost.</p>
        </div>
        <div className="lp-sheet lp-in" style={stagger(2, 0, 90)}>
          <p className="lp-sheet-text">
            Many people think that <del>technology make</del> <ins>technology makes</ins> life easier.
            In my opinion, however, it has made daily life more complicated.
          </p>
          <div className="lp-why"><b>Costs Grammar</b><span>Subject-verb agreement. A singular subject takes a singular verb.</span></div>
          <p className="lp-sheet-label">Example of a Writing report note</p>
        </div>
      </div>
      <p className="landing-caveat lp-wrap lp-in" style={stagger(3, 0, 90)}>
        Writing and Speaking bands are an AI estimate for practice. They are not official IELTS
        scores and no practice platform can issue one.
      </p>
    </section>
  );
}

const CENTRE_POINTS = [
  { title: "Your material stays yours", body: "Exams and content you upload are visible only to your students. No other centre sees them, and you choose whether your students also get the shared library." },
  { title: "Students join with one link", body: "Send your centre's Telegram link. Opening it puts a student in your centre and signs them in — no accounts to create, no passwords to reset." },
  { title: "Mark it yourself, or let the AI", body: "Prefer your teachers to assess Writing and Speaking? Switch AI off and the work is captured and queued for your staff instead, with nothing sent to a model." },
  { title: "Your own admin panel", body: "Your administrators see your students, your content and your marking queue — and nothing from any other centre." },
];

function Centres() {
  return (
    <section className="lp-band lp-reveal" id="centres">
      <div className="lp-wrap">
        <div className="lp-section-head">
          <h2 className="lp-in">For learning centres</h2>
          <p className="lp-in" style={stagger(1, 0, 90)}>Run your centre on mock-ai with your own material and your own students.</p>
        </div>
        <ul className="lp-centre-points">
          {CENTRE_POINTS.map((point, i) => (
            <li key={point.title} className="lp-in" style={stagger(i, 150, 90)}>
              <h3>{point.title}</h3>
              <p>{point.body}</p>
            </li>
          ))}
        </ul>
        <div className="landing-cta lp-in" style={stagger(5, 150, 90)}>
          <a className="btn btn-primary" href={`https://panel.${window.location.host.replace(/^www\./, "")}/?register`}>Register your centre</a>
        </div>
        <p className="lp-centre-contact lp-in" style={stagger(5, 150, 90)}>
          Register, buy stars, and run your first mock today. Each student who starts an exam uses 1 star.
        </p>
        <p className="lp-centre-contact lp-in" style={stagger(6, 150, 90)}>
          Already a centre? Open this page on each exam-room computer and press <a href="/pc">Join PC</a>.
        </p>
      </div>
    </section>
  );
}

function Closing({ onSignIn }: { onSignIn: () => void }) {
  return (
    <section className="lp-tg lp-reveal">
      <div className="lp-wrap lp-tg-in">
        <div>
          <h2 className="lp-in">Already in your Telegram.</h2>
          <p className="lp-in" style={stagger(1, 0, 90)}>
            mock-ai opens as a Telegram Mini App. No install, no new password. Prefer a browser?
            Sign in with Telegram or Google on any computer.
          </p>
        </div>
        <div className="landing-cta lp-in" style={stagger(2, 0, 90)}>
          <TelegramLink />
          <button type="button" className="btn btn-ghost" onClick={onSignIn}>Sign in on the web</button>
        </div>
      </div>
    </section>
  );
}
