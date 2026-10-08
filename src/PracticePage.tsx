import { useEffect, useState } from "react";
import { examAPI, ExamSummary, HistoryItem, PracticeFeedback, PracticeQuestion } from "./exams";
import { learningAPI } from "./learning";
import type { ManagedContent } from "./managedContent";
import { ArrowIcon, BookIcon, CheckIcon, ClockIcon, HeadphonesIcon, RefreshIcon, ReviewIcon, TargetIcon, MicIcon } from "./icons";

type Props = {
  onOpenWriting: (contentID?: string) => void;
  onOpenSpeaking?: (contentID?: string, part?: number) => void;
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
  writingContent?: ManagedContent[];
  speakingContent?: ManagedContent[];
};
type Skill = "reading" | "listening";
type WritingFocus = "all" | "task_1" | "task_2" | "chart" | "table" | "map" | "process";
type SpeakingFocus = 0 | 1 | 2 | 3;

const questionTypes = [
  ["", "Mixed questions"],
  ["multiple_choice", "Multiple choice"],
  ["short_answer", "Short answer"],
  ["true_false_not_given", "True / False / Not Given"]
] as const;

const writingTypes: ReadonlyArray<[WritingFocus, string]> = [
  ["all", "All writing"],
  ["task_1", "Task 1"],
  ["task_2", "Task 2 essays"],
  ["chart", "Charts & graphs"],
  ["table", "Tables"],
  ["map", "Maps"],
  ["process", "Processes & diagrams"]
];
const speakingTypes: ReadonlyArray<[SpeakingFocus, string]> = [[0,"Full interview"],[1,"Part 1"],[2,"Part 2"],[3,"Part 3"]];

