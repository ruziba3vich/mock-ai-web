import Wordmark from "./Wordmark";

/** mock-ai.uz/sat: holds the address until SAT practice exists. */
export default function SatPage() {
  return (
    <div className="landing">
      <header className="landing-header is-solid">
        <a className="brand" href="/" aria-label="mock-ai home"><Wordmark /></a>
      </header>
      <main>
        <section className="landing-hero">
          <div className="landing-hero-copy">
            <h1><span>SAT practice.</span> <span className="lp-accent">Coming soon!</span></h1>
            <p className="lp-lede">We are building SAT mock tests for mock-ai. IELTS practice is open now, with a band estimate across all four skills.</p>
            <div className="landing-cta"><a className="btn btn-primary" href="/">Go to IELTS practice</a></div>
          </div>
        </section>
      </main>
      <footer className="landing-footer"><span>mock-ai.uz</span><p>SAT is not available yet.</p></footer>
    </div>
  );
}
