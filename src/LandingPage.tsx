import { useEffect, useState } from "react";
import { BookIcon, HeadphonesIcon, MicIcon, PenIcon } from "./icons";

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
 */
export default function LandingPage({ onSignIn }: { onSignIn: () => void }) {
  return (
    <div className="landing">
      <LandingHeader onSignIn={onSignIn} />
      <main>
        <Hero onSignIn={onSignIn} />
        <Skills />
        <Feedback />
        <Centres />
        <Closing onSignIn={onSignIn} />
      </main>
      <footer className="landing-footer">
        <span className="brand"><span className="brand-mark">M</span><span>mock-ai</span></span>
        <p>IELTS practice built in Uzbekistan. Band estimates are practice feedback, not official IELTS scores.</p>
      </footer>
    </div>
  );
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
      <a className="brand" href="#top" aria-label="mock-ai home">
        <span className="brand-mark">M</span><span>mock-ai</span>
      </a>
      <nav aria-label="Sections">
        <a href="#skills">Practice</a>
        <a href="#feedback">Feedback</a>
        <a href="#centres">For centres</a>
      </nav>
      <button className="primary-action" onClick={onSignIn}>Start practising</button>
    </header>
  );
}

function Hero({ onSignIn }: { onSignIn: () => void }) {
  return (
    <section className="landing-hero" id="top">
      <div className="landing-hero-copy">
        <h1>Practise IELTS until the real thing feels <em>ordinary</em>.</h1>
        <p>
          Full mock exams and focused practice across Reading, Listening, Writing and Speaking.
          Reading and Listening are marked instantly against the answer key. Writing and Speaking
          get an AI band estimate with the reasons behind it.
        </p>
        <div className="landing-cta">
          <button className="primary-action" onClick={onSignIn}>Start practising</button>
          <a className="secondary-action" href="#centres">I run a learning centre</a>
        </div>
        <ul className="landing-proof">
          <li><strong>Free</strong><span>No payment, no card</span></li>
          <li><strong>Telegram</strong><span>Sign in with one tap</span></li>
          <li><strong>All four skills</strong><span>In one place</span></li>
        </ul>
      </div>
      <div className="landing-hero-art">
        <picture>
          <source srcSet="/art/hero.webp" type="image/webp" />
          <img src="/art/hero.png" width={1408} height={768}
            alt="A student holding a tablet, with panels showing a speech waveform, a page of writing and a progress ring."
            fetchPriority="high" decoding="async" />
        </picture>
      </div>
    </section>
  );
}

const SKILLS = [
  { key: "reading", name: "Reading", icon: <BookIcon />, body: "Passages with the real question types, marked the moment you submit.", mark: "Answer key" },
  { key: "listening", name: "Listening", icon: <HeadphonesIcon />, body: "Timed sections with audio, scored the same way the exam scores them.", mark: "Answer key" },
  { key: "writing", name: "Writing", icon: <PenIcon />, body: "Task 1 and Task 2 prompts, with feedback on each of the four criteria.", mark: "AI estimate" },
  { key: "speaking", name: "Speaking", icon: <MicIcon />, body: "A three-part interview with an examiner that listens and replies.", mark: "AI estimate" },
];

function Skills() {
  return (
    <section className="landing-section" id="skills">
      <div className="landing-section-head">
        <h2>Choose what to practise</h2>
        <p>Work on one skill, or sit the full mock from end to end.</p>
      </div>
      <ul className="landing-skills">
        {SKILLS.map(skill => (
          <li key={skill.key} className={`landing-skill skill-${skill.key}`}>
            <span className="landing-skill-icon" aria-hidden="true">{skill.icon}</span>
            <h3>{skill.name}</h3>
            <p>{skill.body}</p>
            <span className="landing-skill-mark">{skill.mark}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Feedback() {
  return (
    <section className="landing-section landing-feedback" id="feedback">
      <div className="landing-section-head">
        <h2>Feedback that says why</h2>
        <p>A number on its own teaches nothing. Every estimate comes with the reasoning behind it.</p>
      </div>
      <div className="landing-split">
        <article>
          <h3>Writing</h3>
          <p>
            Submit an essay and it comes back with a band for each of the four criteria —
            task achievement, coherence, lexical resource and grammar — each with what you did and
            the one thing to change next time.
          </p>
        </article>
        <article>
          <h3>Speaking</h3>
          <p>
            A live examiner asks the eleven questions of a real interview, waits while you think,
            and moves on when you have finished. Afterwards your answers are transcribed and
            assessed on fluency, vocabulary, grammar and pronunciation.
          </p>
        </article>
      </div>
      <p className="landing-caveat">
        Writing and Speaking bands are an AI estimate for practice. They are not official IELTS
        scores and no practice platform can issue one.
      </p>
    </section>
  );
}

function Centres() {
  return (
    <section className="landing-section landing-centres" id="centres">
      <div className="landing-section-head">
        <h2>For learning centres</h2>
        <p>Run your centre on mock-ai with your own material and your own students.</p>
      </div>
      <ul className="landing-centre-points">
        <li>
          <h3>Your material stays yours</h3>
          <p>Exams and content you upload are visible only to your students. No other centre sees them, and you choose whether your students also get the shared library.</p>
        </li>
        <li>
          <h3>Students join with one link</h3>
          <p>Send your centre's Telegram link. Opening it puts a student in your centre and signs them in — no accounts to create, no passwords to reset.</p>
        </li>
        <li>
          <h3>Mark it yourself, or let the AI</h3>
          <p>Prefer your teachers to assess Writing and Speaking? Switch AI off and the work is captured and queued for your staff instead, with nothing sent to a model.</p>
        </li>
        <li>
          <h3>Your own admin panel</h3>
          <p>Your administrators see your students, your content and your marking queue — and nothing from any other centre.</p>
        </li>
      </ul>
      <p className="landing-centre-contact">
        Centres are set up by hand while the platform is new. Message <strong>@mockai_bot</strong> on Telegram and we will open yours.
      </p>
    </section>
  );
}

function Closing({ onSignIn }: { onSignIn: () => void }) {
  return (
    <section className="landing-closing">
      <h2>Your next band starts with the next question.</h2>
      <button className="primary-action" onClick={onSignIn}>Start practising</button>
    </section>
  );
}
