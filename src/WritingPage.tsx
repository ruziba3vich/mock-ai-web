import { useEffect, useState } from "react";
import { criteriaLabels, writingAPI, WritingSubmission } from "./writing";
import { managedContentAPI } from "./managedContent";

export default function WritingPage({ onDirtyChange }: { onDirtyChange: (v: boolean) => void }) {
  const [history, setHistory] = useState<WritingSubmission[]>([]);
  const [selected, setSelected] = useState<WritingSubmission | null>(null);
  const [previous, setPrevious] = useState<WritingSubmission | null>(null);
  const [prompts,setPrompts]=useState<string[]>([]);
  const [prompt, setPrompt] = useState("");
  const [essay, setEssay] = useState("");
  const [consent, setConsent] = useState(false);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [issue, setIssue] = useState<number | null>(null);
  const [category, setCategory] = useState("all");
  const editable = !selected || selected.status === "draft";
  const pending = selected?.status === "queued" || selected?.status === "processing";
  const dirty = editable && (selected ? prompt !== selected.prompt || essay !== selected.essay : essay.length > 0);
  const words = essay.trim() ? essay.trim().split(/\s+/u).length : 0;
  function remember(v: WritingSubmission) { setSelected(v); setHistory(old => [v, ...old.filter(item => item.id !== v.id)].slice(0, 50)); }
  async function load() {
    setLoading(true); setError("");
    try { const [items, settings,catalog] = await Promise.all([writingAPI.list(), writingAPI.settings(),managedContentAPI.studentList("writing_prompt").catch(()=>[])]); const nextPrompts=catalog.map(v=>String(v.data.prompt||"")).filter(Boolean);setPrompts(nextPrompts);setPrompt(current=>current||nextPrompts[0]||"");setHistory(items); setReady(settings.enabled); }
    catch (e) { setError(message(e)); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  useEffect(() => { if (issue !== null) document.querySelector("#writing-essay-review mark")?.scrollIntoView({ block: "nearest" }); }, [issue]);
  useEffect(() => { onDirtyChange(dirty); return () => onDirtyChange(false); }, [dirty, onDirtyChange]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  useEffect(() => {
    setPrevious(null); let active = true;
    if (selected?.parent_id) void writingAPI.get(selected.parent_id).then(v => { if (active) setPrevious(v); }).catch(() => undefined);
    return () => { active = false; };
  }, [selected?.parent_id]);
  useEffect(() => {
    if (!selected || !pending) return;
    let active = true; let inFlight = false; const id = selected.id;
    const timer = window.setInterval(async () => {
      if (inFlight) return; inFlight = true;
      try { const v = await writingAPI.get(id); if (active) { remember(v); setError(""); } }
      catch { if (active) setError("Connection interrupted. Your saved essay is safe; checking again shortly."); }
      finally { inFlight = false; }
    }, 3000);
    return () => { active = false; window.clearInterval(timer); };
  }, [selected?.id, pending]);
  function canLeave() { return !dirty || window.confirm("Discard unsaved changes? Use Save draft to keep them."); }
  function open(v: WritingSubmission | null) {
    if (busy || !canLeave()) return;
    setSelected(v); setPrompt(v?.prompt || prompts[0] || ""); setEssay(v?.essay || ""); setError(""); setNotice(""); setConsent(false); setIssue(null); setCategory("all");
  }
  async function save() {
    const input = { prompt, essay, revision: selected?.revision };
    const v = selected ? await writingAPI.save(selected.id, input) : await writingAPI.create(input);
    remember(v); setNotice("Draft saved to your account."); return v;
  }
  async function act(action: () => Promise<unknown>) {
    setBusy(true); setError(""); setNotice("");
    try { await action(); } catch (e) { setError(message(e)); } finally { setBusy(false); }
  }
  async function evaluate() {
    if (!consent) return;
    await act(async () => { const v = editable ? await save() : selected!; remember(await writingAPI.evaluate(v.id, v.revision)); setNotice(""); });
  }
  async function revise() {
    if (!selected) return;
    await act(async () => { const v = await writingAPI.create({ prompt: selected.prompt, essay: selected.essay, parent_id: selected.status === "completed" ? selected.id : undefined }); remember(v); setPrompt(v.prompt); setEssay(v.essay); setConsent(false); setIssue(null); setNotice("A new draft is ready. Your previous essay and report are preserved."); });
  }
  async function remove() {
    if (!selected || !window.confirm("Permanently delete this essay and its report? This cannot be undone.")) return;
    const id = selected.id;
    await act(async () => { await writingAPI.remove(id); setHistory(old => old.filter(v => v.id !== id)); setSelected(null); setPrompt(prompts[0]||""); setEssay(""); setConsent(false); setNotice("Essay deleted."); });
  }
  const report = selected?.report;
  const quote = issue !== null && report ? report.issues[issue]?.quote : "";
  const shownIssues = report?.issues.filter(v => category === "all" || v.category === category) || [];
  const offTopic = report?.topic_alignment?.status === "off_topic";
  return <div className="content page-content writing-page">
    <header className="writing-heading"><div><p className="eyebrow">Writing · Task 2</p><h1>Write. Understand. Revise.</h1><p>Turn an essay into a clear plan for your next draft.</p></div><button className="secondary-action" disabled={busy} onClick={() => open(null)}>New essay</button></header>
    <p className="writing-disclaimer">AI practice feedback, not an official IELTS assessment. Scores can vary. This is a Task 2 essay estimate—not a full Writing or overall IELTS band.</p>
    {error && <div role="alert" className="global-notice error">{error}<button onClick={() => void load()}>Refresh history</button></div>}
    {notice && <p className="writing-notice" role="status">{notice}</p>}
    <div className="writing-layout"><aside className="writing-history" aria-label="Writing history"><h2>Your writing</h2><small>Latest 50 essays and drafts</small>{loading ? <p>Loading…</p> : history.length ? history.map(v => <button key={v.id} className={selected?.id === v.id ? "active" : ""} disabled={busy} onClick={() => open(v)}><strong>{v.prompt.slice(0, 65) || "Untitled draft"}{v.prompt.length > 65 ? "…" : ""}</strong><span>{v.status} {v.report ? `· ${v.report.overall.toFixed(1)} estimated` : ""}</span><small>{new Date(v.updated_at).toLocaleDateString()}</small></button>) : <p>Your saved drafts and reports will appear here.</p>}</aside>
    <section className="writing-workspace">
      {editable && <div className="writing-editor">
        <label>Choose a practice prompt<select disabled={busy} value={prompts.includes(prompt) ? prompt : "custom"} onChange={e => setPrompt(e.target.value === "custom" ? "" : e.target.value)}>{prompts.map((p, i) => <option key={p} value={p}>Prompt {i + 1}: {p.slice(0, 55)}…</option>)}<option value="custom">Use my own Task 2 prompt</option></select></label>
        <label>Task prompt<textarea disabled={busy} rows={4} maxLength={4000} value={prompt} onChange={e => setPrompt(e.target.value)} /></label>
        <label>Your essay<textarea className="essay-input" disabled={busy} rows={16} maxLength={20000} placeholder="Write your essay here. Aim for at least 250 words." value={essay} onChange={e => setEssay(e.target.value)} /></label>
        <div className="writing-word-count"><strong>{words} words</strong><span>{words < 250 ? "Task 2 target: at least 250 words" : "Task 2 word target reached"}</span></div>
        <p className="explore-caption">50–1800 words accepted for practice. Shorter essays receive feedback on limited development. Save your draft before leaving.</p>
        <button className="secondary-action" disabled={busy || words > 1800} onClick={() => void act(save)}>{busy ? "Working…" : "Save draft"}</button><span className="draft-status">{dirty ? "Unsaved changes" : selected ? "Saved" : "Not saved yet"}</span>
      </div>}
      {(editable || selected?.status === "failed") && <div className="writing-submit">
        {!ready && <p role="status">AI evaluation is currently unavailable. You can still save and edit drafts.</p>}
        {selected?.status === "failed" && <div role="alert"><h2>Evaluation didn’t finish</h2><p>{selected.error_code === "invalid_feedback" ? "The feedback did not pass our quality checks. No score has been recorded." : "The AI service was unavailable or interrupted. Your essay is saved; no score has been recorded."}</p><button className="secondary-action" disabled={busy} onClick={() => void revise()}>Edit a copy</button></div>}
        <label className="writing-consent"><input type="checkbox" checked={consent} disabled={busy} onChange={e => setConsent(e.target.checked)} /><span>I agree to send this essay and task prompt to Google Gemini for evaluation. I have removed personal or confidential information.</span></label>
        <button className="primary-action" disabled={busy || !consent || !ready || words < 50 || words > 1800 || prompt.trim().length < 20} onClick={() => void evaluate()}>{selected?.status === "failed" ? "Retry evaluation" : "Evaluate my essay"}</button>
        <small>Up to 5 evaluation requests per UTC day, including retries. Saved drafts are not sent to the AI until you evaluate.</small>
      </div>}
      {pending && <div className="writing-pending" role="status"><p className="eyebrow">{selected.status === "queued" ? "In the evaluation queue" : "Reading your essay"}</p><h2>Your report is on its way.</h2><p>We’re reviewing your argument, structure, vocabulary and grammar. You can leave this page and return through Writing history.</p></div>}
      {!editable && <details className="writing-task"><summary>Task prompt and submitted essay</summary><p>{selected?.prompt}</p><p className="essay-text">{selected?.essay}</p></details>}
      {report && selected?.status === "completed" && <div className="writing-report">
        <section className="writing-score"><div><p className="eyebrow">Overall essay estimate</p><strong>{report.overall.toFixed(1)}<small>/ 9</small></strong></div><div><h2>Your next step, made clearer.</h2><p>{report.summary}</p><ScoreCalculation report={report}/>{previous?.report && <p>Previous draft: {previous.report.overall.toFixed(1)} → {report.overall.toFixed(1)}. Treat changes as guidance, not a guaranteed score improvement.</p>}</div></section>
        {report.topic_alignment && <section className={`writing-alignment ${offTopic ? "off-topic" : ""}`}><div><p className="eyebrow">{offTopic ? "Why did I get this score?" : "Topic alignment"}</p><h2>{offTopic ? "The essay answers a different question" : report.topic_alignment.status === "partly_aligned" ? "The task is only partly addressed" : "The essay stays on topic"}</h2><p>{report.topic_alignment.explanation}</p></div><dl><div><dt>The prompt is about</dt><dd>{report.topic_alignment.prompt_topic}</dd></div><div><dt>Your essay is mainly about</dt><dd>{report.topic_alignment.essay_topic}</dd></div></dl>{offTopic && <p className="alignment-consequence">Because the topics do not match, most arguments cannot receive Task Response credit. Language scores are assessed separately.</p>}</section>}
        <div className="writing-criteria">{report.criteria.map(c => <article key={c.key}><strong>{c.score.toFixed(1)}</strong><h3>{criteriaLabels[c.key] || c.key}</h3><p>{c.reason}</p></article>)}</div>
        <section className="writing-panel"><h2>What’s working</h2>{report.strengths.length ? <ul>{report.strengths.map((v, i) => <li key={i}>{v}</li>)}</ul> : <p>This draft needs foundational work. Start with the priorities below.</p>}</section>
        <section className="writing-panel"><h2>Learn from your mistakes</h2><p>Select a comment to highlight its evidence in your original essay.</p><div className="filter-row" role="group" aria-label="Filter writing feedback">{["all", "argument", "task_response", "coherence", "vocabulary", "grammar"].map(v => <button key={v} className={category === v ? "active" : ""} onClick={() => setCategory(v)}>{v.replaceAll("_", " ")}</button>)}</div>
          <div className="writing-evidence"><div id="writing-essay-review" className="essay-text">{highlight(selected.essay, quote || "")}</div><div className="writing-issues">{shownIssues.length === 0 && <EmptyCategory category={category} report={report}/>} {report.issues.map((v, i) => (category === "all" || v.category === category) && <article key={i} className={issue === i ? "selected" : ""}><span className="eyebrow">{v.category.replaceAll("_", " ")}</span><button aria-pressed={issue === i} onClick={() => { setIssue(i); document.getElementById("writing-essay-review")?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }}>“{v.quote}”</button><p>{v.explanation}</p><h4>Try this</h4><p>{v.suggestion}</p>{v.example && <p className="writing-example">Example: {v.example}</p>}</article>)}</div></div>
        </section>
        <section className="writing-panel"><h2>{offTopic ? "Example of an on-topic introduction" : "A stronger version of one passage"}</h2><p className="eyebrow">{offTopic ? "What your draft addressed" : "Your original"}</p><blockquote>{report.rewrite.original}</blockquote><p className="eyebrow">{offTopic ? "What the introduction should have addressed" : "Illustrative revision"}</p><blockquote className="writing-example">{report.rewrite.improved}</blockquote><p>{report.rewrite.explanation}</p></section>
        <section className="writing-panel"><h2>Your revision plan</h2><ol>{report.next_steps.map((v, i) => <li key={i}>{v}</li>)}</ol><button className="primary-action" disabled={busy} onClick={() => void revise()}>Revise this essay →</button><p className="explore-caption">Your original report stays in history. Revise in your own words, then evaluate again.</p></section>
        <small className="explore-caption">Model: {report.model_version || selected.model} · Rubric: {selected.rubric_version}</small>
      </div>}
      {selected && !pending && <button className="writing-delete" disabled={busy} onClick={() => void remove()}>Delete this essay and report</button>}
    </section></div>
  </div>;
}
function message(e: unknown) { return e instanceof Error ? e.message : "Writing request failed. Please try again."; }
function highlight(essay: string, quote: string) { const at = quote ? essay.indexOf(quote) : -1; return at < 0 ? essay : <>{essay.slice(0, at)}<mark>{quote}</mark>{essay.slice(at + quote.length)}</>; }
function ScoreCalculation({ report }: { report: NonNullable<WritingSubmission["report"]> }) { const scores = report.criteria.map(c => c.score); const average = scores.reduce((sum, score) => sum + score, 0) / scores.length; return <div className="score-calculation" aria-label="Overall score calculation"><span>{scores.map(score => score.toFixed(1)).join(" + ")}</span><b>÷ 4 = {formatAverage(average)}</b><strong>→ {report.overall.toFixed(1)}</strong><small>rounded to the nearest half band</small></div>; }
function EmptyCategory({ category, report }: { category: string; report: NonNullable<WritingSubmission["report"]> }) { const keys: Record<string,string> = { task_response: "task_response", coherence: "coherence_cohesion", vocabulary: "lexical_resource", grammar: "grammar" }; const criterion = report.criteria.find(c => c.key === keys[category]); return <div className="writing-no-issues"><strong>{category === "all" ? "No high-impact mistakes were identified." : `No major ${category.replaceAll("_", " ")} problems found.`}</strong>{criterion && <><p>This area is currently estimated at Band {criterion.score.toFixed(1)}.</p><h4>To move higher</h4><p>{criterion.how_to_improve || criterion.reason}</p></>}{!criterion && <p>Use the criterion scores and revision plan to choose the next improvement.</p>}</div>; }
function formatAverage(value: number) { return value.toFixed(2).replace(/0$/, ""); }
