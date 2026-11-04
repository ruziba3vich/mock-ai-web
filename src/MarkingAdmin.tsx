import { useEffect, useState } from "react";
import { BANDS, CRITERIA, MarkingItem, MarkingTurn, Review, Skill, markingAPI } from "./marking";

/**
 * The marking queue, for a centre that assesses its own students.
 *
 * A centre with AI switched off captures essays and recordings and parks them
 * here. Until this screen existed the work could be captured and never acted
 * on, which is the worst of both worlds: the student waits and nobody can
 * reach what they submitted.
 *
 * The band a marker enters is their own, not an average of their criterion
 * scores. A marker who disagrees with their own sub-scores is making a
 * judgement, not a mistake.
 */
export default function MarkingAdmin() {
  const [queue, setQueue] = useState<{ writing: MarkingItem[]; speaking: MarkingItem[] }>({ writing: [], speaking: [] });
  const [open, setOpen] = useState<{ skill: Skill; item: MarkingItem } | null>(null);
  const [message, setMessage] = useState("");
  const [loaded, setLoaded] = useState(false);

  async function load() {
    try {
      setQueue(await markingAPI.queue());
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not load the marking queue.");
    } finally {
      setLoaded(true);
    }
  }
  useEffect(() => { void load(); }, []);

  if (open) {
    return <MarkingSheet
      skill={open.skill}
      item={open.item}
      onCancel={() => setOpen(null)}
      onPublished={async () => {
        setOpen(null);
        setMessage("Marked. The student can read it now.");
        await load();
      }}
    />;
  }

  const total = queue.writing.length + queue.speaking.length;
  return <div className="marking-admin">
    <header className="admin-page-heading">
      <h1>Marking</h1>
      <p>Work your students have submitted for your centre to assess. Nothing here has been sent to a model.</p>
    </header>
    {message && <p className="instruction-box" role="status">{message}</p>}
    {loaded && total === 0 && <p className="marking-empty">Nothing is waiting. Submitted essays and interviews appear here.</p>}
    {(["writing", "speaking"] as Skill[]).map(skill => queue[skill].length > 0 && (
      <section className="marking-group" key={skill}>
        <h2>{skill === "writing" ? "Essays" : "Interviews"} <span>{queue[skill].length}</span></h2>
        <ul className="marking-list">
          {queue[skill].map(item => (
            <li key={item.id}>
              <div>
                <strong>{item.student_name}</strong>
                <span>{item.title}</span>
                <small>{item.answers ? `${item.answers} answers · ` : ""}{when(item.submitted_at)}</small>
              </div>
              <button className="secondary-action" onClick={() => { setMessage(""); setOpen({ skill, item }); }}>Mark</button>
            </li>
          ))}
        </ul>
      </section>
    ))}
  </div>;
}

function MarkingSheet({ skill, item, onCancel, onPublished }: {
  skill: Skill; item: MarkingItem; onCancel: () => void; onPublished: () => Promise<void>;
}) {
  const criteria = CRITERIA[skill];
  const [overall, setOverall] = useState(6);
  const [summary, setSummary] = useState("");
  const [scores, setScores] = useState<Record<string, number>>(() =>
    Object.fromEntries(criteria.map(c => [c.key, 6])));
  const [reasons, setReasons] = useState<Record<string, string>>(() =>
    Object.fromEntries(criteria.map(c => [c.key, ""])));
  const [improve, setImprove] = useState<Record<string, string>>(() =>
    Object.fromEntries(criteria.map(c => [c.key, ""])));
  const [turns, setTurns] = useState<MarkingTurn[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (skill !== "speaking") return;
    markingAPI.turns(item.id).then(setTurns).catch(() => setError("Could not load the recordings."));
  }, [skill, item.id]);

  async function publish(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setError("");
    const review: Review = {
      overall, summary,
      criteria: criteria.map(c => ({ key: c.key, score: scores[c.key], reason: reasons[c.key], how_to_improve: improve[c.key] })),
      strengths: [], next_steps: [],
    };
    try {
      await markingAPI.publish(skill, item.id, review);
      await onPublished();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not publish this mark.");
    } finally { setBusy(false); }
  }

  return <div className="marking-admin">
    <header className="admin-page-heading">
      <button className="marking-back" onClick={onCancel}>← Back to the queue</button>
      <h1>{item.student_name}</h1>
      <p>{item.title}</p>
    </header>

    <section className="marking-work">
      {skill === "writing"
        ? <article className="marking-essay"><h2>Essay</h2><p>{item.essay}</p></article>
        : <article><h2>Answers</h2>
            {turns.length === 0 && <p className="marking-empty">Loading the recordings…</p>}
            <ol className="marking-turns">
              {turns.filter(t => t.answered && !t.skipped).map(turn => (
                <li key={turn.position}>
                  <div><strong>Part {turn.part}</strong><span>{turn.prompt}</span></div>
                  <audio controls preload="none" src={markingAPI.recording(item.id, turn.position)} />
                  {turn.transcript && <p className="marking-transcript">{turn.transcript}</p>}
                </li>
              ))}
            </ol>
          </article>}
    </section>

    <form className="marking-form" onSubmit={publish}>
      {error && <p className="instruction-box" role="alert">{error}</p>}
      <label className="marking-overall">
        Overall band
        <select value={overall} onChange={e => setOverall(Number(e.target.value))}>
          {BANDS.map(b => <option key={b} value={b}>{b.toFixed(1)}</option>)}
        </select>
        <small>Your judgement, not an average of the four below.</small>
      </label>
      {criteria.map(c => (
        <fieldset key={c.key}>
          <legend>{c.label}</legend>
          <div className="admin-columns">
            <label>Band
              <select value={scores[c.key]} onChange={e => setScores({ ...scores, [c.key]: Number(e.target.value) })}>
                {BANDS.map(b => <option key={b} value={b}>{b.toFixed(1)}</option>)}
              </select>
            </label>
            <label>What they did<input value={reasons[c.key]} maxLength={2000}
              onChange={e => setReasons({ ...reasons, [c.key]: e.target.value })} /></label>
            <label>What to change<input value={improve[c.key]} maxLength={2000}
              onChange={e => setImprove({ ...improve, [c.key]: e.target.value })} /></label>
          </div>
        </fieldset>
      ))}
      <label>Summary
        <textarea rows={4} maxLength={4000} required value={summary} onChange={e => setSummary(e.target.value)}
          placeholder="What this student should take away from this piece." />
      </label>
      <div className="marking-actions">
        <button type="button" className="secondary-action" onClick={onCancel} disabled={busy}>Cancel</button>
        <button className="primary-action" disabled={busy || !summary.trim()}>
          {busy ? "Publishing…" : "Publish to the student"}
        </button>
      </div>
    </form>
  </div>;
}

/** A submission time a marker can read at a glance. */
function when(value: string) {
  const at = new Date(value);
  if (Number.isNaN(at.getTime())) return "";
  const days = Math.floor((Date.now() - at.getTime()) / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return at.toLocaleDateString();
}
