import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { AdminHeading } from "./AdminResource";
import { centresAPI } from "./centres";
import { CentrePC, ExamPaper, ExamParticipant, ExamSession, examSessionAPI, formatWhen, normaliseCode } from "./examSession";
import { DEFAULT_COSTS as COSTS } from "./stars";

const message = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);
// The panel lives on panel.<site>; students and computers use the site itself.
const site = window.location.host.replace(/^panel\./, "");

function statusOf(session: ExamSession, now = Date.now()) {
  if (now >= Date.parse(session.ends_at)) return "Ended";
  return now >= Date.parse(session.starts_at) ? "Open now" : "Upcoming";
}

/**
 * A centre administrator adds the room's computers once, then schedules a
 * mock on them. Each chosen computer shows a QR code for students from one
 * hour before the start. The exam code is the fallback for anyone else.
 */
export default function ExamSessions({ refreshMs = 15000 }: { refreshMs?: number }) {
  const [sessions, setSessions] = useState<ExamSession[] | null>(null);
  const [papers, setPapers] = useState<ExamPaper[]>([]);
  const [pcs, setPCs] = useState<CentrePC[]>([]);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ title: "", starts: "", ends: "", seats: "20", listening: "", reading: "", task1: "", task2: "" });
  const [aiWriting, setAIWriting] = useState(true);
  const [aiSpeaking, setAISpeaking] = useState(true);
  // A centre that marks its own work cannot switch AI on for one exam.
  const [aiAllowed, setAIAllowed] = useState(true);
  useEffect(() => { centresAPI.mine().then(c => setAIAllowed(c.ai_enabled)).catch(() => undefined); }, []);
  const perStudent = COSTS.listening + COSTS.reading + (aiAllowed && aiWriting ? COSTS.writing : 0) + (aiAllowed && aiSpeaking ? COSTS.speaking : 0);
  // A phone that scanned a computer's QR arrives with ?pc=<pairing code>.
  const [pairCode, setPairCode] = useState(() => normaliseCode(new URLSearchParams(window.location.search).get("pc") ?? ""));
  const [added, setAdded] = useState("");
  const [roster, setRoster] = useState<Record<string, ExamParticipant[]>>({});
  const [copied, setCopied] = useState("");

  async function load() {
    try { const result = await examSessionAPI.list(); setSessions(result.sessions ?? []); setPapers(result.papers ?? []); setPCs(result.pcs ?? []); }
    catch (e) { setError(message(e, "Could not load your exam days.")); }
  }
  // Reloading keeps "online" and "joined" current while the room fills.
  useEffect(() => { void load(); const timer = window.setInterval(load, refreshMs); return () => window.clearInterval(timer); }, [refreshMs]);

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm(f => ({ ...f, [key]: e.target.value }));
  const of = (skill: ExamPaper["skill"]) => papers.filter(p => p.skill === skill);
  const chosen = pcs.filter(pc => !skipped.includes(pc.id));

  async function addPC(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError(""); setAdded("");
    try {
      const pc = await examSessionAPI.approvePC(pairCode);
      setPCs(list => [...list, pc]); setPairCode(""); setAdded(`PC ${pc.number} added. It is ready for your next exam.`);
      window.history.replaceState(null, "", window.location.pathname);
    } catch (e) { setError(message(e, "The computer could not be added.")); }
    finally { setBusy(false); }
  }

  async function removePC(pc: CentrePC) {
    if (!window.confirm(`Remove PC ${pc.number}? It leaves any exam it was chosen for, and must be added again to be used.`)) return;
    try { await examSessionAPI.removePC(pc.id); setPCs(list => list.filter(p => p.id !== pc.id)); }
    catch (e) { setError(message(e, "The computer could not be removed.")); }
  }

  async function create(event: FormEvent) {
    event.preventDefault();
    if (Date.parse(form.ends) <= Date.parse(form.starts)) { setError("The exam must end after it starts."); return; }
    setBusy(true); setError("");
    try {
      const created = await examSessionAPI.create({
        title: form.title, starts_at: new Date(form.starts).toISOString(), ends_at: new Date(form.ends).toISOString(),
        listening_exam_id: form.listening, reading_exam_id: form.reading,
        writing_task1_content_id: form.task1, writing_task2_content_id: form.task2,
        seats: chosen.length || Number(form.seats), pc_ids: chosen.map(pc => pc.id),
        ai_writing: aiAllowed && aiWriting, ai_speaking: aiAllowed && aiSpeaking,
      });
      setSessions(list => [created, ...(list ?? [])]);
      setForm(f => ({ ...f, title: "", starts: "", ends: "" }));
    } catch (e) { setError(message(e, "The exam day could not be scheduled.")); }
    finally { setBusy(false); }
  }

  async function toggleRoster(id: string) {
    if (roster[id]) { setRoster(({ [id]: _, ...rest }) => rest); return; }
    try { const people = await examSessionAPI.participants(id); setRoster(r => ({ ...r, [id]: people })); }
    catch (e) { setError(message(e, "Could not load the students.")); }
  }

  async function remove(session: ExamSession) {
    if (!window.confirm(`Delete "${session.title}"? Its code stops working. Results students already have are kept.`)) return;
    try { await examSessionAPI.remove(session.id); setSessions(list => (list ?? []).filter(s => s.id !== session.id)); }
    catch (e) { setError(message(e, "The exam day could not be deleted.")); }
  }

  async function copy(session: ExamSession) {
    try { await navigator.clipboard.writeText(session.code); setCopied(session.id); window.setTimeout(() => setCopied(""), 2000); }
    catch { setError(`Copy this code manually: ${session.code}`); }
  }

  const ready = of("listening").length > 0 && of("reading").length > 0;
  return <div className="centres-admin">
    <AdminHeading title="Exam day" description="Add your room's computers once, then schedule a mock on them. Each computer shows a QR code that students scan with Telegram." />
    {error && <div className="admin-listing"><p className="instruction-box" role="alert">{error}</p></div>}
    <section className="centre-new" aria-labelledby="exam-day-pcs">
      <h2 id="exam-day-pcs">Computers</h2>
      {sessions && (pcs.length
        ? <ul className="centre-admin-list exam-day-pcs">{pcs.map(pc => <li key={pc.id}>
          <div><strong>PC {pc.number}</strong><span>{pc.online ? "Online" : "Offline: open " + site + "/join on it"}</span></div>
          <button type="button" className="danger-link" aria-label={`Remove PC ${pc.number}`} onClick={() => void removePC(pc)}>Remove</button>
        </li>)}</ul>
        : <p className="centre-note">No computers yet. On each exam-room computer open {site}/pc. It shows a QR code and a 6-character code.</p>)}
      <form onSubmit={addPC}>
        <div className="centre-invite">
          <label>Code on the computer's screen<input className="exam-day-code" required autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={9} value={pairCode} onChange={e => setPairCode(normaliseCode(e.target.value))} /></label>
          <button className="secondary-action" disabled={busy || pairCode.length < 6}>Add this computer</button>
        </div>
        {added && <p className="centre-note" role="status">{added}</p>}
      </form>
    </section>
    <section className="centre-new" aria-labelledby="exam-day-new">
      <h2 id="exam-day-new">Schedule a mock</h2>
      {sessions && !ready
        ? <p className="centre-note">Publish one Listening and one Reading exam of your own first, in the Exams tab. They appear here once they are published.</p>
        : <form onSubmit={create}>
          <div className="admin-columns">
            <label>Name<input required maxLength={120} placeholder="Saturday mock" value={form.title} onChange={set("title")} /></label>
            <label>Starts<input required type="datetime-local" value={form.starts} onChange={set("starts")} /></label>
            <label>Ends<input required type="datetime-local" value={form.ends} onChange={set("ends")} /></label>
            {chosen.length === 0 && <label>Seats<input required type="number" min={1} max={500} value={form.seats} onChange={set("seats")} /></label>}
          </div>
          <div className="admin-columns">
            <label>Listening paper<select required value={form.listening} onChange={set("listening")}><option value="">Choose…</option>{of("listening").map(p => <option key={p.id} value={p.id}>{p.title}</option>)}</select></label>
            <label>Reading paper<select required value={form.reading} onChange={set("reading")}><option value="">Choose…</option>{of("reading").map(p => <option key={p.id} value={p.id}>{p.title}</option>)}</select></label>
          </div>
          <div className="admin-columns">
            <label>Writing Task 1<select value={form.task1} onChange={set("task1")}><option value="">Random for each student</option>{of("writing_task_1").map(p => <option key={p.id} value={p.id}>{p.title}</option>)}</select></label>
            <label>Writing Task 2<select value={form.task2} onChange={set("task2")}><option value="">Random for each student</option>{of("writing_task_2").map(p => <option key={p.id} value={p.id}>{p.title}</option>)}</select></label>
          </div>
          {pcs.length > 0 && <fieldset className="exam-day-pick">
            <legend>Computers in this exam ({chosen.length} of {pcs.length})</legend>
            {pcs.map(pc => <label key={pc.id}><input type="checkbox" checked={!skipped.includes(pc.id)} onChange={e => setSkipped(list => e.target.checked ? list.filter(id => id !== pc.id) : [...list, pc.id])} />PC {pc.number}</label>)}
          </fieldset>}
          <fieldset className="exam-day-pick">
            <legend>AI in this exam</legend>
            {aiAllowed ? <>
              <label><input type="checkbox" checked={aiWriting} onChange={e => setAIWriting(e.target.checked)} />AI marks Writing (+{COSTS.writing} stars per student)</label>
              <label><input type="checkbox" checked={aiSpeaking} onChange={e => setAISpeaking(e.target.checked)} />AI Speaking interview (+{COSTS.speaking} stars per student)</label>
            </> : <p className="centre-note">Your centre marks its own work, so this exam has no AI marking and no Speaking interview.</p>}
          </fieldset>
          <p className="centre-note">Each student who starts this exam uses <strong>{perStudent} stars</strong> from your centre: Listening {COSTS.listening}, Reading {COSTS.reading}{aiAllowed && aiWriting ? `, AI Writing ${COSTS.writing}` : ""}{aiAllowed && aiSpeaking ? `, AI Speaking ${COSTS.speaking}` : ""}. {aiAllowed && aiWriting ? "" : "Essays go to your Marking queue for your teachers. "}{aiAllowed && aiSpeaking ? "" : "The exam ends after Writing. "}</p>
          <p className="centre-note">{chosen.length
            ? "The chosen computers show the student QR code from 1 hour before the start until the end."
            : "No computers chosen: students type the exam code at " + site + "/join."} Add your own Writing tasks in the Writing tab to choose them here.</p>
          <button className="primary-action" disabled={busy}>{busy ? "Scheduling…" : "Schedule the exam"}</button>
        </form>}
    </section>
    <div className="admin-listing exam-days">
      {!sessions && !error && <p className="admin-loading" role="status">Loading your exam days…</p>}
      {sessions?.length === 0 && <p className="centre-admin-empty">No exam days yet. Schedule one above.</p>}
      {sessions?.map(session => <section className="centre" key={session.id} aria-label={session.title}>
        <div className="centre-head">
          <div><h2>{session.title}</h2><p>{formatWhen(session.starts_at)} – {formatWhen(session.ends_at)}</p></div>
          <button type="button" className="danger-link" onClick={() => void remove(session)}>Delete</button>
        </div>
        <div className="centre-invite">
          <label>Exam code, for students without Telegram<input className="exam-day-code" readOnly value={session.code} onFocus={e => e.target.select()} /></label>
          <button type="button" className="secondary-action" onClick={() => void copy(session)}>{copied === session.id ? "Copied" : "Copy"}</button>
        </div>
        <dl className="centre-facts">
          <div><dt>Status</dt><dd>{statusOf(session)}</dd></div>
          <div><dt>Joined</dt><dd>{session.joined} of {session.seats}</dd></div>
          {session.pcs?.length > 0 && <div><dt>Computers</dt><dd>PC {session.pcs.join(", ")}</dd></div>}
          <div><dt>Writing</dt><dd>{session.ai_writing ? "Marked by AI" : "Marked by your teachers"}</dd></div>
          <div><dt>Speaking</dt><dd>{session.ai_speaking ? "AI interview" : "Not included"}</dd></div>
          <div><dt>Stars per student</dt><dd>{COSTS.listening + COSTS.reading + (session.ai_writing ? COSTS.writing : 0) + (session.ai_speaking ? COSTS.speaking : 0)}</dd></div>
        </dl>
        <button type="button" className="centre-admins-toggle" aria-expanded={!!roster[session.id]} onClick={() => void toggleRoster(session.id)}>{roster[session.id] ? "Hide students" : "Show students"}</button>
        {roster[session.id] && (roster[session.id].length
          ? <ul className="centre-admin-list">{roster[session.id].map(p => <li key={p.user_id}><div><strong>{p.pc ? `PC ${p.pc}: ` : ""}{p.full_name}</strong><span>{p.contact}</span></div><span>Joined {formatWhen(p.joined_at)}</span></li>)}</ul>
          : <p className="centre-admin-empty">Nobody has joined yet.</p>)}
      </section>)}
    </div>
  </div>;
}
