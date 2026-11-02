import { useEffect, useState } from "react";

/**
 * The bot username the login button points at. Deployments that run their own
 * bot override it at build time; the default is the one students are given.
 */
const TELEGRAM_BOT = (import.meta.env.VITE_TELEGRAM_BOT as string | undefined) || "mockai_bot";

/**
 * Why these codes are handled here: the API cannot render a message, so every
 * redirect-based failure comes back as ?auth_error=<code>. Nothing read it
 * before, which meant a failed Google round trip or a spent login link landed
 * the student on this screen with no explanation at all.
 */
const AUTH_ERRORS: Record<string, string> = {
  login_link_invalid: "That login link has already been used or has expired. Open the bot and tap “Log in in your browser” for a fresh one.",
  google_flow_failed: "Google sign-in did not finish. Try again, or use Telegram instead.",
  google_login_failed: "Google signed you in but we could not open your account. Try again in a moment.",
};

export default function AuthScreen() {
  const [error, setError] = useState("");

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("auth_error");
    if (!code) return;
    setError(AUTH_ERRORS[code] ?? "Sign-in did not finish. Please try again.");
    // Clear the code so a refresh does not re-show a message about a link the
    // student has already replaced.
    const url = new URL(window.location.href);
    url.searchParams.delete("auth_error");
    window.history.replaceState({}, "", url.pathname + url.search);
  }, []);

  return (
    <main className="auth-page">
      <section className="auth-intro">
        <a className="brand" href="#" aria-label="mock-ai home">
          <span className="brand-mark">M</span><span>mock-ai</span>
        </a>
        <div>
          <h1>Practice clearly.<br />Progress visibly.</h1>
          <p>Realistic Listening, Reading, Writing and Speaking practice, with results that show where your score comes from.</p>
        </div>
        <small>Built for focused, repeatable practice.</small>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <h2>Sign in to continue</h2>
          <p className="auth-subtitle">
            Start the mock-ai bot on Telegram. It knows who you are and sends you a link straight back — no password to remember.
          </p>
          {error && <div className="form-error" role="alert">{error}</div>}
          <a className="primary-button telegram-button" href={`https://t.me/${TELEGRAM_BOT}?start=login`}>
            <TelegramIcon /> Continue with Telegram
          </a>
          <ol className="auth-steps">
            <li>Telegram opens on the mock-ai bot.</li>
            <li>Tap <strong>Start</strong>, or send <strong>/start</strong> if you have used it before.</li>
            <li>Tap the link it sends to come back signed in.</li>
          </ol>
          <div className="auth-divider"><span>or</span></div>
          <a className="google-button" href="/api/v1/auth/google/start">
            <GoogleIcon /> Continue with Google
          </a>
        </div>
      </section>
    </main>
  );
}

function TelegramIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M21 4.5 2.8 11.3a.4.4 0 0 0 .03.76l4.1 1.3 1.6 4.9a.4.4 0 0 0 .7.13l2.3-2.6 4.2 3.1a.4.4 0 0 0 .63-.23L21 4.5Z"/><path d="M21 4.5 8.93 13.36 10.5 18"/></svg>;
}

function GoogleIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21.6 12.2c0-.7-.1-1.5-.2-2.2H12v4h5.4a4.6 4.6 0 0 1-2 3v2.6h3.3c1.9-1.8 2.9-4.4 2.9-7.4Z"/><path d="M12 22c2.7 0 5-.9 6.7-2.4L15.4 17c-.9.6-2.1 1-3.4 1a5.9 5.9 0 0 1-5.6-4.1H3v2.7A10 10 0 0 0 12 22Z"/><path d="M6.4 13.9A6 6 0 0 1 6.1 12c0-.7.1-1.3.3-1.9V7.4H3A10 10 0 0 0 2 12c0 1.6.4 3.2 1 4.6l3.4-2.7Z"/><path d="M12 6c1.5 0 2.8.5 3.9 1.5l2.9-2.9A9.8 9.8 0 0 0 12 2a10 10 0 0 0-9 5.4l3.4 2.7A5.9 5.9 0 0 1 12 6Z"/></svg>;
}
