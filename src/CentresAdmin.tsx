import { useEffect, useState } from "react";
import { Centre, centresAPI, inviteLink } from "./centres";
import CentreAdmins from "./CentreAdmins";

const BOT = (import.meta.env.VITE_TELEGRAM_BOT as string | undefined) || "mockai_bot";

/**
 * Learning centres, for platform administrators only.
 *
 * The job this screen exists for is handing a centre its invite link, so that
 * is the thing the row leads with rather than a detail behind an edit form:
 * everything else about a centre can wait, but without the link its students
 * cannot get in at all.
 */
export default function CentresAdmin() {
  const [centres, setCentres] = useState<Centre[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [includeGlobal, setIncludeGlobal] = useState(true);
  const [aiEnabled, setAiEnabled] = useState(true);
  const [copied, setCopied] = useState("");

  async function load() {
    try {
      setCentres(await centresAPI.list());
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not load learning centres.");
    } finally {
      setLoaded(true);
    }
  }
  useEffect(() => { void load(); }, []);

  async function create() {
    setBusy(true); setMessage("");
    try {
      const centre = await centresAPI.create(name, slug, includeGlobal, aiEnabled);
      setName(""); setSlug(""); setIncludeGlobal(true); setAiEnabled(true);
      setMessage(`${centre.name} is ready. Send them the invite link below.`);
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not create the centre.");
    } finally { setBusy(false); }
  }

  async function change(centre: Centre, patch: Partial<Centre>) {
    setBusy(true); setMessage("");
    const previous = centres;
    setCentres(centres.map(v => (v.id === centre.id ? { ...v, ...patch } : v)));
    try {
      await centresAPI.update({ ...centre, ...patch });
      await load();
    } catch (e) {
      setCentres(previous);
      setMessage(e instanceof Error ? e.message : "Could not save the centre.");
    } finally { setBusy(false); }
  }

  async function copy(centre: Centre) {
    const link = inviteLink(centre, BOT);
    try {
      await navigator.clipboard.writeText(link);
      setCopied(centre.id);
      window.setTimeout(() => setCopied(""), 2000);
    } catch {
      // Clipboard access can be refused; the link is on screen either way.
      setMessage(`Copy this link manually: ${link}`);
    }
  }

  return <div className="centres-admin">
    <header className="admin-page-heading">
      <h1>Learning centres</h1>
      <p>Each centre keeps its own exams and content. Students who open a centre's invite see that centre's material; students who find mock-ai on their own see the global library.</p>
    </header>
    {message && <p className="instruction-box" role="status">{message}</p>}

    <section className="centre-new">
      <h2>Add a centre</h2>
      <form onSubmit={e => { e.preventDefault(); void create(); }}>
        <div className="admin-columns">
          <label>Centre name<input required maxLength={120} placeholder="Oxford Study Centre" value={name}
            onChange={e => {
              setName(e.target.value);
              // Offer a slug until the operator types their own, so the common
              // case is one field rather than two.
              if (!slug || slug === suggest(name)) setSlug(suggest(e.target.value));
            }} /></label>
          <label>Short name in links<input required pattern="[a-z0-9][a-z0-9-]{1,38}[a-z0-9]" placeholder="oxford-study"
            value={slug} onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} /></label>
        </div>
        <label className="centre-toggle">
          <input type="checkbox" checked={includeGlobal} onChange={e => setIncludeGlobal(e.target.checked)} />
          <span>Also give their students the global library<small>Turn this off for a centre that teaches only its own material. Their students would otherwise start with an empty app.</small></span>
        </label>
        <label className="centre-toggle">
          <input type="checkbox" checked={aiEnabled} onChange={e => setAiEnabled(e.target.checked)} />
          <span>Use AI marking and the speaking examiner<small>Turn this off and nothing the centre produces is sent to a model: essays and recordings are captured for the centre to mark itself, the speaking interview is read on screen rather than spoken, and importing a paper from PDF is closed. Reading and Listening are scored from the answer key either way.</small></span>
        </label>
        <button className="primary-action" disabled={busy || !name || !slug}>{busy ? "Adding…" : "Add centre"}</button>
      </form>
    </section>

    {loaded && centres.length === 0 && <p className="centre-empty">No centres yet. Every student is on the global library until you add one.</p>}

    <ul className="centre-list">
      {centres.map(centre => <li key={centre.id} className={centre.disabled ? "centre disabled" : "centre"}>
        <div className="centre-head">
          <div>
            <h2>{centre.name}</h2>
            <p>{centre.students} {centre.students === 1 ? "student" : "students"} · {centre.exams} {centre.exams === 1 ? "exam" : "exams"} · {centre.include_global ? "global library included" : "own material only"} · {centre.ai_enabled ? "AI marking" : "marked by the centre"}</p>
          </div>
          {centre.disabled && <span className="status-chip status-archived">Closed to new students</span>}
        </div>
        <div className="centre-invite">
          <label>Invite link<input readOnly value={inviteLink(centre, BOT)} onFocus={e => e.target.select()} /></label>
          <button type="button" className="secondary-action" onClick={() => void copy(centre)}>{copied === centre.id ? "Copied" : "Copy"}</button>
        </div>
        <div className="centre-controls">
          <label className="centre-toggle">
            <input type="checkbox" checked={centre.include_global} disabled={busy}
              onChange={e => void change(centre, { include_global: e.target.checked })} />
            <span>Global library</span>
          </label>
          <label className="centre-toggle">
            <input type="checkbox" checked={centre.ai_enabled} disabled={busy}
              onChange={e => void change(centre, { ai_enabled: e.target.checked })} />
            <span>AI marking</span>
          </label>
          <button type="button" className="danger-link" disabled={busy}
            onClick={() => void change(centre, { disabled: !centre.disabled })}>
            {centre.disabled ? "Reopen to new students" : "Close to new students"}
          </button>
        </div>
        <CentreAdmins centre={centre} />
      </li>)}
    </ul>
  </div>;
}

/** A url-safe short name derived from what the operator is already typing. */
function suggest(name: string) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
}
