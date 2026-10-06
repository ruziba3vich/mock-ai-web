import { useEffect, useMemo, useRef, useState } from "react";
import { Attempt, Exam, examAPI, Question } from "./exams";
import { AnnotatedPassage, useWorkspace } from "./WorkspaceTools";

type Props = { exam: Exam; initialAttempt: Attempt; onExit: () => void };

export default function ExamRunner({ exam, initialAttempt, onExit }: Props) {
  const [attempt, setAttempt] = useState(initialAttempt);
  const [answers, setAnswers] = useState<Record<string, string[]>>(() => Object.fromEntries(initialAttempt.answers.map((a) => [a.question_id, a.values])));
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [now, setNow] = useState(Date.now());
  const expirySubmitted = useRef(false);
  const workspace = useWorkspace(initialAttempt.id);
  const [mapFilter,setMapFilter] = useState("all");
  const questions = useMemo(() => exam.sections.flatMap((section) => section.questions), [exam]);

  useEffect(() => {
    if (attempt.status !== "in_progress") return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [attempt.status]);

  const remaining = Math.max(0, Math.floor((new Date(attempt.deadline_at).getTime() - now) / 1000));
  const clock = `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`;

  useEffect(() => {
    if (remaining === 0 && attempt.status === "in_progress" && !expirySubmitted.current) {
      expirySubmitted.current = true;
      void submit();
    }
  });

  async function save(questionID: string, values = answers[questionID] || []) {
    if (!values.some((value) => value.trim().length > 0) || attempt.status !== "in_progress") return;
    setSaving(questionID); setError("");
    try { await examAPI.save(attempt.id, questionID, values); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Answer could not be saved."); }
    finally { setSaving(null); }
  }

  async function submit() {
    setSubmitting(true); setError("");
    try { setAttempt(await examAPI.submit(attempt.id)); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Attempt could not be submitted."); }
    finally { setSubmitting(false); }
  }

  function requestExit() {
    if (window.confirm("Leave this exam? Your saved answers will remain, but the timer will keep running.")) onExit();
  }

  const answeredCount = Object.values(answers).filter((values) => values.some((value) => value.trim().length > 0)).length;
  const unansweredCount = questions.length - answeredCount;

  if (attempt.status === "scored") {
    const accuracy = attempt.question_count ? Math.round(((attempt.raw_score || 0) / attempt.question_count) * 100) : 0;
    return <main className="result-page"><div className="result-card result-card-wide"><p className="eyebrow">Exam complete</p><h1>Band {attempt.band_score?.toFixed(1)}</h1><p className="result-lead">You answered <strong>{attempt.raw_score}</strong> of <strong>{attempt.question_count}</strong> questions correctly.</p><div className="result-metrics"><div><strong>{accuracy}%</strong><span>Accuracy</span></div><div><strong>{exam.skill}</strong><span>Skill</span></div><div><strong>{Math.round(exam.duration_seconds / 60)} min</strong><span>Time allowed</span></div></div><div className="result-guidance"><strong>What to do next</strong><p>{accuracy >= 80 ? "Strong result. Try another mock in this skill to confirm that the score is consistent." : accuracy >= 60 ? "Good baseline. Review the missed answers, then repeat this skill with a fresh mock." : "Use this as your baseline. Focus on accuracy first, then take another timed mock."}</p></div>{attempt.answers.some((answer) => typeof answer.is_correct === "boolean") && <div className="answer-review"><span>Question review</span><div>{attempt.answers.map((answer, index) => <i key={answer.question_id} className={answer.is_correct ? "correct" : "incorrect"} title={`Question ${index + 1}: ${answer.is_correct ? "correct" : "incorrect"}`}>{index + 1}</i>)}</div></div>}<button className="primary-button" onClick={onExit}>Return to dashboard</button></div></main>;
  }

  return <main className="runner">
    <header className="runner-header"><button onClick={requestExit}>← Exit</button><div><strong>{exam.title}</strong><span>{exam.skill} · answers save automatically</span></div><time className={remaining < 300 ? "urgent" : ""} aria-label={`${clock} remaining`}>{clock}</time></header>
    <div className="runner-body">
      <aside><p className="eyebrow">Questions</p><select aria-label="Question overview filter" value={mapFilter} onChange={e=>setMapFilter(e.target.value)}><option value="all">All questions</option><option value="unanswered">Unanswered ({unansweredCount})</option><option value="flagged">Flagged ({workspace.data.flags.length})</option></select><div className="question-map">{questions.map((q, i) => {const answered=answers[q.id]?.some(v=>v.trim()),flagged=workspace.data.flags.includes(q.id);return (mapFilter==="unanswered"&&answered)||(mapFilter==="flagged"&&!flagged)?null:<a key={q.id} aria-label={`Question ${i+1}, ${answered?"answered":"unanswered"}${flagged?", flagged":""}`} className={`${answered?"answered":""} ${flagged?"flagged":""}`} href={`#question-${q.id}`}>{i+1}{flagged?" ⚑":""}</a>})}</div><small>{answeredCount} of {questions.length} answered · {workspace.data.flags.length} flagged</small><div className="runner-legend"><span><i className="answered"/>Answered</span><span><i/>Not answered</span></div><p className="workspace-status" role="status">{workspace.status}</p></aside>
      <div className="exam-content">
        {exam.sections.map((section) => <section className="runner-section" key={section.id}>
          <div className="material"><p className="eyebrow">Section {section.position}</p><h2>{section.title}</h2>{section.instructions && <p>{section.instructions}</p>}{section.audio_url && <audio controls src={section.audio_url} preload="metadata" />}{exam.skill === "listening" && !section.audio_url && section.passage && <SpeechPlayer text={section.passage} />}{exam.skill !== "listening" && section.passage && <AnnotatedPassage text={section.passage} disabled={!workspace.ready} highlights={workspace.data.highlights[section.id]||[]} onHighlight={values=>workspace.update(w=>({...w,highlights:{...w.highlights,[section.id]:values}}))}/>}</div>
          <div className="questions">{section.questions.map((question) => <div key={question.id}><div className="question-tools"><button disabled={!workspace.ready} aria-pressed={workspace.data.flags.includes(question.id)} onClick={()=>workspace.update(w=>({...w,flags:w.flags.includes(question.id)?w.flags.filter(id=>id!==question.id):[...w.flags,question.id]}))}>{workspace.data.flags.includes(question.id)?"⚑ Flagged — remove":"⚐ Flag for review"}</button><details><summary>Personal note</summary><textarea aria-label={`Note for question ${question.position}`} disabled={!workspace.ready} maxLength={2000} key={`${question.id}-${workspace.ready}`} defaultValue={workspace.data.notes[question.id]||""} onBlur={e=>{const note=e.target.value;workspace.update(w=>({...w,notes:{...w.notes,[question.id]:note}}))}} placeholder="What should you check?"/><small>Saved when you leave the note field.</small></details></div><QuestionInput question={question} value={answers[question.id] || []} saving={saving === question.id} onChange={(values, immediate) => { setAnswers((current) => ({ ...current, [question.id]: values })); if (immediate) void save(question.id, values); }} onBlur={() => void save(question.id)} /></div>)}</div>
        </section>)}
        {error && <div className="form-error" role="alert">{error}</div>}
        <div className="submit-area"><div><strong>{answeredCount} of {questions.length} answered</strong><span>{unansweredCount ? `${unansweredCount} unanswered ${unansweredCount === 1 ? "question" : "questions"}` : "Every question has an answer"}</span></div><button className="submit-exam" disabled={submitting} onClick={() => setConfirmSubmit(true)}>{submitting ? "Scoring…" : "Review and submit"}</button></div>
      </div>
    </div>
    {confirmSubmit && <div className="modal-backdrop"><section className="submit-dialog" role="dialog" aria-modal="true" aria-labelledby="submit-title"><p className="eyebrow">Final check</p><h2 id="submit-title">Submit this exam?</h2><p>{unansweredCount ? `You still have ${unansweredCount} unanswered ${unansweredCount === 1 ? "question" : "questions"}. You cannot change answers after submission.` : "Every question has an answer. You cannot change answers after submission."}</p><div><button className="secondary-action" onClick={() => setConfirmSubmit(false)}>Keep reviewing</button><button className="primary-action" disabled={submitting} onClick={() => { setConfirmSubmit(false); void submit(); }}>Submit for scoring</button></div></section></div>}
  </main>;
}

function SpeechPlayer({ text }: { text: string }) {
  const [playing, setPlaying] = useState(false);
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;

  useEffect(() => () => { if (supported) window.speechSynthesis.cancel(); }, [supported]);

  function toggle() {
    if (!supported) return;
    if (playing) {
      window.speechSynthesis.cancel();
      setPlaying(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-GB";
    utterance.rate = 0.92;
    utterance.onend = () => setPlaying(false);
    utterance.onerror = () => setPlaying(false);
    window.speechSynthesis.speak(utterance);
    setPlaying(true);
  }

  return <div className="speech-player"><button onClick={toggle} disabled={!supported}>{playing ? "Stop audio" : "Play section audio"}</button><span>{supported ? "Use headphones. The transcript stays hidden during the exam." : "Audio playback is not supported in this browser."}</span></div>;
}

function QuestionInput({ question, value, saving, onChange, onBlur }: { question: Question; value: string[]; saving: boolean; onChange: (value: string[], immediate: boolean) => void; onBlur: () => void }) {
  const multiple = question.type === "multiple_select";
  return <article className="question" id={`question-${question.id}`}><div className="question-number">{question.position}</div><div><h3>{question.prompt}</h3>
    {question.options.length > 0 ? <div className="options">{question.options.map((option) => { const selected = value.includes(option.value); return <label className={selected ? "selected" : ""} key={option.id}><input type={multiple ? "checkbox" : "radio"} name={question.id} checked={selected} onChange={() => { const next = multiple ? (selected ? value.filter((v) => v !== option.value) : [...value, option.value]) : [option.value]; onChange(next, next.length > 0); }} /><span>{option.label}</span>{option.value}</label>; })}</div> : <input className="answer-input" value={value[0] || ""} onChange={(event) => onChange([event.target.value], false)} onBlur={onBlur} placeholder="Type your answer" />}
    <small className="save-state">{saving ? "Saving…" : value.length && value[0] ? "Saved automatically" : ""}</small>
  </div></article>;
}
