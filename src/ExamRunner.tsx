import { useEffect, useMemo, useRef, useState } from "react";
import { GapLine, isGap, NoteLead } from "./NotesSheet";
import type { CSSProperties } from "react";
import { Attempt, Exam, examAPI, Question } from "./exams";
import { AnnotatedPassage, useWorkspace } from "./WorkspaceTools";
import { ArrowIcon, ClockIcon, CloseIcon, FlagIcon } from "./icons";
import Poster, { posterSkill } from "./Poster";
import PinnedFigures from "./PinnedFigures";
import { prefersReducedMotion, Roll, stagger, useEntrance } from "./motion";

type Props = { exam: Exam; initialAttempt: Attempt; onExit: () => void; onScored?: (attempt: Attempt) => void; completionLabel?: string; /** Exam day: no leaving, and each recording plays once without controls. */ strict?: boolean; /** A mock exam: the recording plays once without controls, but the student may still leave. */ playOnce?: boolean };

export default function ExamRunner({ exam, initialAttempt, onExit, onScored, completionLabel="Return to dashboard", strict=false, playOnce=strict }: Props) {
  const [attempt, setAttempt] = useState(initialAttempt);
  const [answers, setAnswers] = useState<Record<string, string[]>>(() => Object.fromEntries(initialAttempt.answers.map((a) => [a.question_id, a.values])));
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [now, setNow] = useState(Date.now());
  const expirySubmitted = useRef(false);
  const scoreNotified = useRef(false);
  const workspace = useWorkspace(initialAttempt.id);
  const [mapFilter,setMapFilter] = useState("all");
  const questions = useMemo(() => exam.sections.flatMap((section) => section.questions), [exam]);
  const recordings = useMemo(() => exam.sections.filter((section) => section.audio_url).map((section) => section.id), [exam]);
  // Presentational only: which question the playhead sits on.
  // Kept for this tab, so a reload reopens the test at the same question.
  const placeKey = `mockai.runner-at.${initialAttempt.id}`;
  const [current, setCurrent] = useState(() => { try { return Number(sessionStorage.getItem(placeKey)) || 0 } catch { return 0 } });
  useEffect(() => { try { sessionStorage.setItem(placeKey, String(current)) } catch { /* private window: a reload starts at question 1 */ } }, [current, placeKey]);
  useEffect(() => { if (current) document.getElementById(`question-${questions[current]?.id}`)?.scrollIntoView?.({ block: "start", behavior: "instant" }); }, []);
  const stage = useRef<HTMLElement>(null);
  const strip = useRef<HTMLDivElement>(null);
  const scored = attempt.status === "scored";
  useEntrance(stage);
  // Sections whose images are portrait page scans: those stay stacked in the passage instead of pinned.
  const [scans, setScans] = useState<string[]>([]);
  // On a phone a pinned figure sticks right under the top bar, whose height changes when the map wraps.
  useEffect(() => {
    const top = stage.current?.querySelector<HTMLElement>(".runner-top");
    if (!top || typeof ResizeObserver === "undefined") return;
    const watch = new ResizeObserver(() => stage.current?.style.setProperty("--runner-top-h", `${top.offsetHeight}px`));
    watch.observe(top);
    return () => watch.disconnect();
  }, [scored]);

  useEffect(() => {
    if (attempt.status !== "in_progress") return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [attempt.status]);

  useEffect(() => {
    if(attempt.status==="scored"&&!scoreNotified.current){scoreNotified.current=true;onScored?.(attempt)}
  },[attempt,onScored]);

  // The playhead follows the question being read.
  useEffect(() => {
    const root = stage.current;
    if (scored || !root || typeof IntersectionObserver === "undefined") return;
    // The first report is the page as it loaded, not the student moving: it must not move a restored place.
    let loaded = false;
    const io = new IntersectionObserver((entries) => { if (!loaded) { loaded = true; return; } for (const e of entries) if (e.isIntersecting) setCurrent(Number((e.target as HTMLElement).dataset.index)); }, { rootMargin: "-30% 0px -60% 0px" });
    root.querySelectorAll("article.question").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [questions, scored]);

  useEffect(() => {
    const s = strip.current, cell = s?.querySelector<HTMLElement>(`[data-index="${current}"]`);
    if (s && cell) s.scrollLeft = cell.offsetLeft - (s.clientWidth - cell.offsetWidth) / 2;
  }, [current, mapFilter]);

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

  function toggleFlag(id: string) {
    workspace.update(w=>({...w,flags:w.flags.includes(id)?w.flags.filter(f=>f!==id):[...w.flags,id]}));
  }

  function go(index: number) {
    const question = questions[index];
    if (!question) return;
    setCurrent(index);
    const el = document.getElementById(`question-${question.id}`);
    el?.scrollIntoView?.({ block: "start", behavior: prefersReducedMotion() ? "auto" : "smooth" });
    el?.focus({ preventScroll: true });
  }

  const answeredCount = Object.values(answers).filter((values) => values.some((value) => value.trim().length > 0)).length;
  const unansweredCount = questions.length - answeredCount;
  const currentQuestion = questions[current];
  const currentFlagged = !!currentQuestion && workspace.data.flags.includes(currentQuestion.id);

  if (scored) return <ResultView exam={exam} attempt={attempt} completionLabel={completionLabel} onExit={onExit} />;

  return <main className={`runner ${exam.skill}`} ref={stage}>
    <div className="runner-top">
      <header className="runner-header">
        {!strict && <button className="runner-exit rise" style={stagger(0, 0, 0, 600)} onClick={requestExit}><CloseIcon /><span>Exit</span></button>}
        <div className="runner-where rise" style={stagger(0, 60, 0, 600)}><strong>{exam.title}</strong><span>{exam.skill} · answers save automatically</span></div>
        <time className={`runner-clock rise ${remaining < 300 ? "urgent" : ""}`} style={stagger(0, 120, 0, 600)} aria-label={`${clock} remaining`}><ClockIcon /><span className="num">{clock}</span></time>
        <button className="runner-flag rise" style={stagger(0, 180, 0, 600)} disabled={!workspace.ready || !currentQuestion} aria-pressed={currentFlagged} aria-label={`Flag question ${current + 1}`} onClick={() => currentQuestion && toggleFlag(currentQuestion.id)}><FlagIcon /></button>
      </header>
      <nav className="runner-map" aria-label="Question map">
        <button className="map-step" aria-label="Previous question" disabled={current <= 0} onClick={() => go(current - 1)}><ArrowIcon /></button>
        <div className="map-strip" ref={strip}>
          <div className="question-map">{questions.map((q, i) => {const answered=answers[q.id]?.some(v=>v.trim()),flagged=workspace.data.flags.includes(q.id);return <a key={q.id} hidden={(mapFilter==="unanswered"&&!!answered)||(mapFilter==="flagged"&&!flagged)} data-index={i} aria-current={i===current?"step":undefined} aria-label={`Question ${i+1}, ${answered?"answered":"unanswered"}${flagged?", flagged":""}`} className={`land ${answered?"answered":""} ${flagged?"flagged":""}`} style={stagger(Math.min(i, 24), 200, 22, 500)} href={`#question-${q.id}`} onClick={()=>setCurrent(i)}>{i+1}</a>})}</div>
          <div className="map-track grow" hidden={mapFilter !== "all"} aria-hidden="true" style={{ ...stagger(0, 260, 0, 900), "--n": questions.length, "--at": current } as CSSProperties}><i className="map-fill" /><i className="map-head" /></div>
        </div>
        <button className="map-step" aria-label="Next question" disabled={current >= questions.length - 1} onClick={() => go(current + 1)}><ArrowIcon /></button>
        <div className="map-meta">
          <select aria-label="Question overview filter" value={mapFilter} onChange={e=>setMapFilter(e.target.value)}><option value="all">All questions</option><option value="unanswered">Unanswered ({unansweredCount})</option><option value="flagged">Flagged ({workspace.data.flags.length})</option></select>
          <small className="num">{answeredCount} of {questions.length} answered · {workspace.data.flags.length} flagged</small>
          <div className="runner-legend"><span><i className="answered"/>Answered</span><span><i/>Not answered</span></div>
          <p className="workspace-status" role="status">{workspace.status}</p>
        </div>
      </nav>
    </div>
    <div className="exam-content">
      {exam.sections.map((section, s) => <section className="runner-section" key={section.id}>
        <div className="material-col">{!!section.source_image_urls?.length && !scans.includes(section.id) && <PinnedFigures urls={section.source_image_urls} title={section.title} onPortrait={() => setScans(v => [...v, section.id])} />}
        <div className="material blurin" style={stagger(s, 320, 0, 900)}>
          {exam.skill === "listening" && <Poster skill="listening" title="Listen" tag={`Part ${section.position}`} size="md" className="material-poster" />}
          <h2>{section.title}</h2>{/* The player comes before the instructions: after a long list of them it sat below the fold and looked missing. */}{section.audio_url && (playOnce ? <ExamRecording src={section.audio_url} index={recordings.indexOf(section.id)} attemptID={attempt.id} /> : <audio controls src={section.audio_url} preload="metadata" />)}{section.instructions && <p className="material-instructions">{section.instructions}</p>}{exam.skill === "listening" && !recordings.length && section.passage && <SpeechPlayer text={section.passage} />}{!!section.source_image_urls?.length && scans.includes(section.id) && <div className="source-pages">{section.source_image_urls.map((url, page) => <img loading="lazy" key={url} src={url} alt={`${section.title}, source page ${page + 1}`} />)}</div>}{exam.skill !== "listening" && section.passage && <AnnotatedPassage text={section.passage} disabled={!workspace.ready} highlights={workspace.data.highlights[section.id]||[]} onHighlight={values=>workspace.update(w=>({...w,highlights:{...w.highlights,[section.id]:values}}))}/>}
        </div></div>
        <div className="questions">{section.questions.map((question, q) => {const index=questions.indexOf(question),flagged=workspace.data.flags.includes(question.id);return <div className="question-block rise" style={stagger(s ? 0 : Math.min(q, 4), 520, 80, 700)} key={question.id}>
          {isGap(question) && <NoteLead question={question} />}
          <QuestionInput question={question} index={index} current={index === current} value={answers[question.id] || []} saving={saving === question.id} onFocus={() => setCurrent(index)} onChange={(values, immediate) => { setAnswers((cur) => ({ ...cur, [question.id]: values })); if (immediate) void save(question.id, values); }} onBlur={() => void save(question.id)} />
          <div className="question-tools"><button disabled={!workspace.ready} aria-pressed={flagged} onClick={()=>toggleFlag(question.id)}>{flagged?" Flagged — remove":"⚐ Flag for review"}</button><details><summary>Personal note</summary><textarea aria-label={`Note for question ${index+1}`} disabled={!workspace.ready} maxLength={2000} key={`${question.id}-${workspace.ready}`} defaultValue={workspace.data.notes[question.id]||""} onBlur={e=>{const note=e.target.value;workspace.update(w=>({...w,notes:{...w.notes,[question.id]:note}}))}} placeholder="What should you check?"/><small>Saved when you leave the note field.</small></details></div>
        </div>})}</div>
      </section>)}
      {error && <div className="form-error" role="alert">{error}</div>}
      <div className="submit-area"><div><strong>{answeredCount} of {questions.length} answered</strong><span>{unansweredCount ? `${unansweredCount} unanswered ${unansweredCount === 1 ? "question" : "questions"}` : "Every question has an answer"}</span></div><button className="submit-exam" disabled={submitting} onClick={() => setConfirmSubmit(true)}>{submitting ? "Scoring…" : "Review and submit"}</button></div>
    </div>
    {confirmSubmit && <div className="modal-backdrop"><section className="submit-dialog" role="dialog" aria-modal="true" aria-labelledby="submit-title"><h2 id="submit-title">Submit this exam?</h2><p>{unansweredCount ? `You still have ${unansweredCount} unanswered ${unansweredCount === 1 ? "question" : "questions"}. You cannot change answers after submission.` : "Every question has an answer. You cannot change answers after submission."}</p><div><button className="secondary-action" onClick={() => setConfirmSubmit(false)}>Keep reviewing</button><button className="primary-action" disabled={submitting} onClick={() => { setConfirmSubmit(false); void submit(); }}>Submit for scoring</button></div></section></div>}
  </main>;
}

function ResultView({ exam, attempt, completionLabel, onExit }: { exam: Exam; attempt: Attempt; completionLabel: string; onExit: () => void }) {
  const stage = useRef<HTMLElement>(null);
  useEntrance(stage);
  const accuracy = attempt.question_count ? Math.round(((attempt.raw_score || 0) / attempt.question_count) * 100) : 0;
  const band = attempt.band_score ?? 0;
    return <main className="result-page" ref={stage}><div className="result-card">
      <Poster skill={posterSkill(exam.skill)} title={exam.skill} tag="Mock" band={attempt.band_score} size="lg" enter style={stagger(0, 0)} />
      <div className="result-body">
        <p className="result-kicker rise" style={stagger(0, 300)}>{exam.title}</p>
        <h1 className="rise" style={stagger(0, 420)}>Band <Roll value={band} from={Math.max(0, band - 3)} step={0.5} delay={700} duration={1300} /></h1>
        <p className="result-lead rise" style={stagger(0, 700)}>You answered <strong>{attempt.raw_score}</strong> of <strong>{attempt.question_count}</strong> questions correctly.</p>
        <div className="result-metrics"><div className="rise" style={stagger(0, 1100)}><strong>{accuracy}%</strong><span>Accuracy</span></div><div className="rise" style={stagger(1, 1100, 90)}><strong>{exam.skill}</strong><span>Skill</span></div><div className="rise" style={stagger(2, 1100, 90)}><strong>{Math.round(exam.duration_seconds / 60)} min</strong><span>Time allowed</span></div></div>
        <div className="result-guidance rise" style={stagger(0, 1500)}><strong>What to do next</strong><p>{accuracy >= 80 ? "Strong result. Try another mock in this skill to confirm that the score is consistent." : accuracy >= 60 ? "Good baseline. Review the missed answers, then repeat this skill with a fresh mock." : "Use this as your baseline. Focus on accuracy first, then take another timed mock."}</p></div>
        {attempt.answers.some((answer) => typeof answer.is_correct === "boolean") && <div className="answer-review"><span>Question review</span><div>{attempt.answers.map((answer, index) => <i key={answer.question_id} className={`land ${answer.is_correct ? "correct" : "incorrect"}`} style={stagger(Math.min(index, 30), 1800, 30, 700)} title={`Question ${index + 1}: ${answer.is_correct ? "correct" : "incorrect"}`}>{index + 1}</i>)}</div></div>}
        <button className="btn btn-primary rise" style={stagger(0, 2500, 0, 900)} onClick={onExit}>{completionLabel}</button>
      </div>
    </div></main>;
}

/**
 * An exam-day recording: it starts by itself, plays once, and offers no pause,
 * seek or replay. Recordings follow one another in order, and a reload resumes
 * where the recording was instead of starting it again.
 */
function ExamRecording({ src, index, attemptID }: { src: string; index: number; attemptID: string }) {
  const key = `mockai.exam-audio.${attemptID}`;
  const audio = useRef<HTMLAudioElement>(null);
  const [saved] = useState<{ i: number; t: number }>(() => { try { return JSON.parse(localStorage.getItem(key) || "") } catch { return { i: 0, t: 0 } } });
  const [state, setState] = useState<"waiting" | "playing" | "blocked" | "ended">(saved.i > index ? "ended" : "waiting");
  const remember = (i: number, t: number) => { try { localStorage.setItem(key, JSON.stringify({ i, t })) } catch { /* private window: a reload restarts the recording */ } };
  // A browser refuses to play sound on a page nobody has touched (after a reload): then the student starts it once.
  const play = () => { audio.current?.play()?.catch(() => setState("blocked")); };
  useEffect(() => { const el = audio.current; if (!el || saved.i !== index) return; el.currentTime = saved.t; play(); }, []);
  function ended() {
    setState("ended"); remember(index + 1, 0);
    const all = [...document.querySelectorAll<HTMLAudioElement>("audio[data-exam-recording]")];
    all[all.indexOf(audio.current!) + 1]?.play()?.catch(() => undefined);
  }
  return <div className="exam-recording" role="status">
    <audio ref={audio} data-exam-recording src={src} preload="auto" onPlaying={() => setState("playing")} onTimeUpdate={e => remember(index, e.currentTarget.currentTime)}
      onPause={e => { if (!e.currentTarget.ended) play(); }} onEnded={ended} />
    {state === "blocked" ? <button type="button" className="btn btn-primary" onClick={play}>Start the recording</button>
      : <p>{state === "playing" ? "The recording is playing. It plays once and cannot be paused or replayed."
        : state === "ended" ? "This recording has finished." : index ? "This recording starts when the previous part ends." : "The recording is starting…"}</p>}
  </div>;
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

  return <div className="speech-player"><button className="btn btn-ghost" onClick={toggle} disabled={!supported}>{playing ? "Stop audio" : "Play section audio"}</button><span>{supported ? "Use headphones. The transcript stays hidden during the exam." : "Audio playback is not supported in this browser."}</span></div>;
}

function QuestionInput({ question, index, current, value, saving, onFocus, onChange, onBlur }: { question: Question; index: number; current: boolean; value: string[]; saving: boolean; onFocus: () => void; onChange: (value: string[], immediate: boolean) => void; onBlur: () => void }) {
  const multiple = question.type === "multiple_select";
  return <article className={`question${current ? " is-current" : ""}`} id={`question-${question.id}`} data-index={index} tabIndex={-1} onFocus={onFocus}><div className="question-number num">{index + 1}</div><div>{isGap(question) ? <GapLine question={question} number={index + 1} value={value[0] || ""} onChange={(next) => onChange([next], false)} onBlur={onBlur} /> : <h3>{question.prompt}</h3>}
    {isGap(question) ? null : question.options.length > 0 ? <div className="options">{question.options.map((option) => { const selected = value.includes(option.value); return <label className={selected ? "selected" : ""} key={option.id}><input type={multiple ? "checkbox" : "radio"} name={question.id} checked={selected} onChange={() => { const next = multiple ? (selected ? value.filter((v) => v !== option.value) : [...value, option.value]) : [option.value]; onChange(next, next.length > 0); }} /><span>{option.label}</span>{option.value}</label>; })}</div> : <input className="answer-input" value={value[0] || ""} onChange={(event) => onChange([event.target.value], false)} onBlur={onBlur} placeholder="Type your answer" />}
    <small className="save-state">{saving ? "Saving…" : value.length && value[0] ? "Saved automatically" : ""}</small>
  </div></article>;
}
