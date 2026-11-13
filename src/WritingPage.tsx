import { useEffect, useState } from "react";
import { criteriaLabels, writingAPI, WritingSubmission } from "./writing";
import { APIError } from "./auth";
import { managedContentAPI } from "./managedContent";
import type { ManagedContent } from "./managedContent";
import type { CSSProperties } from "react";
import Poster from "./Poster";
import PinnedFigures from "./PinnedFigures";
import { stagger } from "./motion";
import { CalendarIcon, CheckIcon, PenIcon } from "./icons";
import { BandBox, Criteria, Marked, ReportStage, TitleCard, weakest } from "./ReportParts";
import type { Criterion } from "./ReportParts";

/** balance and cost are in stars; cost is what one check or interview takes. */
/** Passed whenever the next AI check spends stars. Inside a mock there is no Stars page to open, so onBuy is left out. */
export type PracticeCredits = { balance: number; cost: number; centreName?: string; onUsed: () => void; onBuy?: () => void };
const NO_FREE_CHECK = "This mock no longer includes a free AI check. ";
const GET_MORE = "Get more on the Stars page.";
type Props={onDirtyChange:(v:boolean)=>void;mode?:"practice"|"mock";onSubmitted?:(v:WritingSubmission)=>void;initialContentID?:string;initialSubmissionID?:string;onSaved?:(v:WritingSubmission)=>void;requiredTask?:"task_1"|"task_2";fullMockId?:string;credits?:PracticeCredits};
export default function WritingPage({ onDirtyChange,mode="practice",onSubmitted,initialContentID,initialSubmissionID,onSaved,requiredTask,fullMockId,credits }: Props) {
  const [needCredits, setNeedCredits] = useState(false);
  const [history, setHistory] = useState<WritingSubmission[]>([]);
  const [selected, setSelected] = useState<WritingSubmission | null>(null);
  const [previous, setPrevious] = useState<WritingSubmission | null>(null);
  const [prompts,setPrompts]=useState<string[]>([]);
  const [catalog,setCatalog]=useState<ManagedContent[]>([]);
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
  // Parked for a person rather than a worker: this essay is not in any queue
  // and no model will read it, so it must not be described as waiting for one.
  const awaitingCentre = selected?.status === "awaiting_review";
  const dirty = editable && (selected ? prompt !== selected.prompt || essay !== selected.essay : essay.length > 0);
  const words = essay.trim() ? essay.trim().split(/\s+/u).length : 0;
  function remember(v: WritingSubmission) { setSelected(v); setHistory(old => [v, ...old.filter(item => item.id !== v.id)].slice(0, 50)); }
  async function load() {
    setLoading(true); setError("");
    try {
      const [items, settings, content, restored] = await Promise.all([
        writingAPI.list(), writingAPI.settings(), managedContentAPI.studentList("writing_prompt"),
        initialSubmissionID ? writingAPI.get(initialSubmissionID) : Promise.resolve(null)
      ]);
      const preferred = content.find(v=>v.id===initialContentID);
      if (mode==="mock" && (!preferred || preferred.data.task!==requiredTask)) throw new Error("The assigned writing task is no longer available. Your saved response is preserved.");
      const nextPrompts=content.map(v=>String(v.data.prompt||"")).filter(Boolean);
      setCatalog(content); setPrompts(nextPrompts); setHistory(items);
      setPrompt(current=>restored?.prompt || String(preferred?.data.prompt||"") || current || nextPrompts[0] || "");
      if(restored){setSelected(restored);setEssay(restored.essay)}
      setReady(settings.enabled);
    }
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
    const input = { prompt, essay, revision: selected?.revision, content_id: catalog.find(v=>String(v.data.prompt||"")===prompt)?.id };
    const v = selected ? await writingAPI.save(selected.id, input) : await writingAPI.create(input);
    remember(v); onSaved?.(v); setNotice("Draft saved to your account."); return v;
  }
  async function act(action: () => Promise<unknown>) {
    setBusy(true); setError(""); setNotice(""); setNeedCredits(false);
    try { await action(); } catch (e) { setError(message(e)); setNeedCredits(e instanceof APIError && e.status === 402); } finally { setBusy(false); }
  }
  async function evaluate() {
    if (!consent) return;
    await act(async () => { const v = editable ? await save() : selected!; const queued=await writingAPI.evaluate(v.id, v.revision, fullMockId);remember(queued);if(mode!=="mock")credits?.onUsed();onSubmitted?.(queued);setNotice(""); });
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
  const shownIssues = report?.issues.filter(v => category === "all" || v.category === category) || [];
  const offTopic = report?.topic_alignment?.status === "off_topic";
  const promptContent=catalog.find(v=>String(v.data.prompt||"")===prompt);
  const task=requiredTask || (promptContent?.data.task==="task_1"?"task_1":"task_2");
  const taskName=task==="task_1"?"Task 1":"Task 2";
  const minimumWords=task==="task_1"?150:250;
  const sourcePages=(promptContent?.data.source_image_urls as string[]|undefined)||[];
  const showReport = !!report && selected?.status === "completed";
  const disclaimer = <p className="rp-disclaimer">AI practice feedback, not an official IELTS assessment. Scores can vary. This is a single-task estimate—not a full Writing or overall IELTS band.</p>;
  const historyList = mode!=="mock" && <aside className={`writing-history rp-history${showReport ? " is-strip" : ""}`} aria-label="Writing history"><div className="rp-history-head"><h2>Your writing</h2><small>Latest 50 essays and drafts</small></div><div className="rp-history-list">{loading ? <p>Loading…</p> : history.length ? history.map(v => <button key={v.id} className={selected?.id === v.id ? "active" : ""} disabled={busy} onClick={() => open(v)}><strong>{v.prompt.slice(0, 65) || "Untitled draft"}{v.prompt.length > 65 ? "…" : ""}</strong><span>{v.status} {v.report ? `· ${v.report.overall.toFixed(1)} estimated` : ""}</span><small>{new Date(v.updated_at).toLocaleDateString()}</small></button>) : <p>Your saved drafts and reports will appear here.</p>}</div></aside>;
  const notices = <>{error && <div role="alert" className="global-notice error">{error}{needCredits && credits?.onBuy && !credits.centreName ? <button onClick={credits.onBuy}>Get stars</button> : <button onClick={() => void load()}>Refresh history</button>}</div>}
    {notice && <p className="rp-notice" role="status">{notice}</p>}</>;
  const remover = selected && !pending && <button className="rp-delete" disabled={busy} onClick={() => void remove()}>Delete this essay and report</button>;

  if (showReport && report && selected) {
    const criteria: Criterion[] = report.criteria.map(c => ({ key: c.key, name: task==="task_1" && c.key==="task_response" ? "Task Achievement" : criteriaLabels[c.key] || c.key, score: c.score, body: <p>{c.reason}</p> }));
    const low = weakest(criteria);
    return <ReportStage key={selected.id} className="content page-content rp rp-report">
      <TitleCard skill="writing" kicker="Writing" title={`${taskName} report`} back={mode!=="mock" ? { label: "Back to Writing", onClick: () => open(null), disabled: busy } : undefined} />
      <p className="rp-meta rise" style={stagger(0, 1000)}><span><CalendarIcon />{new Date(selected.updated_at).toLocaleDateString()}</span><span><PenIcon />Scored by AI</span><span>Rubric {selected.rubric_version}</span></p>
      {notices}
      <div className="rp-grid">
        <div className="rp-side"><div className="rp-zone"><div className="rp-stick">
          <section className="rp-band" aria-labelledby="rp-next-step">
            <BandBox label="Overall band" value={report.overall} suffix={<small>/ 9</small>} />
            <div className="rise" style={stagger(0, 1700)}><h2 id="rp-next-step">Your next step, made clearer.</h2>{low.length > 0 && <p className="rp-lead">{low.map(c => c.name).join(" and ")} {low.length > 1 ? "are" : "is"} costing you most.</p>}<p>{report.summary}</p></div>
            <ScoreCalculation report={report}/>
            {previous?.report && <p className="rp-small">Previous draft: {previous.report.overall.toFixed(1)} → {report.overall.toFixed(1)}. Treat changes as guidance, not a guaranteed score improvement.</p>}
          </section>
          <section className="rp-crit-sec"><h2 className="rise" style={stagger(0, 1950)}>Criteria</h2><Criteria items={criteria} /></section>
          </div></div>
          <section className="rp-next rise" style={stagger(0, 3240)}><h2>Your revision plan</h2><ol>{report.next_steps.map((v, i) => <li key={i}>{v}</li>)}</ol><button className="btn btn-primary" disabled={busy} onClick={() => void revise()}>Revise this essay →</button><p className="rp-small">Your original report stays in history. Revise in your own words, then evaluate again.</p></section>
        </div>
        <div className="rp-main">
          <p className="rp-prompt blurin" style={stagger(0, 1850, 0, 1000)}>{selected.prompt}</p>
          {report.topic_alignment && <section className={`rp-panel rp-align rise${offTopic ? " off-topic" : ""}`} style={stagger(0, 2600)}><div><h2>{offTopic ? "The essay answers a different question" : report.topic_alignment.status === "partly_aligned" ? "The task is only partly addressed" : "The essay stays on topic"}</h2><p>{report.topic_alignment.explanation}</p></div><dl><div><dt>The prompt is about</dt><dd>{report.topic_alignment.prompt_topic}</dd></div><div><dt>Your essay is mainly about</dt><dd>{report.topic_alignment.essay_topic}</dd></div></dl>{offTopic && <p className="alignment-consequence">Because the topics do not match, most arguments cannot receive Task Response credit. Language scores are assessed separately.</p>}</section>}
          <section className="rp-lost">
            <h2 className="rise" style={stagger(0, 2700)}>Learn from your mistakes</h2>
            <p className="rise" style={stagger(0, 2740)}>Select a comment to highlight its evidence in your original essay.</p>
            <div className="rp-filter rise" style={stagger(0, 2780)} role="group" aria-label="Filter writing feedback">{["all", "argument", "task_response", "coherence", "vocabulary", "grammar"].map(v => <button key={v} aria-pressed={category === v} onClick={() => setCategory(v)}>{v.replaceAll("_", " ")}</button>)}</div>
            <div id="writing-essay-review" className="rp-essay read rise" style={stagger(0, 2750)}><Marked text={selected.essay} marks={report.issues.map((v, i) => ({ quote: v.quote, n: i + 1 })).filter((_, i) => category === "all" || report.issues[i].category === category)} active={issue === null ? null : issue + 1} /></div>
            <ol className="rp-issues">{shownIssues.length === 0 && <li><EmptyCategory category={category} report={report}/></li>}{report.issues.map((v, i) => (category === "all" || v.category === category) && <li key={i} className={`rp-issue rise${issue === i ? " selected" : ""}`} style={stagger(i, 2900, 90)}><span className="rp-no" aria-hidden="true">{i + 1}</span><div><span className="eyebrow">{v.category.replaceAll("_", " ")}</span><button className="rp-q" aria-pressed={issue === i} onClick={() => { setIssue(i); document.getElementById("writing-essay-review")?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }}>“{v.quote}”</button><p>{v.explanation}</p><h4>Try this</h4><p>{v.suggestion}</p>{v.example && <p className="rp-example">Example: {v.example}</p>}</div></li>)}</ol>
          </section>
          <section className="rp-panel rise" style={stagger(0, 3080)}><h2>What’s working</h2>{report.strengths.length ? <ul className="rp-checks">{report.strengths.map((v, i) => <li key={i}><CheckIcon />{v}</li>)}</ul> : <p>This draft needs foundational work. Start with the priorities below.</p>}</section>
          <section className="rp-panel rp-rewrite rise" style={stagger(0, 3160)}><h2>{offTopic ? "Example of an on-topic introduction" : "A stronger version of one passage"}</h2><p className="eyebrow">{offTopic ? "What your draft addressed" : "Your original"}</p><blockquote className="read">{report.rewrite.original}</blockquote><p className="eyebrow">{offTopic ? "What the introduction should have addressed" : "Illustrative revision"}</p><blockquote className="read is-better">{report.rewrite.improved}</blockquote><p>{report.rewrite.explanation}</p></section>
          {disclaimer}
          {remover}
        </div>
      </div>
      {historyList}
    </ReportStage>;
  }

  return <div className="content page-content rp rp-write">
    <header className="rp-head"><Poster skill="writing" size="sm" tag={taskName} className="rp-head-art" /><div><p className="writing-task-step eyebrow">{mode==="mock"?`Full mock · Writing · ${taskName}`:`Writing · ${task==="task_1"?"Academic Task 1":"Task 2"}`}</p><h1>{mode==="mock"?"Complete your Writing section.":"Write. Understand. Revise."}</h1><p>{mode==="mock"?(task==="task_1"?"Describe the assigned visual. Aim for at least 150 words and spend about 20 minutes. Task 2 follows without a break.":"Respond to the assigned essay question. Aim for at least 250 words and spend about 40 minutes. Task 2 carries twice the weight of Task 1."):"Practise reports and essays with detailed AI feedback."}</p></div>{mode!=="mock"&&<button className="btn btn-ghost" disabled={busy} onClick={() => open(null)}>New response</button>}</header>
    {disclaimer}
    {notices}
    <div className={`rp-work${mode==="mock"?" is-mock":""}`}>{historyList}
    <section className="rp-workspace">
      {editable && <div className="rp-panel rp-editor">
        {mode!=="mock"&&<label>Choose a practice prompt<select disabled={busy} value={prompts.includes(prompt) ? prompt : "custom"} onChange={e => setPrompt(e.target.value === "custom" ? "" : e.target.value)}>{catalog.map((v, i) => {const p=String(v.data.prompt||"");return p?<option key={v.id||p} value={p}>{v.data.task==="task_1"?"Task 1":"Task 2"} · {v.title||`Prompt ${i+1}`}</option>:null})}<option value="custom">Use my own writing prompt</option></select></label>}
        <label>Task prompt<textarea className="rp-prompt-input" readOnly={mode==="mock"} disabled={busy} rows={4} maxLength={4000} value={prompt} onChange={e => setPrompt(e.target.value)} /></label>
        {sourcePages.length>0&&<PinnedFigures urls={sourcePages} title={promptContent?.title||"Writing task"}/>}
        <label>Your essay<textarea className="rp-essay-input read" disabled={busy} rows={16} maxLength={20000} placeholder={`Write your response here. Aim for at least ${minimumWords} words.`} value={essay} onChange={e => setEssay(e.target.value)} /></label>
        <div className="rp-count"><strong className="num">{words} words</strong><span>{words < minimumWords ? `${taskName} target: at least ${minimumWords} words` : "Word target reached"}</span><span className="rp-count-bar" aria-hidden="true"><i style={{ "--v": Math.min(1, words / minimumWords) } as CSSProperties} /></span></div>
        <p className="rp-small">50–1800 words accepted for practice. Shorter essays receive feedback on limited development. Save your draft before leaving.</p>
        <div className="rp-row"><button className="btn btn-ghost" disabled={busy || words > 1800} onClick={() => void act(save)}>{busy ? "Working…" : "Save draft"}</button><span className="rp-small">{dirty ? "Unsaved changes" : selected ? "Saved" : "Not saved yet"}</span></div>
      </div>}
      {(editable || selected?.status === "failed") && <div className="rp-panel rp-submit">
        {!ready && <p role="status">AI evaluation is currently unavailable. You can still save and edit drafts.</p>}
        {selected?.status === "failed" && <div role="alert"><h2>Evaluation didn’t finish</h2><p>{selected.error_code === "invalid_feedback" ? "The feedback did not pass our quality checks. No score has been recorded." : "The AI service was unavailable or interrupted. Your essay is saved; no score has been recorded."}</p><button className="btn btn-ghost" disabled={busy} onClick={() => void revise()}>Edit a copy</button></div>}
        <label className="rp-consent"><input type="checkbox" checked={consent} disabled={busy} onChange={e => setConsent(e.target.checked)} /><span>I agree to securely process this essay and task prompt for evaluation. I have removed personal or confidential information.</span></label>
        {credits && selected?.status !== "failed" && <p className="credit-cost">{mode === "mock" && NO_FREE_CHECK}{credits.balance >= credits.cost
          ? <>Costs {credits.cost} {credits.centreName ? <>of {credits.centreName}'s </> : ""}stars · <strong>{credits.centreName ? `${credits.balance} left` : `you have ${credits.balance}`}</strong></>
          : credits.centreName ? <>{credits.centreName} does not have the {credits.cost} stars an AI Writing check costs. Ask your centre to add more.</> : <>An AI Writing check costs {credits.cost} stars and you have {credits.balance}. {credits.onBuy ? <button type="button" className="link-button" onClick={credits.onBuy}>Get stars</button> : GET_MORE}</>}</p>}
        <button className="btn btn-primary" disabled={busy || loading || !consent || !ready || words < 50 || words > 1800 || prompt.trim().length < 20 || (!!credits && credits.balance < credits.cost && selected?.status !== "failed")} onClick={() => void evaluate()}>{selected?.status === "failed" ? "Retry evaluation" : mode==="mock"?(task==="task_1"?"Submit Task 1 and continue":"Submit Task 2 and finish Writing"):"Evaluate my essay"}</button>
        <small>Up to 5 evaluation requests per UTC day, including retries. Saved drafts are not sent to the AI until you evaluate.</small>
      </div>}
      {awaitingCentre && <div className="rp-panel rp-state" role="status"><p className="eyebrow">Sent to your centre</p><h2>Your teachers will mark this essay.</h2><p>There is no automatic score. Your centre reads your writing and returns feedback here.</p></div>}
      {pending && <div className="rp-panel rp-state" role="status"><p className="eyebrow">{selected.status === "queued" ? "In the evaluation queue" : "Reading your essay"}</p><h2>Your report is on its way.</h2><span className="rp-wait" aria-hidden="true" /><p>We’re reviewing your argument, structure, vocabulary and grammar. You can leave this page and return through Writing history.</p></div>}
      {!editable && <details className="rp-panel rp-task"><summary>Task prompt and submitted essay</summary><p className="rp-prompt">{selected?.prompt}</p><p className="rp-essay read">{selected?.essay}</p></details>}
      {remover}
    </section></div>
  </div>;
}
function message(e: unknown) { return e instanceof Error ? e.message : "Writing request failed. Please try again."; }
function ScoreCalculation({ report }: { report: NonNullable<WritingSubmission["report"]> }) { const scores = report.criteria.map(c => c.score); const average = scores.reduce((sum, score) => sum + score, 0) / scores.length; return <div className="rp-calc rise" style={stagger(0, 1800)} aria-label="Overall score calculation"><span>{scores.map(score => score.toFixed(1)).join(" + ")}</span><b>÷ 4 = {formatAverage(average)}</b><strong>→ {report.overall.toFixed(1)}</strong><small>rounded to the nearest half band</small></div>; }
function EmptyCategory({ category, report }: { category: string; report: NonNullable<WritingSubmission["report"]> }) { const keys: Record<string,string> = { task_response: "task_response", coherence: "coherence_cohesion", vocabulary: "lexical_resource", grammar: "grammar" }; const criterion = report.criteria.find(c => c.key === keys[category]); return <div className="rp-empty"><strong>{category === "all" ? "No high-impact mistakes were identified." : `No major ${category.replaceAll("_", " ")} problems found.`}</strong>{criterion && <><p>This area is currently estimated at Band {criterion.score.toFixed(1)}.</p><h4>To move higher</h4><p>{criterion.how_to_improve || criterion.reason}</p></>}{!criterion && <p>Use the criterion scores and revision plan to choose the next improvement.</p>}</div>; }
function formatAverage(value: number) { return value.toFixed(2).replace(/0$/, ""); }
