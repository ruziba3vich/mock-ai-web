import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { User } from "./auth";
import { Exam, ExamSummary, examAPI, HistoryItem, SkillProgress } from "./exams";
import { ArrowIcon, BookIcon, ChartIcon, CheckIcon, ClockIcon, GridIcon, HeadphonesIcon, HistoryIcon, RefreshIcon, ReviewIcon, TargetIcon } from "./icons";
import PracticePage from "./PracticePage";
import ReviewPage from "./ReviewPage";

type View = "dashboard" | "practice" | "exams" | "review" | "progress";
type Props = { user: User; onLogout: () => Promise<void>; onStartExam: (exam: Exam) => Promise<void> };

const viewLabels: Record<View, string> = { dashboard: "Home", practice: "Practice", exams: "Mock exams", review: "Review", progress: "Progress" };

export default function StudentApp({ user, onLogout, onStartExam }: Props) {
  const [view, setView] = useState<View>(() => viewFromHash());
  const [exams, setExams] = useState<ExamSummary[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [progress, setProgress] = useState<SkillProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState("");
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const initials = initialsFor(user.display_name);

  useEffect(() => {
    const onHashChange = () => setView(viewFromHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  async function loadData() {
    setLoading(true);
    setDataError("");
    try {
      const [examList, attempts, skills] = await Promise.all([examAPI.list(), examAPI.history(50), examAPI.progress()]);
      setExams(examList);
      setHistory(attempts);
      setProgress(skills);
    } catch (error) {
      setDataError(messageFor(error, "Your study data could not be loaded."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadData(); }, []);

  function navigate(next: View) {
    window.location.hash = next;
    setView(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function inspectExam(id: string) {
    setOpening(id);
    setDataError("");
    try {
      setSelectedExam(await examAPI.get(id));
    } catch (error) {
      setDataError(messageFor(error, "This exam could not be opened."));
    } finally {
      setOpening(null);
    }
  }

  async function beginExam() {
    if (!selectedExam) return;
    setStarting(true);
    setDataError("");
    try {
      await onStartExam(selectedExam);
    } catch (error) {
      setDataError(messageFor(error, "The exam could not be started."));
      setSelectedExam(null);
    } finally {
      setStarting(false);
    }
  }

  const completed = history.filter((item) => item.status === "scored");
  const active = history.find((item) => item.status === "in_progress");
  const completedCount = progress.reduce((sum, item) => sum + item.completed_attempts, 0);
  const averageBand = completedCount
    ? progress.reduce((sum, item) => sum + item.average_band * item.completed_attempts, 0) / completedCount
    : null;

  return <div className="app-shell">
    <aside className="sidebar">
      <button className="brand brand-button" onClick={() => navigate("dashboard")} aria-label="Mock AI dashboard"><span className="brand-mark">M</span><span>mock.ai</span></button>
      <nav aria-label="Main navigation">
        <NavButton active={view === "dashboard"} onClick={() => navigate("dashboard")} icon={<GridIcon />}>Dashboard</NavButton>
        <NavButton active={view === "practice"} onClick={() => navigate("practice")} icon={<TargetIcon />}>Practice</NavButton>
        <NavButton active={view === "exams"} onClick={() => navigate("exams")} icon={<BookIcon />}>Mock exams</NavButton>
        <NavButton active={view === "review"} onClick={() => navigate("review")} icon={<ReviewIcon />}>Review</NavButton>
        <NavButton active={view === "progress"} onClick={() => navigate("progress")} icon={<ChartIcon />}>Progress</NavButton>
      </nav>
      <div className="sidebar-help"><span className="sidebar-help-icon">?</span><div><strong>Need a starting point?</strong><p>Choose one skill and complete a full mock. Your plan updates from the result.</p></div></div>
      <div className="sidebar-footer">
        {user.avatar_url ? <img className="avatar" src={user.avatar_url} alt="" /> : <div className="avatar">{initials}</div>}
        <div className="profile-copy"><strong>{user.display_name}</strong><span>{user.roles.includes("admin") ? "Admin" : "Student"}</span></div>
        <button className="logout-button" aria-label="Sign out" title="Sign out" onClick={() => void onLogout()}>↗</button>
      </div>
    </aside>

    <main className="student-main">
      <header className="mobile-header">
        <button className="brand brand-button" onClick={() => navigate("dashboard")}><span className="brand-mark">M</span><span>mock.ai</span></button>
        <div className="mobile-title">{viewLabels[view]}</div>
        <button aria-label="Sign out" className="avatar small" onClick={() => void onLogout()}>{initials}</button>
      </header>

      {dataError && <div className="global-notice error" role="alert"><span>{dataError}</span><button onClick={() => void loadData()}><RefreshIcon /> Try again</button></div>}

      {view === "dashboard" && <DashboardPage user={user} exams={exams} recent={history.slice(0, 4)} progress={progress} active={active} averageBand={averageBand} completedCount={completedCount} loading={loading} opening={opening} onInspect={inspectExam} onViewPractice={() => navigate("practice")} onViewExams={() => navigate("exams")} onViewReview={() => navigate("review")} onViewProgress={() => navigate("progress")} />}
      {view === "practice" && <PracticePage onOpenExams={() => navigate("exams")} />}
      {view === "exams" && <ExamsPage exams={exams} history={history} loading={loading} opening={opening} onInspect={inspectExam} />}
      {view === "review" && <ReviewPage history={history} loading={loading} onOpenExams={() => navigate("exams")} onOpenPractice={() => navigate("practice")} />}
      {view === "progress" && <ProgressPage progress={progress} history={history} completed={completed} loading={loading} onFindExam={() => navigate("exams")} />}

      <nav className="bottom-nav" aria-label="Mobile navigation">
        <NavButton active={view === "dashboard"} onClick={() => navigate("dashboard")} icon={<GridIcon />}>Home</NavButton>
        <NavButton active={view === "practice"} onClick={() => navigate("practice")} icon={<TargetIcon />}>Practice</NavButton>
        <NavButton active={view === "exams"} onClick={() => navigate("exams")} icon={<BookIcon />}>Exams</NavButton>
        <NavButton active={view === "review"} onClick={() => navigate("review")} icon={<ReviewIcon />}>Review</NavButton>
        <NavButton active={view === "progress"} onClick={() => navigate("progress")} icon={<ChartIcon />}>Progress</NavButton>
      </nav>
    </main>

    {selectedExam && <ExamBriefing exam={selectedExam} active={history.some((item) => item.status === "in_progress" && item.title === selectedExam.title)} starting={starting} onClose={() => setSelectedExam(null)} onBegin={() => void beginExam()} />}
  </div>;
}

function DashboardPage({ user, exams, recent, progress, active, averageBand, completedCount, loading, opening, onInspect, onViewPractice, onViewExams, onViewReview, onViewProgress }: {
  user: User; exams: ExamSummary[]; recent: HistoryItem[]; progress: SkillProgress[]; active?: HistoryItem;
  averageBand: number | null; completedCount: number; loading: boolean; opening: string | null;
  onInspect: (id: string) => Promise<void>; onViewPractice: () => void; onViewExams: () => void; onViewReview: () => void; onViewProgress: () => void;
}) {
  const firstName = user.display_name.trim().split(/\s+/)[0] || "there";
  const recommendation = exams.find((exam) => exam.skill === weakestSkill(progress)) || exams[0];
  const date = new Intl.DateTimeFormat("en", { weekday: "long", day: "numeric", month: "long" }).format(new Date());

  return <div className="content page-content">
    <section className="dashboard-hero">
      <div><p className="eyebrow">{date}</p><h1>Ready for your next step, {firstName}?</h1><p className="hero-copy">Build accuracy with short practice, review every mistake, and use timed mocks when you are ready to measure your band.</p><div className="hero-actions"><button className="primary-action" onClick={onViewPractice}>Start focused practice <ArrowIcon /></button><button className="secondary-action" onClick={completedCount > 0 ? onViewReview : onViewExams}>{completedCount > 0 ? "Review my mistakes" : "Take a mock exam"}</button></div></div>
      <div className="band-card"><span>Overall average</span><strong>{averageBand === null ? "—" : averageBand.toFixed(1)}</strong><small>{completedCount ? `Based on ${completedCount} completed ${completedCount === 1 ? "exam" : "exams"}` : "Your first result will appear here"}</small></div>
    </section>

    <section className="quick-guide" aria-label="How Mock AI works">
      <div><span>1</span><strong>Practise a weakness</strong><p>Get feedback without a timer.</p></div>
      <div><span>2</span><strong>Measure your band</strong><p>Take a realistic timed mock.</p></div>
      <div><span>3</span><strong>Review every mistake</strong><p>Compare and practise again.</p></div>
    </section>

    {active && <section className="resume-banner"><div className="resume-icon"><ClockIcon /></div><div><p className="eyebrow">In progress</p><h2>Continue {active.title}</h2><p>Your saved answers are waiting. The server timer continues from your original start.</p></div>{exams.find((exam) => exam.title === active.title) && <button onClick={() => void onInspect(exams.find((exam) => exam.title === active.title)!.id)}>Resume exam <ArrowIcon /></button>}</section>}

    <section className="section compact-section">
      <SectionHeading eyebrow="Recommended next" title={completedCount ? "Keep building your score" : "Start with a complete mock"} action="All exams" onAction={onViewExams} />
      {loading ? <CardSkeletons /> : recommendation ? <div className="featured-exam"><div className={`featured-visual ${recommendation.skill}`}>{recommendation.skill === "listening" ? <HeadphonesIcon /> : <BookIcon />}<span>{recommendation.skill}</span></div><div className="featured-copy"><p className="eyebrow">{recommendation.skill} practice</p><h3>{recommendation.title}</h3><p>{recommendation.description || "A timed IELTS-style mock designed to establish your current level."}</p><div className="exam-meta"><span><ClockIcon /> {minutes(recommendation.duration_seconds)} min</span><span><CheckIcon /> {recommendation.question_count} questions</span></div></div><button className="primary-action" disabled={opening === recommendation.id} onClick={() => void onInspect(recommendation.id)}>{opening === recommendation.id ? "Opening…" : "View exam"} <ArrowIcon /></button></div> : <EmptyExams onAction={onViewExams} />}
    </section>

    <section className="section compact-section"><SectionHeading eyebrow="Activity" title="Recent attempts" action="Full progress" onAction={onViewProgress} />{loading ? <ListSkeleton /> : <HistoryList items={recent} emptyText="Your completed and active exams will appear here." />}</section>
  </div>;
}

function ExamsPage({ exams, history, loading, opening, onInspect }: { exams: ExamSummary[]; history: HistoryItem[]; loading: boolean; opening: string | null; onInspect: (id: string) => Promise<void> }) {
  const [filter, setFilter] = useState<"all" | "reading" | "listening">("all");
  const filtered = filter === "all" ? exams : exams.filter((exam) => exam.skill === filter);
  return <div className="content page-content">
    <PageHeader eyebrow="Exam library" title="Choose a mock exam" copy="Pick a skill, check the format, and begin only when you are ready—the timer starts after the exam briefing." />
    <div className="filter-row" role="group" aria-label="Filter exams by skill">{(["all", "reading", "listening"] as const).map((item) => <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item === "all" ? "All exams" : item}</button>)}</div>
    {loading ? <CardSkeletons count={4} /> : filtered.length ? <div className="exam-library">{filtered.map((exam, index) => {
      const active = history.some((item) => item.status === "in_progress" && item.title === exam.title);
      const attempts = history.filter((item) => item.title === exam.title && item.status === "scored").length;
      return <article className={`library-card ${exam.skill} tone-${index % 3}`} key={exam.id}><div className="library-icon">{exam.skill === "listening" ? <HeadphonesIcon /> : <BookIcon />}</div><div className="library-card-top"><span className="skill-chip">{exam.skill}</span>{active && <span className="status-chip active">In progress</span>}</div><h2>{exam.title}</h2><p>{exam.description || "Timed IELTS-style practice with automatic scoring and progress tracking."}</p><div className="exam-meta"><span><ClockIcon /> {minutes(exam.duration_seconds)} min</span><span><CheckIcon /> {exam.question_count} questions</span></div><div className="library-footer"><small>{attempts ? `${attempts} completed ${attempts === 1 ? "attempt" : "attempts"}` : "Not attempted yet"}</small><button disabled={opening === exam.id} onClick={() => void onInspect(exam.id)}>{opening === exam.id ? "Opening…" : active ? "Resume" : "View exam"} <ArrowIcon /></button></div></article>;
    })}</div> : <EmptyExams />}
  </div>;
}

function ProgressPage({ progress, history, completed, loading, onFindExam }: { progress: SkillProgress[]; history: HistoryItem[]; completed: HistoryItem[]; loading: boolean; onFindExam: () => void }) {
  const total = progress.reduce((sum, item) => sum + item.completed_attempts, 0);
  const best = progress.length ? Math.max(...progress.map((item) => item.best_band)) : null;
  const totalCorrect = progress.reduce((sum, item) => sum + item.correct_answers, 0);
  const totalQuestions = progress.reduce((sum, item) => sum + item.total_questions, 0);
  const accuracy = totalQuestions ? Math.round((totalCorrect / totalQuestions) * 100) : null;
  return <div className="content page-content">
    <PageHeader eyebrow="Performance" title="Your progress" copy="Use band trends and accuracy together. A higher band shows the outcome; accuracy shows where consistent practice is paying off." />
    {loading ? <CardSkeletons count={3} /> : total === 0 ? <div className="progress-empty"><div className="empty-illustration"><ChartIcon /></div><h2>No results yet</h2><p>Complete your first mock exam and this page will turn it into a clear baseline for Reading and Listening.</p><button className="primary-action" onClick={onFindExam}>Find my first exam <ArrowIcon /></button></div> : <><div className="metric-grid"><Metric label="Completed exams" value={String(total)} hint="Scored attempts" /><Metric label="Best band" value={best?.toFixed(1) || "—"} hint="Across both skills" /><Metric label="Overall accuracy" value={accuracy === null ? "—" : `${accuracy}%`} hint={`${Math.round(totalCorrect)} of ${totalQuestions} answers`} /></div><section className="section compact-section"><SectionHeading eyebrow="By skill" title="Reading and Listening" /><div className="skill-grid">{["reading", "listening"].map((skill) => <SkillCard key={skill} skill={skill} data={progress.find((item) => item.skill === skill)} />)}</div></section><section className="section compact-section"><SectionHeading eyebrow="Timeline" title="Attempt history" /><HistoryList items={history} emptyText="No attempts yet." /></section>{completed.length > 0 && <p className="progress-note">Tip: compare at least three attempts in the same skill before judging a trend.</p>}</>}
  </div>;
}

function ExamBriefing({ exam, active, starting, onClose, onBegin }: { exam: Exam; active: boolean; starting: boolean; onClose: () => void; onBegin: () => void }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="exam-briefing" role="dialog" aria-modal="true" aria-labelledby="briefing-title"><button className="modal-close" onClick={onClose} aria-label="Close exam briefing">×</button><div className={`briefing-icon ${exam.skill}`}>{exam.skill === "listening" ? <HeadphonesIcon /> : <BookIcon />}</div><p className="eyebrow">{exam.skill} mock exam</p><h2 id="briefing-title">{exam.title}</h2><p className="briefing-description">{exam.description || "A timed IELTS-style mock with automatic scoring."}</p><div className="briefing-stats"><div><ClockIcon /><strong>{minutes(exam.duration_seconds)} minutes</strong><span>Server-timed</span></div><div><CheckIcon /><strong>{exam.question_count} questions</strong><span>{exam.sections.length} {exam.sections.length === 1 ? "section" : "sections"}</span></div></div>{exam.instructions && <div className="instruction-box"><strong>Before you begin</strong><p>{exam.instructions}</p></div>}<ul className="readiness-list"><li><CheckIcon /> Find a quiet place and keep this tab open.</li><li><CheckIcon /> Answers save automatically as you work.</li><li><CheckIcon /> Submit before time ends; the exam auto-submits at zero.</li></ul><div className="briefing-actions"><button className="secondary-action" onClick={onClose}>Not now</button><button className="primary-action" disabled={starting} onClick={onBegin}>{starting ? "Preparing exam…" : active ? "Resume timed exam" : "Start timed exam"} <ArrowIcon /></button></div><small className="timer-warning">{active ? "Your existing timer is already running." : "The timer begins only after you press Start timed exam."}</small></section></div>;
}

function HistoryList({ items, emptyText }: { items: HistoryItem[]; emptyText: string }) {
  if (!items.length) return <div className="empty-list"><HistoryIcon /><p>{emptyText}</p></div>;
  return <div className="history-list">{items.map((item) => <article className="history-row" key={item.id}><div className={`history-skill ${item.skill}`}>{item.skill === "listening" ? <HeadphonesIcon /> : <BookIcon />}</div><div className="history-main"><strong>{item.title}</strong><span>{formatDate(item.started_at)} · {item.skill}</span></div><span className={`status-chip ${item.status}`}>{statusLabel(item.status)}</span><div className="history-score"><strong>{item.status === "scored" ? item.band_score?.toFixed(1) : "—"}</strong><span>{item.status === "scored" ? `Band · ${item.raw_score}/${item.question_count}` : "Band"}</span></div></article>)}</div>;
}

function SkillCard({ skill, data }: { skill: string; data?: SkillProgress }) {
  const accuracy = data?.total_questions ? Math.round((data.correct_answers / data.total_questions) * 100) : 0;
  return <article className={`skill-card ${skill}`}><div className="skill-card-heading"><div>{skill === "listening" ? <HeadphonesIcon /> : <BookIcon />}</div><span>{skill}</span></div>{data ? <><div className="skill-band"><strong>{data.latest_band.toFixed(1)}</strong><span>Latest band</span></div><div className="skill-stats"><div><strong>{data.average_band.toFixed(1)}</strong><span>Average</span></div><div><strong>{data.best_band.toFixed(1)}</strong><span>Best</span></div><div><strong>{data.completed_attempts}</strong><span>Attempts</span></div></div><div className="accuracy-label"><span>Answer accuracy</span><strong>{accuracy}%</strong></div><div className="bar"><span style={{ width: `${accuracy}%` }} /></div></> : <div className="skill-no-data"><strong>No baseline yet</strong><p>Complete a {skill} mock to unlock this analysis.</p></div>}</article>;
}

function Metric({ label, value, hint }: { label: string; value: string; hint: string }) { return <article className="metric-card"><span>{label}</span><strong>{value}</strong><small>{hint}</small></article>; }
function PageHeader({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) { return <header className="page-header"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{copy}</p></header>; }
function SectionHeading({ eyebrow, title, action, onAction }: { eyebrow: string; title: string; action?: string; onAction?: () => void }) { return <div className="section-heading"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div>{action && <button onClick={onAction}>{action} <ArrowIcon /></button>}</div>; }
function NavButton({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: ReactNode; children: ReactNode }) { return <button className={`nav-item ${active ? "active" : ""}`} aria-current={active ? "page" : undefined} onClick={onClick}>{icon}<span>{children}</span></button>; }
function CardSkeletons({ count = 2 }: { count?: number }) { return <div className="skeleton-grid" aria-label="Loading exams">{Array.from({ length: count }, (_, index) => <div className="skeleton-card" key={index}><i/><i/><i/></div>)}</div>; }
function ListSkeleton() { return <div className="list-skeleton" aria-label="Loading activity"><i/><i/><i/></div>; }
function EmptyExams({ onAction }: { onAction?: () => void }) { return <div className="empty-state"><BookIcon /><h2>No published exams yet</h2><p>Reading and Listening mocks will appear here as soon as they are published.</p>{onAction && <button onClick={onAction}>Open exam library</button>}</div>; }

function viewFromHash(): View { const value = window.location.hash.replace("#", ""); return value === "practice" || value === "exams" || value === "review" || value === "progress" ? value : "dashboard"; }
function initialsFor(name: string) { return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "U"; }
function minutes(seconds: number) { return Math.max(1, Math.round(seconds / 60)); }
function weakestSkill(progress: SkillProgress[]) { if (!progress.length) return "reading"; return [...progress].sort((a, b) => a.average_band - b.average_band)[0].skill; }
function formatDate(value: string) { return new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value)); }
function statusLabel(status: string) { return ({ in_progress: "In progress", scored: "Completed", expired: "Expired", submitted: "Submitted" } as Record<string, string>)[status] || status; }
function messageFor(error: unknown, fallback: string) { return error instanceof Error ? error.message : fallback; }
