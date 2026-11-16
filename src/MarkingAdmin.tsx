import { useEffect, useMemo, useState } from "react";
import { BANDS, MarkingItem, MarkingTurn, Skill, WRITING_CRITERIA, interviewBand, markingAPI } from "./marking";
import { AdminFilter, AdminFilters, AdminHeading, AdminSheet, AdminTable, useAdminScope, useSearch } from "./AdminResource";

/**
 * The marking queue, for a centre that assesses its own students.
 *
 * A centre with AI switched off captures essays and recordings and parks them
 * here. Until this screen existed the work could be captured and never acted
 * on, which is the worst of both worlds: the student waits and nobody can
 * reach what they submitted.
 *
 * Essays and interviews are one queue with a skill filter rather than two
 * stacked lists: a marker works through what is oldest, and splitting the
 * queue by skill hid how much was actually waiting.
 *
 * The band a marker enters for an essay is their own, not an average of their
 * criterion scores. A marker who disagrees with their own sub-scores is making
 * a judgement, not a mistake. An interview is the other way round: the marker
 * gives each part a band and the overall band is worked out from those.
 */
type Waiting = MarkingItem & { skill: Skill };

export default function MarkingAdmin() {
  const { can } = useAdminScope();
  const mayMark = can("marking");
  const [queue, setQueue] = useState<{ writing: MarkingItem[]; speaking: MarkingItem[] }>({ writing: [], speaking: [] });
  const [open, setOpen] = useState<Waiting | null>(null);
  const [message, setMessage] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState("");
  const [skillFilter, setSkillFilter] = useState("all");

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

  const waiting = useMemo<Waiting[]>(() => [
    ...queue.writing.map(item => ({ ...item, skill: "writing" as Skill })),
    ...queue.speaking.map(item => ({ ...item, skill: "speaking" as Skill })),
  ].sort((a, b) => a.submitted_at.localeCompare(b.submitted_at)), [queue]);
  const matching = useSearch(waiting, query, item => [item.student_name, item.title]);
  const filtered = useMemo(() => matching.filter(item => skillFilter === "all" || item.skill === skillFilter), [matching, skillFilter]);

  return <div className="marking-admin">
    <AdminHeading title="Marking"
      description="Work your students have submitted for your centre to assess. Nothing here has been sent to a model." />
    {message && !open && <p className="instruction-box" role="status">{message}</p>}
    <div className="admin-listing">
      <AdminFilters label="Search submissions" value={query} onChange={setQuery} placeholder="Student or task"
        count={`${filtered.length} of ${waiting.length} waiting`}>
        <AdminFilter label="Skill" value={skillFilter} onChange={setSkillFilter} options={[
          { value: "all", label: `Everything (${waiting.length})` },
          { value: "writing", label: `Essays (${queue.writing.length})` },
          { value: "speaking", label: `Interviews (${queue.speaking.length})` }]} />
      </AdminFilters>
      <AdminTable label="Marking queue" noun="submissions" action={mayMark ? "Mark" : "Read"}
        columns={[
          { key: "student", label: "Student", width: "minmax(180px,1.4fr)" },
          { key: "task", label: "Task", width: "minmax(220px,2fr)" },
          { key: "skill", label: "Skill", width: "120px" },
          { key: "work", label: "Submitted work", width: "minmax(130px,1fr)" },
          { key: "when", label: "Waiting since", width: "minmax(120px,1fr)" }]}
        rows={filtered.map(item => ({
          id: `${item.skill}-${item.id}`,
          openLabel: `${mayMark ? "Mark" : "Read"} ${item.student_name}`,
          selected: open?.id === item.id,
          open: () => { setMessage(""); setOpen(item); },
          cells: [
            <strong>{item.student_name}</strong>,
            item.title,
            item.skill === "writing" ? "Essay" : "Interview",
            item.answers ? `${item.answers} answers` : "Essay",
            when(item.submitted_at)],
        }))}
        empty={loaded ? (waiting.length ? "Nothing matches these filters." : "Nothing is waiting. Submitted essays and interviews appear here.") : "Loading the queue…"} />
    </div>
    {open && <AdminSheet wide title={open.student_name} subtitle={open.title} onClose={() => setOpen(null)}>
      <MarkingSheet
        skill={open.skill}
        item={open}
        mayMark={mayMark}
        onCancel={() => setOpen(null)}
        onPublished={async () => {
          setOpen(null);
          setMessage("Marked. The student can read it now.");
          await load();
        }}
      />
    </AdminSheet>}
  </div>;
}

