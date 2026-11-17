import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { AdminDateFilter, AdminFilter, AdminFilters, AdminHeading, inDays, useAdminScope, useSearch } from "./AdminResource";
import { Centre, centresAPI } from "./centres";
import { CentrePC, ExamPaper, ExamParticipant, ExamSession, examSessionAPI, formatWhen, normaliseCode } from "./examSession";
import { DEFAULT_COSTS as COSTS } from "./stars";

const message = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);
// The panel lives on panel.<site> and main.<site>; students and computers use the site itself.
const site = window.location.host.replace(/^(panel|main)\./, "");

function statusOf(session: ExamSession, now = Date.now()) {
  if (now >= Date.parse(session.ends_at)) return "Ended";
  return now >= Date.parse(session.starts_at) ? "Open now" : "Upcoming";
}

/**
 * A centre administrator adds the room's computers once, then schedules a
 * mock on them. Each chosen computer shows a QR code for students from one
 * hour before the start. The exam code is the fallback for anyone else.
 *
 * Platform staff see every centre's exam days here, and schedule one for the
 * centre they pick. Pairing a computer stays with the centre: it is done by
 * someone standing in the room.
 */
export default function ExamSessions({ refreshMs = 15000 }: { refreshMs?: number }) {
  const { admin } = useAdminScope();
  const platform = !!admin && !admin.centre_id;
  const [centres, setCentres] = useState<Centre[]>([]);
  // The centre a platform administrator is scheduling for.
  const [centre, setCentre] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [centreFilter, setCentreFilter] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
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
  const [ownAI, setOwnAI] = useState(true);
  useEffect(() => {
    if (platform) centresAPI.list().then(setCentres).catch(() => undefined);
    else centresAPI.mine().then(c => setOwnAI(c.ai_enabled)).catch(() => undefined);
  }, [platform]);
  const target = centres.find(c => c.id === centre);
  const aiAllowed = platform ? target?.ai_enabled ?? true : ownAI;
  // Whose stars and whose teachers the copy is about.
  const payer = platform ? target?.name ?? "the centre" : "your centre";
  const teachers = platform ? "the centre's teachers" : "your teachers";
  const queue = platform ? "the centre's Marking queue" : "your Marking queue";
  const perStudent = COSTS.listening + COSTS.reading + (aiAllowed && aiWriting ? COSTS.writing : 0) + (aiAllowed && aiSpeaking ? COSTS.speaking : 0);
  // A phone that scanned a computer's QR arrives with ?pc=<pairing code>.
  const [pairCode, setPairCode] = useState(() => normaliseCode(new URLSearchParams(window.location.search).get("pc") ?? ""));
  const [added, setAdded] = useState("");
  const [roster, setRoster] = useState<Record<string, ExamParticipant[]>>({});
  const [copied, setCopied] = useState("");

  async function load() {
    try { const result = await examSessionAPI.list(centre || undefined); setSessions(result.sessions ?? []); setPapers(result.papers ?? []); setPCs(result.pcs ?? []); }
    catch (e) { setError(message(e, "Could not load your exam days.")); }
  }
  // Reloading keeps "online" and "joined" current while the room fills.
  // A newly picked centre brings its own papers and computers.
  useEffect(() => { void load(); const timer = window.setInterval(load, refreshMs); return () => window.clearInterval(timer); }, [refreshMs, centre]);
  function pickCentre(id: string) { setCentre(id); setPapers([]); setPCs([]); setSkipped([]); setForm(f => ({ ...f, listening: "", reading: "", task1: "", task2: "" })); }

  const matching = useSearch(sessions ?? [], search, s => [s.title, s.code, s.centre_name]);
  const visible = matching.filter(s =>
    (statusFilter === "all" || statusOf(s) === statusFilter) &&
    (centreFilter === "all" || s.centre_id === centreFilter) &&
    inDays(s.starts_at, from, to));

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
      }, centre || undefined);
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

  // The link is the code already typed: a student who opens it only gives their name.
  async function copy(session: ExamSession) {
    const link = `https://${site}/join?code=${session.code}`;
    try { await navigator.clipboard.writeText(link); setCopied(session.id); window.setTimeout(() => setCopied(""), 2000); }
    catch { setError(`Copy this link manually: ${link}`); }
  }

  const ready = of("listening").length > 0 && of("reading").length > 0;
  return <div className="centres-admin">
    <AdminHeading title="Exam day" description={platform
      ? "Every learning centre's exam days: upcoming, open and ended. Pick a centre to schedule a mock for it."
      : "Add your room's computers once, then schedule a mock on them. Each computer shows a QR code that students scan with Telegram."} />
    {error && <div className="admin-listing"><p className="instruction-box" role="alert">{error}</p></div>}
    {!platform && <section className="centre-new" aria-labelledby="exam-day-pcs">
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
    </section>}
    <section className="centre-new" aria-labelledby="exam-day-new">
      <h2 id="exam-day-new">Schedule a mock</h2>
      {platform && <div className="admin-columns">
        <label>Learning centre<select value={centre} onChange={e => pickCentre(e.target.value)}><option value="">Choose a centre…</option>{centres.filter(c => !c.disabled).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      </div>}
      {platform && !centre
        ? <p className="centre-note">An exam day runs on the centre's own published papers and uses that centre's stars.</p>
        : sessions && !ready
        ? <p className="centre-note">{platform
          ? `${payer} has no published Listening and Reading exam of its own yet. An exam day runs only on the centre's own papers.`
          : "Publish one Listening and one Reading exam of your own first, in the Exams tab. They appear here once they are published."}</p>
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
            </> : <p className="centre-note">{platform ? "This centre marks its own work, so its teachers mark" : "Your centre marks its own work, so your teachers mark"} this exam's Writing and Speaking.</p>}
          </fieldset>
          <p className="centre-note">Each student who starts this exam uses <strong>{perStudent} stars</strong> from {payer}: Listening {COSTS.listening}, Reading {COSTS.reading}{aiAllowed && aiWriting ? `, AI Writing ${COSTS.writing}` : ""}{aiAllowed && aiSpeaking ? `, AI Speaking ${COSTS.speaking}` : ""}. {aiAllowed && aiWriting ? "" : `Essays go to ${queue} for ${teachers}. `}{aiAllowed && aiSpeaking ? "" : `Students record their Speaking answers, which also go to ${queue}. `}</p>
          <p className="centre-note">{chosen.length
            ? "The chosen computers show the student QR code from 1 hour before the start until the end."
            : "No computers chosen: students type the exam code at " + site + "/join."}{platform ? "" : " Add your own Writing tasks in the Writing tab to choose them here."}</p>
          <button className="primary-action" disabled={busy}>{busy ? "Scheduling…" : "Schedule the exam"}</button>
        </form>}
    </section>
    <div className="admin-listing exam-days">
      {!sessions && !error && <p className="admin-loading" role="status">Loading {platform ? "the" : "your"} exam days…</p>}
      {!!sessions?.length && <AdminFilters label="Search exam days" value={search} onChange={setSearch} placeholder={platform ? "Name, code or centre" : "Name or code"}
        count={`${visible.length} of ${sessions.length} exam days`}>
        <AdminFilter label="Status" value={statusFilter} onChange={setStatusFilter} options={[
          { value: "all", label: "All statuses" }, { value: "Upcoming", label: "Upcoming" }, { value: "Open now", label: "Open now" }, { value: "Ended", label: "Ended" }]} />
        {platform && <AdminFilter label="Centre" value={centreFilter} onChange={setCentreFilter} options={[
          { value: "all", label: "All centres" }, ...centres.map(c => ({ value: c.id, label: c.name }))]} />}
        <AdminDateFilter label="From" value={from} onChange={setFrom} />
        <AdminDateFilter label="To" value={to} onChange={setTo} />
      </AdminFilters>}
      {sessions?.length === 0 && <p className="centre-admin-empty">No exam days yet. Schedule one above.</p>}
      {!!sessions?.length && visible.length === 0 && <p className="centre-admin-empty">No exam days match these filters.</p>}
      {visible.map(session => <section className="centre" key={session.id} aria-label={session.title}>
        <div className="centre-head">
          <div><h2>{session.title}</h2><p>{platform && session.centre_name ? session.centre_name + " · " : ""}{formatWhen(session.starts_at)} – {formatWhen(session.ends_at)}</p></div>
          <button type="button" className="danger-link" onClick={() => void remove(session)}>Delete</button>
        </div>
        <div className="centre-invite">
          <label>Exam code, for students without Telegram<input className="exam-day-code" readOnly value={session.code} onFocus={e => e.target.select()} /></label>
          <button type="button" className="secondary-action" onClick={() => void copy(session)}>{copied === session.id ? "Link copied" : "Copy invite link"}</button>
        </div>
        <dl className="centre-facts">
          <div><dt>Status</dt><dd>{statusOf(session)}</dd></div>
          <div><dt>Joined</dt><dd>{session.joined} of {session.seats}</dd></div>
          {session.pcs?.length > 0 && <div><dt>Computers</dt><dd>PC {session.pcs.join(", ")}</dd></div>}
          <div><dt>Writing</dt><dd>{session.ai_writing ? "Marked by AI" : `Marked by ${teachers}`}</dd></div>
          <div><dt>Speaking</dt><dd>{session.ai_speaking ? "AI interview" : `Marked by ${teachers}`}</dd></div>
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