export default function PracticePage({ onOpenWriting, onOpenSpeaking, onNotebook, autoStart=false, initialSkill = "reading", initialQuestionType = "", onActivity, exams=[], history=[], examsLoading=false, opening=null, onInspect, writingContent=[], speakingContent=[] }: Props) {
  const [skill, setSkill] = useState<Skill | "writing" | "speaking">(initialSkill);
  const [questionType, setQuestionType] = useState(initialQuestionType);
  const [writingFocus, setWritingFocus] = useState<WritingFocus>("all");
  const [speakingFocus, setSpeakingFocus] = useState<SpeakingFocus>(0);
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
    if (skill === "writing") {
      const matching = writingContent.filter((item) => matchesWritingFocus(item, writingFocus));
      const selected = matching.length ? matching[Math.floor(Math.random() * matching.length)] : undefined;
      onOpenWriting(selected?.id);
      return;
    }
    if (skill === "speaking") {
      const selected = speakingContent.length ? speakingContent[Math.floor(Math.random() * speakingContent.length)] : undefined;
      onOpenSpeaking?.(selected?.id, speakingFocus || undefined);
      return;
    }
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
    <header className="page-header"><p className="eyebrow">Focused learning</p><h1>Practice one skill at a time</h1><p>Try Reading or Listening questions, complete an Academic Writing Task 1 or Task 2 response, or take a Speaking interview. Practice feedback and AI estimates stay separate from your mock-exam results.</p></header>
    <section className="practice-setup">
      <div className="setup-block"><span className="setup-label">1. Choose a skill</span><div className="choice-grid">
        <button aria-pressed={skill === "reading"} className={skill === "reading" ? "selected" : ""} onClick={() => setSkill("reading")}><BookIcon /><strong>Reading</strong><span>Passages, detail and inference</span></button>
        <button aria-pressed={skill === "listening"} className={skill === "listening" ? "selected" : ""} onClick={() => setSkill("listening")}><HeadphonesIcon /><strong>Listening</strong><span>Facts, detail and intention</span></button>
        <button aria-pressed={skill === "writing"} className={skill === "writing" ? "selected" : ""} onClick={() => setSkill("writing")}><ReviewIcon /><strong>Writing</strong><span>Task 1 and Task 2 with feedback</span></button>
        {onOpenSpeaking&&<button aria-pressed={skill === "speaking"} className={skill === "speaking" ? "selected" : ""} onClick={() => setSkill("speaking")}><MicIcon /><strong>Speaking</strong><span>Three-part interviews and pronunciation feedback</span></button>}
      </div></div>
      {skill === "speaking" ? <div className="setup-block"><span className="setup-label">2. Choose an interview part</span><div className="practice-pills" role="group" aria-label="Choose a Speaking interview part">{speakingTypes.map(([value,label])=><button className={speakingFocus===value?"selected":""} aria-pressed={speakingFocus===value} key={value} onClick={()=>setSpeakingFocus(value)}>{label}</button>)}</div><p>{speakingFocus===0?"Complete a realistic three-part interview.":speakingFocus===1?"Warm up with questions about familiar, everyday topics.":speakingFocus===2?"Prepare for one minute, then give a two-minute long turn.":"Develop opinions, reasons and examples in a deeper discussion."} You’ll receive transcripts and focused feedback after finishing.</p></div> : skill === "writing" ? <div className="setup-block"><span className="setup-label">2. Choose a writing type</span><div className="practice-pills writing-type-pills" role="group" aria-label="Filter writing tests by type">{writingTypes.map(([value,label])=><button className={writingFocus===value?"selected":""} aria-pressed={writingFocus===value} key={value} onClick={()=>setWritingFocus(value)}>{label}</button>)}</div><p>Choose a published prompt below or press Start for one matching this type. Every response includes an estimated band and criterion-level feedback.</p><p>AI scores are practice estimates, not official IELTS results. Your permission is required before sending a response for evaluation.</p></div> : <div className="setup-block"><span className="setup-label">2. Choose a focus</span><div className="practice-pills">{questionTypes.map(([value, label]) => <button className={questionType === value ? "selected" : ""} key={value} onClick={() => setQuestionType(value)}>{label}</button>)}</div></div>}
      {error && <div className="form-error" role="alert">{error}</div>}
      <button className="primary-action practice-start" disabled={loading} onClick={() => void start()}>{loading ? "Building your set…" : "Start"} <ArrowIcon /></button>
    </section>
    <section className="practice-note"><TargetIcon /><div><strong>Quick practice or a complete skill test</strong><p>Start above for a short focused set, or choose a complete {skill} test from the library below.</p></div></section>
    <PracticeLibrary skill={skill} exams={exams} history={history} loading={examsLoading} opening={opening} onInspect={onInspect} onOpenWriting={onOpenWriting} onOpenSpeaking={onOpenSpeaking} writingContent={writingContent} speakingContent={speakingContent} writingFocus={writingFocus} speakingFocus={speakingFocus} />
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

function PracticeLibrary({ skill, exams, history, loading, opening, onInspect, onOpenWriting, onOpenSpeaking, writingContent=[], speakingContent=[], writingFocus, speakingFocus }: {
  skill: Skill | "writing" | "speaking"; exams: ExamSummary[]; history: HistoryItem[]; loading: boolean; opening: string | null;
  onInspect?: (id: string) => Promise<void>; onOpenWriting: (contentID?: string) => void; onOpenSpeaking?: (contentID?: string, part?: number) => void;
  writingContent?: ManagedContent[]; speakingContent?: ManagedContent[];
  writingFocus: WritingFocus;
  speakingFocus: SpeakingFocus;
}) {
  if (skill === "writing" || skill === "speaking") {
    const content=skill==="writing"?writingContent.filter(item=>matchesWritingFocus(item,writingFocus)):speakingContent;
    return <section className="practice-library-section"><div className="section-heading"><div><p className="eyebrow">Published content</p><h2>{skill === "writing" ? "Writing test library" : "Speaking test library"}</h2></div></div>{loading?<div className="skeleton-grid" aria-label={`Loading ${skill} tests`}>{Array.from({length:4},(_,index)=><div className="skeleton-card" key={index}><i/><i/><i/></div>)}</div>:content.length?<div className="exam-library">{content.map((item,index)=>{
      const task=item.data.task==="task_1"?"Task 1":"Task 2",turns=Array.isArray(item.data.turns)?item.data.turns.length:0;
      const speakingLabel=speakingFocus?`Part ${speakingFocus}`:`${new Set((item.data.turns as Array<{part?:number}>|undefined)?.map(v=>v.part)).size||3}-part interview`;
      const speakingMinutes=speakingFocus===1?"4–5":speakingFocus===2?"3–4":speakingFocus===3?"4–5":"12–15";
      return <article className={`library-card ${skill} tone-${index%3}`} key={item.id}><div className="library-icon">{skill==="writing"?<ReviewIcon/>:<MicIcon/>}</div><div className="library-card-top"><span className="skill-chip">{skill==="writing"?task:speakingLabel}</span></div><h2>{item.title}</h2><p>{item.summary||String(item.data.prompt||"Complete this IELTS practice assessment and receive detailed feedback.")}</p><div className="exam-meta"><span><ClockIcon/> {skill==="writing"?(task==="Task 1"?20:40):speakingMinutes} min</span><span><CheckIcon/> {skill==="speaking"&&speakingFocus?"Focused report":"Full band report"}</span></div><div className="library-footer"><small>Published assessment</small><button onClick={()=>skill==="writing"?onOpenWriting(item.id):onOpenSpeaking?.(item.id,speakingFocus||undefined)}>{skill==="writing"?"Open task":speakingFocus?`Start Part ${speakingFocus}`:"Start interview"} <ArrowIcon/></button></div></article>;
    })}</div>:<div className="empty-state">{skill==="writing"?<ReviewIcon/>:<MicIcon/>}<h2>No published {skill} tests yet</h2><p>Tests will appear here as soon as they are published.</p></div>}</section>;
  }
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

export function writingContentType(item: ManagedContent): WritingFocus {
  if (item.data.task !== "task_1") return "task_2";
  const prompt = String(item.data.prompt || "").toLowerCase();
  if (/\b(map|maps|site plan|plans)\b/u.test(prompt)) return "map";
  if (/\b(table|tables)\b/u.test(prompt)) return "table";
  if (/\b(process|processes|stages|cycle|cycles|how .+ (?:is|are) (?:made|produced|built|created|recycled|generated))\b/u.test(prompt) || /\bdiagram|diagrams\b/u.test(prompt)) return "process";
  return "chart";
}

export function matchesWritingFocus(item: ManagedContent, focus: WritingFocus) {
  if (focus === "all") return true;
  if (focus === "task_1") return item.data.task === "task_1";
  if (focus === "task_2") return item.data.task !== "task_1";
  return item.data.task === "task_1" && writingContentType(item) === focus;
}