function MarkingSheet({ skill, item, mayMark, onCancel, onPublished }: {
  skill: Skill; item: MarkingItem; mayMark: boolean; onCancel: () => void; onPublished: () => Promise<void>;
}) {
  const speaking = skill === "speaking";
  const [overall, setOverall] = useState(6);
  const [summary, setSummary] = useState("");
  // Rows start at band 6 with no text; only what the marker touches is stored.
  const [scores, setScores] = useState<Record<string, number>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [improve, setImprove] = useState<Record<string, string>>({});
  const [turns, setTurns] = useState<MarkingTurn[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // An interview is marked a part at a time: the parts this student was asked.
  const parts = useMemo(() => [...new Set(turns.map(t => t.part))].sort(), [turns]);
  const criteria = speaking ? parts.map(p => ({ key: String(p), label: `Part ${p}` })) : WRITING_CRITERIA;
  const score = (key: string) => scores[key] ?? 6;

  useEffect(() => {
    if (skill !== "speaking") return;
    markingAPI.turns(item.id).then(setTurns).catch(() => setError("Could not load the recordings."));
  }, [skill, item.id]);

  async function publish(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      await markingAPI.publish(skill, item.id, speaking
        ? { summary, parts: parts.map(p => ({ part: p, score: score(String(p)), feedback: reasons[p] ?? "" })) }
        : {
          overall, summary,
          criteria: criteria.map(c => ({ key: c.key, score: score(c.key), reason: reasons[c.key] ?? "", how_to_improve: improve[c.key] ?? "" })),
          strengths: [], next_steps: [],
        });
      await onPublished();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not publish this mark.");
    } finally { setBusy(false); }
  }

  return <>
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

    {!mayMark
      ? <p className="instruction-box">Your account may read this submission but not mark it.</p>
      : <form className="marking-form" onSubmit={publish}>
      {error && <p className="instruction-box" role="alert">{error}</p>}
      {speaking
        ? <p className="marking-overall">
            Overall band
            <output aria-label="Overall band">{parts.length ? interviewBand(parts.map(p => score(String(p)))).toFixed(1) : "–"}</output>
            <small>Worked out from the part bands below.</small>
          </p>
        : <label className="marking-overall">
            Overall band
            <select value={overall} onChange={e => setOverall(Number(e.target.value))}>
              {BANDS.map(b => <option key={b} value={b}>{b.toFixed(1)}</option>)}
            </select>
            <small>Your judgement, not an average of the four below.</small>
          </label>}
      {criteria.map(c => (
        <fieldset key={c.key}>
          <legend>{c.label}</legend>
          <div className="admin-columns">
            <label>Band
              <select value={score(c.key)} onChange={e => setScores({ ...scores, [c.key]: Number(e.target.value) })}>
                {BANDS.map(b => <option key={b} value={b}>{b.toFixed(1)}</option>)}
              </select>
            </label>
            <label>{speaking ? "Feedback" : "What they did"}<input value={reasons[c.key] ?? ""} maxLength={2000}
              onChange={e => setReasons({ ...reasons, [c.key]: e.target.value })} /></label>
            {!speaking && <label>What to change<input value={improve[c.key] ?? ""} maxLength={2000}
              onChange={e => setImprove({ ...improve, [c.key]: e.target.value })} /></label>}
          </div>
        </fieldset>
      ))}
      <label>Summary
        <textarea rows={4} maxLength={4000} required value={summary} onChange={e => setSummary(e.target.value)}
          placeholder={speaking ? "Overall feedback on this interview." : "What this student should take away from this piece."} />
      </label>
      <div className="marking-actions">
        <button type="button" className="secondary-action" onClick={onCancel} disabled={busy}>Cancel</button>
        <button className="primary-action" disabled={busy || !summary.trim() || !criteria.length}>
          {busy ? "Publishing…" : "Publish to the student"}
        </button>
      </div>
    </form>}
  </>;
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
