import { useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { APIError, User, authAPI } from "./auth";
import { TELEGRAM_BOT } from "./AuthScreen";
import ClaimResults, { QR } from "./ClaimResults";
import { ExamSeat, HeldSeat, PCState, examSessionAPI, formatWhen, normaliseCode, pcAPI } from "./examSession";
import { newSpendReference, starsAPI } from "./stars";
import Wordmark from "./Wordmark";

const message = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

function Page({ title, lead, children }: { title: ReactNode; lead: ReactNode; children: ReactNode }) {
  return <main className="auth-page join-page">
    <section className="auth-intro">
      <a className="brand" href="/" aria-label="mock-ai home"><Wordmark /></a>
      <div><h1>{title}</h1><p>{lead}</p></div>
      <span />
    </section>
    <section className="auth-panel"><div className="auth-card">{children}</div></section>
  </main>;
}

const onPCRoute = window.location.pathname === "/pc";
// The address an administrator's phone opens to approve this computer.
const approveURL = (code: string) => ["localhost", "127.0.0.1"].includes(window.location.hostname)
  ? `${window.location.origin}/admin?pc=${code}`
  : `https://panel.${window.location.host.replace(/^www\./, "")}/?pc=${code}`;

/**
 * Exam day at a learning centre. A centre computer (set up once on /pc) shows
 * a QR code when its exam is near: the student scans it, presses Start in
 * Telegram, and this computer signs them in. Any other browser, or a student
 * without Telegram, types the exam code instead.
 */
export default function JoinExam({ user, onUser, onJoined, onLogout, pollMs = 5000 }: {
  user: User | null;
  onUser: (user: User) => void;
  onJoined: (held: HeldSeat) => void;
  onLogout: () => Promise<void>;
  pollMs?: number;
}) {
  const [code, setCode] = useState("");
  const [found, setFound] = useState<ExamSeat | null>(null);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [pc, setPC] = useState<PCState | null>(null);
  const [typing, setTyping] = useState(false);
  const [loginURL, setLoginURL] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { setName(user?.display_name ?? ""); }, [user?.id]);

  // Ask the server what this computer is, and keep asking: that is how a
  // paired computer learns it was approved, and that its exam is near.
  useEffect(() => {
    let active = true;
    const tick = async () => {
      try {
        let next = await pcAPI.me();
        if (!next && onPCRoute) next = await pcAPI.pair();
        if (active) setPC(next);
      } catch { /* offline for a moment: keep the screen, the next tick asks again */ }
    };
    void tick();
    const timer = window.setInterval(tick, pollMs);
    return () => { active = false; window.clearInterval(timer); };
  }, [pollMs]);

  const exam = pc?.status === "paired" && pc.session?.open && pc.session.code ? pc.session : null;
  const examCode = exam?.code ?? "";
  const showQR = !!exam && !user && !typing && !found;

  // The student QR: one token at a time, replaced when it expires or is used.
  useEffect(() => {
    if (!showQR) return;
    let active = true, token = "";
    const tick = async () => {
      try {
        if (!token) {
          token = (await pcAPI.login()).token;
          if (active) setLoginURL(`https://t.me/${TELEGRAM_BOT}?start=j_${token}`);
          return;
        }
        const result = await pcAPI.poll(token);
        if (!result.signed_in || !active) return;
        setContact(result.contact);
        onUser(await authAPI.me());
      } catch (e) { if (e instanceof APIError && (e.status === 410 || e.status === 404)) token = ""; }
    };
    void tick();
    const timer = window.setInterval(tick, Math.min(pollMs, 2000));
    return () => { active = false; window.clearInterval(timer); setLoginURL(""); };
  }, [showQR, pollMs]);

  async function run(work: () => Promise<void>, fallback: string) {
    setBusy(true); setError("");
    try { await work(); } catch (e) {
      setError(e instanceof APIError && e.status === 429 ? "Too many tries from this computer. Wait a minute, then try again." : message(e, fallback));
    } finally { setBusy(false); }
  }
  const open = (examCodeToOpen: string) => run(async () => { setCode(examCodeToOpen); setFound(await examSessionAPI.lookup(examCodeToOpen)); }, "The exam code could not be checked.");

  // On a centre computer the exam is already known: a signed-in student, or
  // one who chose to type their details, goes straight to the details step.
  useEffect(() => { if (examCode && (user || typing) && !found) void open(examCode); }, [examCode, user?.id, typing]);

  const lookup = (event: FormEvent) => { event.preventDefault(); void open(code); };
  const join = (event: FormEvent) => { event.preventDefault(); void run(async () => {
    const seat = await examSessionAPI.join(code, name, contact);
    // Joining without an account creates one and signs it in, so ask who we are now.
    const me = user ?? await authAPI.me();
    onUser(me);
    onJoined({ user_id: me.id, seat, reference: newSpendReference(), skew_ms: Date.parse(seat.now) - Date.now() });
  }, "You could not be added to this exam."); };
  const restart = () => { setFound(null); setTyping(false); setError(""); setContact(""); };

  const who = user
    ? <p className="join-who">Signed in as <strong>{user.display_name}</strong>. <button type="button" className="join-link" disabled={busy} onClick={() => { restart(); void onLogout(); }}>Not you? Sign out</button></p>
    : null;
  const seatLabel = pc?.status === "paired" ? `PC ${pc.number} · ${pc.centre_name}` : "";

  if (found) return <Page title={found.title} lead={<>{seatLabel || found.centre_name} · starts {formatWhen(found.starts_at)}</>}>
    <h2>Your details</h2>
    <p className="auth-subtitle">Your centre uses these to match the result to you.</p>
    {error && <div className="form-error" role="alert">{error}</div>}
    <form className="join-form" onSubmit={join}>
      <label>Full name<input required maxLength={120} autoComplete="off" autoFocus value={name} onChange={e => setName(e.target.value)} /></label>
      <label>Phone or Telegram username<input required maxLength={64} autoComplete="off" placeholder="+998 90 123 45 67 or @username" value={contact} onChange={e => setContact(e.target.value)} /></label>
      <button className="btn btn-primary" disabled={busy}>{busy ? "Joining…" : "Join the exam"}</button>
    </form>
    {who}
    {user && <p className="join-note">Joining adds your account to {found.centre_name}.</p>}
    {!(exam && user) && <button type="button" className="join-link" disabled={busy} onClick={restart}>{exam ? "Back to the QR code" : "Use a different exam code"}</button>}
  </Page>;

  if (pc?.status === "pending" && pc.pair_code) return <Page title={<>Add this<br />computer.</>} lead="Your centre's administrator approves it once. After that it shows a QR code for students whenever one of your exams is near.">
    <h2>Scan to approve</h2>
    <p className="auth-subtitle">Scan with the administrator's phone, or open Exam day in the admin panel and type this code.</p>
    <div className="pc-qr"><QR value={approveURL(pc.pair_code)} label="QR code that opens the admin panel to approve this computer" /></div>
    <strong className="pc-code num" aria-label="Pairing code">{pc.pair_code}</strong>
    <p className="join-note" role="status">Waiting for approval. This screen changes by itself.</p>
  </Page>;

  if (showQR) return <Page title={exam.title} lead={<>{seatLabel} · starts {formatWhen(exam.starts_at)}</>}>
    <h2>Scan to take this seat</h2>
    <p className="auth-subtitle">Open your phone camera, scan, and press <strong>Start</strong> in Telegram. This computer signs you in.</p>
    {error && <div className="form-error" role="alert">{error}</div>}
    <div className="pc-qr">{loginURL ? <QR value={loginURL} label="QR code that signs you in on this computer through Telegram" /> : <span role="status">Preparing the code…</span>}</div>
    <p className="join-who"><button type="button" className="join-link" disabled={busy} onClick={() => setTyping(true)}>No Telegram? Type your details</button></p>
  </Page>;

  if (exam && user) return <Page title={exam.title} lead={seatLabel}>
    <h2>Opening your exam…</h2>
    {error && <div className="form-error" role="alert">{error}</div>}
    {who}
  </Page>;

  if (pc?.status === "paired" && !typing) return <Page title={<>PC {pc.number}</>} lead={pc.centre_name}>
    <h2>{pc.session ? pc.session.title : "No exam right now"}</h2>
    <p className="auth-subtitle">{pc.session
      ? `Starts ${formatWhen(pc.session.starts_at)}. The QR code for students appears here 1 hour before. Leave this page open.`
      : "When your administrator schedules an exam on this computer, the QR code for students appears here. Leave this page open."}</p>
    {who}
    <p className="join-who"><button type="button" className="join-link" onClick={() => setTyping(true)}>Type an exam code instead</button></p>
  </Page>;

  return <Page title={<>Join your<br />mock exam.</>} lead="Your centre gives you an exam code on the day. Type it here to take your seat. Your results stay with you afterwards.">
    <h2>Enter your exam code</h2>
    <p className="auth-subtitle">Six letters and numbers, from your centre.</p>
    {error && <div className="form-error" role="alert">{error}</div>}
    <form className="join-form" onSubmit={lookup}>
      <label>Exam code<input className="join-code" required autoFocus autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={9} value={code} onChange={e => setCode(normaliseCode(e.target.value))} /></label>
      <button className="btn btn-primary" disabled={busy || code.length < 6}>{busy ? "Checking…" : "Continue"}</button>
    </form>
    {who}
    {pc?.status === "paired"
      ? <p className="join-who"><button type="button" className="join-link" onClick={restart}>Back to PC {pc.number}</button></p>
      : <p className="join-who">Setting up a centre computer? <a className="join-link" href="/pc">Join PC</a></p>}
  </Page>;
}

