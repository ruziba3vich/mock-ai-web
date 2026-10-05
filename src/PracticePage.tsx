import { useEffect, useState } from "react";
import { examAPI, PracticeFeedback, PracticeQuestion } from "./exams";
import { ArrowIcon, BookIcon, CheckIcon, HeadphonesIcon, RefreshIcon, TargetIcon } from "./icons";

type Props = { onOpenExams: () => void; initialSkill?: Skill; initialQuestionType?: string; onActivity?: () => void };
type Skill = "reading" | "listening";

const questionTypes = [
  ["", "Mixed questions"],
  ["multiple_choice", "Multiple choice"],
  ["short_answer", "Short answer"],
  ["true_false_not_given", "True / False / Not Given"]
] as const;

export default function PracticePage({ onOpenExams, initialSkill = "reading", initialQuestionType = "", onActivity }: Props) {
  const [skill, setSkill] = useState<Skill>(initialSkill);
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

  async function start() {
    setLoading(true); setError("");
    try {
      const next = await examAPI.practice(skill, questionType, 5);
      setQuestions(next); setIndex(0); setAnswer([]); setFeedback(null); setResults([]); setStarted(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Practice could not be loaded.");
    } finally { setLoading(false); }
  }

  async function check() {
    const question = questions[index];
    if (!question || !answer.some((value) => value.trim())) return;
    setChecking(true); setError("");
    try {
      const next = await examAPI.checkPractice(question.id, answer);
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
    <header className="page-header"><p className="eyebrow">Focused learning</p><h1>Practice one skill at a time</h1><p>Work through five questions without a timer. You will see the correct answer immediately, and practice results will not change your mock-exam band.</p></header>
    <section className="practice-setup">
      <div className="setup-block"><span className="setup-label">1. Choose a skill</span><div className="choice-grid">
        <button className={skill === "reading" ? "selected" : ""} onClick={() => setSkill("reading")}><BookIcon /><strong>Reading</strong><span>Passages, detail and inference</span></button>
        <button className={skill === "listening" ? "selected" : ""} onClick={() => setSkill("listening")}><HeadphonesIcon /><strong>Listening</strong><span>Facts, detail and intention</span></button>
      </div></div>
      <div className="setup-block"><span className="setup-label">2. Choose a focus</span><div className="practice-pills">{questionTypes.map(([value, label]) => <button className={questionType === value ? "selected" : ""} key={value} onClick={() => setQuestionType(value)}>{label}</button>)}</div></div>
      {error && <div className="form-error" role="alert">{error}</div>}
      <button className="primary-action practice-start" disabled={loading} onClick={() => void start()}>{loading ? "Building your set…" : "Start 5-question practice"} <ArrowIcon /></button>
    </section>
    <section className="practice-note"><TargetIcon /><div><strong>Practice for accuracy, mock for readiness</strong><p>Use this page to understand mistakes. Use Mock exams when you want a realistic timed band estimate.</p></div><button onClick={onOpenExams}>Browse mocks</button></section>
  </div>;

  if (!loading && questions.length === 0) return <div className="content page-content"><header className="page-header"><p className="eyebrow">Focused learning</p><h1>No matching questions yet</h1><p>Try mixed questions or another skill. The library will grow as new exams are published.</p></header><div className="empty-actions"><button className="secondary-action" onClick={() => setStarted(false)}>Change filters</button><button className="primary-action" onClick={onOpenExams}>Browse mock exams</button></div></div>;

  if (index >= questions.length) {
    const correct = results.filter((result) => result.correct).length;
    return <div className="content page-content"><section className="practice-complete"><div className="complete-mark"><CheckIcon /></div><p className="eyebrow">Practice complete</p><h1>{correct} of {results.length} correct</h1><p>{correct === results.length ? "Excellent accuracy. Try a timed mock to test the same skill under pressure." : "Review the explanations you just saw, then try another set to reinforce the pattern."}</p><div><button className="secondary-action" onClick={() => setStarted(false)}>Change focus</button><button className="primary-action" onClick={() => void start()}><RefreshIcon /> Practice another set</button></div></section></div>;
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

function PracticeAnswer({ question, value, disabled, onChange }: { question: PracticeQuestion; value: string[]; disabled: boolean; onChange: (value: string[]) => void }) {
  const multiple = question.type === "multiple_select";
  if (!question.options.length) return <input className="answer-input" disabled={disabled} value={value[0] || ""} onChange={(event) => onChange([event.target.value])} placeholder="Type your answer" />;
  return <div className="options practice-options">{question.options.map((option) => { const selected = value.includes(option.value); return <label className={selected ? "selected" : ""} key={option.id}><input disabled={disabled} type={multiple ? "checkbox" : "radio"} name={question.id} checked={selected} onChange={() => onChange(multiple ? (selected ? value.filter((item) => item !== option.value) : [...value, option.value]) : [option.value])} /><span>{option.label}</span>{option.value}</label>; })}</div>;
}

function SourceMaterial({ question }: { question: PracticeQuestion }) {
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
