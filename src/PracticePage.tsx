import { useEffect, useState } from "react";
import { examAPI, ExamSummary, HistoryItem, PracticeFeedback, PracticeQuestion } from "./exams";
import { learningAPI } from "./learning";
import { ArrowIcon, BookIcon, CheckIcon, ClockIcon, HeadphonesIcon, RefreshIcon, ReviewIcon, TargetIcon, MicIcon } from "./icons";

type Props = {
  onOpenWriting: () => void;
  onOpenSpeaking?: () => void;
  onNotebook?: () => void;
  autoStart?: boolean;
  initialSkill?: Skill;
  initialQuestionType?: string;
  onActivity?: () => void;
  exams?: ExamSummary[];
  history?: HistoryItem[];
  examsLoading?: boolean;
  opening?: string | null;
  onInspect?: (id: string) => Promise<void>;
};
type Skill = "reading" | "listening";

const questionTypes = [
  ["", "Mixed questions"],
  ["multiple_choice", "Multiple choice"],
  ["short_answer", "Short answer"],
  ["true_false_not_given", "True / False / Not Given"]
] as const;

export default function PracticePage({ onOpenWriting, onOpenSpeaking, onNotebook, autoStart=false, initialSkill = "reading", initialQuestionType = "", onActivity, exams=[], history=[], examsLoading=false, opening=null, onInspect }: Props) {
  const [skill, setSkill] = useState<Skill | "writing" | "speaking">(initialSkill);
  const [questionType, setQuestionType] = useState(initialQuestionType);
  const [questions, setQuestions] = useState<PracticeQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<PracticeFeedback | null>(null);
  const [results, setResults] = useState<PracticeFeedback[]>([]);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const [started, setStarted] = useState(false);
  const [firstResults, setFirstResults] = useState<PracticeFeedback[] | null>(null);
  const [retrying, setRetrying] = useState(false);
  useEffect(()=>{if(autoStart)void start()},[]);

  async function start() {
    if (skill === "writing") { onOpenWriting(); return; }
    if (skill === "speaking") { onOpenSpeaking?.(); return; }
    setLoading(true); setError("");
    try {
      const next = await examAPI.practice(skill, questionType, 5);
      setQuestions(next); setIndex(0); setAnswer([]); setFeedback(null); setResults([]); setFirstResults(null); setRetrying(false); setStarted(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Practice could not be loaded.");
    } finally { setLoading(false); }
  }

  async function check() {
    const question = questions[index];
    if (!question || !answer.some((value) => value.trim())) return;
    setChecking(true); setError("");
    try {
      const next = retrying ? await learningAPI.retry(question.id, answer) : await examAPI.checkPractice(question.id, answer);
      setFeedback(next); setResults((current) => [...current, next]);
      onActivity?.();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Your answer could not be checked.");
    } finally { setChecking(false); }
  }

  function advance() {
    setIndex((current) => current + 1); setAnswer([]); setFeedback(null); window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (!started) return <div className="content page-content">
    <header className="page-header"><p className="eyebrow">Focused learning</p><h1>Practice one skill at a time</h1><p>Try Reading or Listening questions, refine a Writing Task 2 essay, or take a Speaking interview. Practice feedback and AI estimates stay separate from your mock-exam results.</p></header>
    <section className="practice-setup">
      <div className="setup-block"><span className="setup-label">1. Choose a skill</span><div className="choice-grid">
        <button aria-pressed={skill === "reading"} className={skill === "reading" ? "selected" : ""} onClick={() => setSkill("reading")}><BookIcon /><strong>Reading</strong><span>Passages, detail and inference</span></button>
        <button aria-pressed={skill === "listening"} className={skill === "listening" ? "selected" : ""} onClick={() => setSkill("listening")}><HeadphonesIcon /><strong>Listening</strong><span>Facts, detail and intention</span></button>
        <button aria-pressed={skill === "writing"} className={skill === "writing" ? "selected" : ""} onClick={() => setSkill("writing")}><ReviewIcon /><strong>Writing</strong><span>Task 2 essays, scores and feedback</span></button>
        {onOpenSpeaking&&<button aria-pressed={skill === "speaking"} className={skill === "speaking" ? "selected" : ""} onClick={() => setSkill("speaking")}><MicIcon /><strong>Speaking</strong><span>Three-part interviews and pronunciation feedback</span></button>}
      </div></div>
      {skill === "speaking" ? <div className="setup-block"><span className="setup-label">2. Speak and reflect</span><p>Meet a randomly assigned regional examiner voice. Record all three parts, then get an estimated Speaking band, transcripts and specific feedback on fluency, vocabulary, grammar and pronunciation. Your permission is required before recording.</p></div> : skill === "writing" ? <div className="setup-block"><span className="setup-label">2. Write and improve</span><p>Choose a Task 2 prompt or bring your own. Save a draft, then request an AI review with an overall essay band estimate, four criterion scores, and specific advice on your arguments, vocabulary and grammar.</p><p>AI scores are practice estimates, not official IELTS results. Your permission is required before sending an essay for evaluation.</p></div> : <div className="setup-block"><span className="setup-label">2. Choose a focus</span><div className="practice-pills">{questionTypes.map(([value, label]) => <button className={questionType === value ? "selected" : ""} key={value} onClick={() => setQuestionType(value)}>{label}</button>)}</div></div>}
      {error && <div className="form-error" role="alert">{error}</div>}
      <button className="primary-action practice-start" disabled={loading} onClick={() => void start()}>{loading ? "Building your set…" : "Start"} <ArrowIcon /></button>
    </section>
    <section className="practice-note"><TargetIcon /><div><strong>Quick practice or a complete skill test</strong><p>Start above for a short focused set, or choose a complete {skill} test from the library below.</p></div></section>
    <PracticeLibrary skill={skill} exams={exams} history={history} loading={examsLoading} opening={opening} onInspect={onInspect} onOpenWriting={onOpenWriting} onOpenSpeaking={onOpenSpeaking} />
  </div>;

  if (!loading && questions.length === 0) return <div className="content page-content"><header className="page-header"><p className="eyebrow">Focused learning</p><h1>No matching questions yet</h1><p>Try mixed questions or another skill. Complete published tests remain available in your Practice library.</p></header><div className="empty-actions"><button className="primary-action" onClick={() => setStarted(false)}>Back to Practice</button></div></div>;

  if (index >= questions.length) {
    const correct = results.filter((result) => result.correct).length;
    const missed = questions.filter((_,i)=>!results[i]?.correct);
    return <div className="content page-content"><section className="practice-complete"><div className="complete-mark celebrate"><CheckIcon /></div><p className="eyebrow">{retrying ? "Mistake retry complete" : "Practice complete"}</p><h1>{correct} of {results.length} correct</h1><p>{retrying ? `You corrected ${correct} previously missed ${correct === 1 ? "answer" : "answers"} in this retry.` : correct === results.length ? "Every answer correct. Ready to practise under time pressure?" : "Your mistakes are saved in your notebook. Read the explanations below, then retry the missed questions."}</p>{firstResults&&<p>First pass: {firstResults.filter(r=>r.correct).length} of {firstResults.length} correct. Retry accuracy is shown separately.</p>}<div>{missed.length>0?<button className="primary-action" onClick={()=>{if(!firstResults)setFirstResults(results);setQuestions(missed);setResults([]);setIndex(0);setAnswer([]);setFeedback(null);setRetrying(true)}}>Retry {missed.length} missed questions <ArrowIcon/></button>:<button className="primary-action" onClick={()=>setStarted(false)}>Choose a complete test <ArrowIcon/></button>}<button className="secondary-action" onClick={onNotebook || (()=>setStarted(false))}>{onNotebook?"Open mistake notebook":"Change focus"}</button><button className="secondary-action" onClick={()=>void start()}><RefreshIcon/>New practice set</button></div></section><section className="completion-review"><h2>Your answer review</h2>{results.map((r,i)=><article key={r.question_id}><span className={r.correct?"correct":"incorrect"}>{r.correct?"✓ Correct":"↻ Practise again"} · {labelType(questions[i].type)}</span><h3>{questions[i].prompt}</h3><p><strong>Accepted:</strong> {r.accepted_answers.join(" / ")}</p><p>{r.explanation}</p></article>)}</section></div>;
  }

  const question = questions[index];
  return <div className="content page-content practice-session">
    <header className="practice-header"><div><p className="eyebrow">{question.skill} · {labelType(question.type)}</p><h1>Question {index + 1} of {questions.length}</h1></div><div className="practice-progress"><span style={{ width: `${((index + (feedback ? 1 : 0)) / questions.length) * 100}%` }} /></div><button onClick={() => setStarted(false)}>End practice</button></header>
    <div className="practice-workspace">
      <SourceMaterial question={question} />
      <section className="practice-question"><span className="question-context">From {question.exam_title} · {question.section_title}</span><h2>{question.prompt}</h2><PracticeAnswer question={question} value={answer} disabled={Boolean(feedback)} onChange={setAnswer} />
        {error && <div className="form-error" role="alert">{error}</div>}
        {feedback && <div className={`practice-feedback ${feedback.correct ? "correct" : "incorrect"}`} role="status"><strong>{feedback.correct ? "Correct" : "Not quite"}</strong>{!feedback.correct && <p>Accepted answer: <b>{feedback.accepted_answers.join(" / ")}</b></p>}<p>{feedback.explanation || (feedback.correct ? "You identified the right information." : "Compare your answer with the source material, then continue.")}</p></div>}
        <div className="practice-actions">{feedback ? <button className="primary-action" onClick={advance}>{index === questions.length - 1 ? "See my result" : "Next question"} <ArrowIcon /></button> : <button className="primary-action" disabled={checking || !answer.some((value) => value.trim())} onClick={() => void check()}>{checking ? "Checking…" : "Check answer"}</button>}</div>
      </section>
    </div>
  </div>;
}

function PracticeLibrary({ skill, exams, history, loading, opening, onInspect, onOpenWriting, onOpenSpeaking }: {
  skill: Skill | "writing" | "speaking"; exams: ExamSummary[]; history: HistoryItem[]; loading: boolean; opening: string | null;
  onInspect?: (id: string) => Promise<void>; onOpenWriting: () => void; onOpenSpeaking?: () => void;
}) {
  if (skill === "writing" || skill === "speaking") return <section className="practice-library-section"><div className="section-heading"><div><p className="eyebrow">Available assessment</p><h2>{skill === "writing" ? "Writing tasks" : "Speaking interviews"}</h2></div></div><button className="practice-assessment-card" onClick={skill === "writing" ? onOpenWriting : onOpenSpeaking}><span>{skill === "writing" ? <ReviewIcon/> : <MicIcon/>}</span><div><strong>{skill === "writing" ? "Open the Writing workspace" : "Start a Speaking interview"}</strong><small>{skill === "writing" ? "Choose an available prompt, write your response and receive a full band report." : "Complete a live three-part interview and receive a full band report."}</small></div><ArrowIcon/></button></section>;
  const filtered = exams.filter((exam) => exam.skill === skill);
  return <section className="practice-library-section" aria-labelledby="practice-library-title"><div className="section-heading"><div><p className="eyebrow">Complete skill tests</p><h2 id="practice-library-title">{skill === "reading" ? "Reading" : "Listening"} test library</h2></div></div>
    {loading ? <div className="skeleton-grid" aria-label="Loading tests">{Array.from({length:4},(_,index)=><div className="skeleton-card" key={index}><i/><i/><i/></div>)}</div> : filtered.length ? <div className="exam-library">{filtered.map((exam,index)=>{
      const active=history.some((item)=>item.status==="in_progress"&&item.title===exam.title);
      const attempts=history.filter((item)=>item.status==="scored"&&item.title===exam.title).length;
      return <article className={`library-card ${exam.skill} tone-${index%3}`} key={exam.id}><div className="library-icon">{exam.skill==="listening"?<HeadphonesIcon/>:<BookIcon/>}</div><div className="library-card-top"><span className="skill-chip">{exam.skill}</span>{active&&<span className="status-chip active">In progress</span>}</div><h2>{exam.title}</h2><p>{exam.description||"Complete IELTS-style practice with automatic scoring and progress tracking."}</p><div className="exam-meta"><span><ClockIcon/> {minutes(exam.duration_seconds)} min</span><span><CheckIcon/> {exam.question_count} questions</span></div><div className="library-footer"><small>{attempts?`${attempts} completed ${attempts===1?"attempt":"attempts"}`:"Not attempted yet"}</small><button disabled={!onInspect||opening===exam.id} onClick={()=>onInspect&&void onInspect(exam.id)}>{opening===exam.id?"Opening…":active?"Resume":"View test"} <ArrowIcon/></button></div></article>;
    })}</div>:<div className="empty-state"><BookIcon/><h2>No published {skill} tests yet</h2><p>Tests will appear here as soon as they are published.</p></div>}
  </section>;
}

export function PracticeAnswer({ question, value, disabled, onChange }: { question: PracticeQuestion; value: string[]; disabled: boolean; onChange: (value: string[]) => void }) {
  const multiple = question.type === "multiple_select";
  if (!question.options.length) return <input className="answer-input" disabled={disabled} value={value[0] || ""} onChange={(event) => onChange([event.target.value])} placeholder="Type your answer" />;
  return <div className="options practice-options">{question.options.map((option) => { const selected = value.includes(option.value); return <label className={selected ? "selected" : ""} key={option.id}><input disabled={disabled} type={multiple ? "checkbox" : "radio"} name={question.id} checked={selected} onChange={() => onChange(multiple ? (selected ? value.filter((item) => item !== option.value) : [...value, option.value]) : [option.value])} /><span>{option.label}</span>{option.value}</label>; })}</div>;
}

export function SourceMaterial({ question }: { question: PracticeQuestion }) {
  if (question.skill === "listening") return <div className="practice-source listening-source"><HeadphonesIcon /><p className="eyebrow">Listening material</p><h2>{question.section_title}</h2><p>{question.section_instructions}</p>{question.audio_url ? <audio controls src={question.audio_url} /> : question.passage ? <PracticeSpeech text={question.passage} /> : <span>Audio is unavailable for this question.</span>}</div>;
  return <article className="practice-source"><p className="eyebrow">Reading passage</p><h2>{question.section_title}</h2><p className="source-instructions">{question.section_instructions}</p><div>{question.passage}</div></article>;
}

function PracticeSpeech({ text }: { text: string }) {
  const [playing, setPlaying] = useState(false);
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;
  useEffect(() => () => { if (supported) window.speechSynthesis.cancel(); }, [supported]);
  function play() {
    if (!supported) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text); utterance.lang = "en-GB"; utterance.rate = .92;
    utterance.onend = () => setPlaying(false); utterance.onerror = () => setPlaying(false);
    window.speechSynthesis.speak(utterance); setPlaying(true);
  }
  return <button disabled={!supported || playing} onClick={play}>{playing ? "Playing audio…" : "Play audio"}</button>;
}

function labelType(value: string) { return value.split("_").map((part) => part[0].toUpperCase() + part.slice(1)).join(" "); }
function minutes(seconds: number) { return Math.max(1, Math.round(seconds / 60)); }