/** After joining: wait for the start time, then begin. Starting spends one of the centre's stars. */
export function ExamLobby({ held, user, onStart, onLogout }: {
  held: HeldSeat; user: User;
  onStart: () => void;
  onLogout: () => Promise<void>;
}) {
  const { seat } = held;
  const [now, setNow] = useState(() => Date.now() + held.skew_ms);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now() + held.skew_ms), 1000);
    return () => window.clearInterval(timer);
  }, [held.skew_ms]);

  const left = Math.max(0, Math.ceil((Date.parse(seat.starts_at) - now) / 1000));
  const ended = now >= Date.parse(seat.ends_at);
  const clock = `${left >= 3600 ? `${Math.floor(left / 3600)}:` : ""}${String(Math.floor(left / 60) % 60).padStart(left >= 3600 ? 2 : 1, "0")}:${String(left % 60).padStart(2, "0")}`;

  async function start() {
    setBusy(true); setError("");
    try { await starsAPI.spendOnFullMock(held.reference); onStart(); }
    catch (e) {
      setError(e instanceof APIError && e.status === 402
        ? "Your centre has no stars left, so the exam cannot start. Tell the administrator."
        : message(e, "The exam could not be started. Try again."));
    } finally { setBusy(false); }
  }
  // Like the real test, the exam begins at the scheduled time, not when the student decides.
  const due = !left && !ended, began = useRef(false);
  useEffect(() => { if (due && !began.current) { began.current = true; void start(); } }, [due]);

  return <Page title={seat.title} lead={<>{seat.centre_name} · {formatWhen(seat.starts_at)}</>}>
    <h2>{ended ? "This exam has ended" : left ? "You are in" : "Ready to start"}</h2>
    <p className="auth-subtitle">{ended
      ? "The exam window is closed. Ask your centre if you still need to sit it."
      : left ? `${user.display_name}, your seat is saved. Put your headphones on: the exam starts by itself at the scheduled time.` : `${user.display_name}, put your headphones on. Listening comes first.`}</p>
    {!ended && left > 0 && <strong className="join-clock num" role="timer" aria-label="Time until the exam starts">{clock}</strong>}
    {error && <div className="form-error" role="alert">{error}</div>}
    {!ended && <button className="btn btn-primary" disabled={busy || left > 0} onClick={() => void start()}>{busy ? "Starting…" : left ? "Starts soon" : "Start the exam"}</button>}
    <ClaimResults />
    <p className="join-who"><button type="button" className="join-link" disabled={busy} onClick={() => void onLogout()}>Not {user.display_name}? Sign out</button></p>
  </Page>;
}
