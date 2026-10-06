import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { User } from "./auth";
import { Exam, ExamSummary, examAPI, HistoryItem, SkillProgress, StudyPlan } from "./exams";
import { ArrowIcon, BookIcon, CalendarIcon, ChartIcon, CheckIcon, ClockIcon, FlameIcon, GridIcon, HeadphonesIcon, HistoryIcon, RefreshIcon, ReviewIcon, TargetIcon } from "./icons";
import PracticePage from "./PracticePage";
import ReviewPage from "./ReviewPage";
import StudyPlanPage from "./StudyPlanPage";
import NotebookPage from "./NotebookPage";
import ReminderSettings from "./ReminderSettings";
import ExplorePage from "./ExplorePage";
import WritingPage from "./WritingPage";

type View = "dashboard" | "plan" | "practice" | "exams" | "review" | "progress" | "notebook" | "explore" | "writing";
type Props = { user: User; onLogout: () => Promise<void>; onStartExam: (exam: Exam) => Promise<void> };

const viewLabels: Record<View, string> = { dashboard: "Home", plan: "Study plan", practice: "Practice", exams: "Mock exams", review: "Review", progress: "Progress", notebook: "Notebook", explore:"Explore", writing:"Writing" };

export default function StudentApp({ user, onLogout, onStartExam }: Props) {
  const [view, setView] = useState<View>(() => viewFromHash());
  const [exams, setExams] = useState<ExamSummary[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [progress, setProgress] = useState<SkillProgress[]>([]);
  const [studyPlan, setStudyPlan] = useState<StudyPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState("");
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [writingDirty, setWritingDirty] = useState(false);
  const [practicePreset, setPracticePreset] = useState<{ skill: "reading" | "listening"; questionType: string; autoStart:boolean } | null>(null);
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
      const [examList, attempts, skills, plan] = await Promise.all([examAPI.list(), examAPI.history(50), examAPI.progress(), examAPI.studyPlan()]);
      setExams(examList);
      setHistory(attempts);
      setProgress(skills);
      setStudyPlan(plan);
    } catch (error) {
      setDataError(messageFor(error, "Your study data could not be loaded."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadData(); }, []);

  function navigate(next: View) {
    if(view === "writing" && next !== "writing" && writingDirty && !window.confirm("Discard unsaved writing changes? Save your draft first to keep them.")) return;
    window.location.hash = next;
    setView(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openPractice(skill: "reading" | "listening" = "reading", questionType = "", autoStart=false) {
    setPracticePreset({ skill, questionType, autoStart });
    navigate("practice");
  }

  async function refreshStudyPlan() {
    setStudyPlan(await examAPI.studyPlan());
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
        <NavButton active={view === "explore"} onClick={() => navigate("explore")} icon={<FlameIcon />}>Explore</NavButton>
        <NavButton active={view === "notebook"} onClick={() => navigate("notebook")} icon={<ReviewIcon />}>Mistake notebook</NavButton>
        <NavButton active={view === "dashboard"} onClick={() => navigate("dashboard")} icon={<GridIcon />}>Dashboard</NavButton>
        <NavButton active={view === "plan"} onClick={() => navigate("plan")} icon={<CalendarIcon />}>Study plan</NavButton>
        <NavButton active={view === "practice"} onClick={() => openPractice()} icon={<TargetIcon />}>Practice</NavButton>
        <NavButton active={view === "writing"} onClick={() => navigate("writing")} icon={<ReviewIcon />}>Writing</NavButton>
        <NavButton active={view === "exams"} onClick={() => navigate("exams")} icon={<BookIcon />}>Mock exams</NavButton>
        <NavButton active={view === "review"} onClick={() => navigate("review")} icon={<ReviewIcon />}>Review</NavButton>
        <NavButton active={view === "progress"} onClick={() => navigate("progress")} icon={<ChartIcon />}>Progress</NavButton>
      </nav>
      <div className="sidebar-help"><span className="sidebar-help-icon">?</span><div><strong>Need a starting point?</strong><p>Choose one skill and complete a full mock. Your plan updates from the result.</p></div></div>
      <div className="sidebar-footer">
        <button className="profile-trigger" aria-label="Open profile" onClick={() => setProfileOpen(true)}>
          {user.avatar_url ? <img className="avatar" src={user.avatar_url} alt="" /> : <span className="avatar">{initials}</span>}
          <span className="profile-copy"><strong>{user.display_name}</strong><span>Student</span></span>
        </button>
        <button className="logout-button" aria-label="Sign out" title="Sign out" onClick={() => void onLogout()}>↗</button>
      </div>
    </aside>

    <main className="student-main">
      <header className="mobile-header">
        <button className="brand brand-button" onClick={() => navigate("dashboard")}><span className="brand-mark">M</span><span>mock.ai</span></button>
        <div className="mobile-title">{viewLabels[view]}</div>
        <button aria-label="Open profile" className="avatar small" onClick={() => setProfileOpen(true)}>{user.avatar_url ? <img src={user.avatar_url} alt="" /> : initials}</button>
      </header>

      {dataError && <div className="global-notice error" role="alert"><span>{dataError}</span><button onClick={() => void loadData()}><RefreshIcon /> Try again</button></div>}

      {view === "dashboard" && <DashboardPage user={user} exams={exams} recent={history.slice(0, 4)} progress={progress} plan={studyPlan} active={active} averageBand={averageBand} completedCount={completedCount} loading={loading} opening={opening} onInspect={inspectExam} onViewPlan={() => navigate("plan")} onViewPractice={() => studyPlan ? openPractice(studyPlan.recommendation.skill, studyPlan.recommendation.question_type,true) : openPractice("reading","",true)} onViewExams={() => navigate("exams")} onViewReview={() => navigate("review")} onViewProgress={() => navigate("progress")} />}
      {view === "plan" && <StudyPlanPage plan={studyPlan} loading={loading} onRefresh={refreshStudyPlan} onPractice={openPractice} onReview={() => navigate("review")} onExams={() => navigate("exams")} />}
      {view === "practice" && <PracticePage autoStart={practicePreset?.autoStart} onNotebook={() => navigate("notebook")} onOpenWriting={() => navigate("writing")} onOpenExams={() => navigate("exams")} initialSkill={practicePreset?.skill} initialQuestionType={practicePreset?.questionType} onActivity={() => { void refreshStudyPlan().catch(() => undefined); }} />}
      {view === "notebook" && <NotebookPage/>}
      {view === "writing" && <WritingPage onDirtyChange={setWritingDirty}/>}
      {view === "dashboard" && <div className="content explore-home-link"><button onClick={()=>navigate("writing")}><ReviewIcon/><span><strong>Find the next step for your essay</strong><small>Writing Task 2 · AI feedback, estimated bands and a revision plan</small></span><ArrowIcon/></button></div>}
      {view === "explore" && <ExplorePage onPractice={() => openPractice("reading","",true)} onExams={() => navigate("exams")}/>}
      {view === "dashboard" && <div className="content explore-home-link"><button onClick={()=>navigate("explore")}><FlameIcon/><span><strong>A little challenge?</strong><small>Daily goals, achievements, word games & weekly leaderboard</small></span><ArrowIcon/></button></div>}
      {view === "review" && <div className="notebook-shortcut"><button className="primary-action" onClick={()=>navigate("notebook")}>Open mistake notebook →</button></div>}
      {view === "exams" && <ExamsPage exams={exams} history={history} loading={loading} opening={opening} onInspect={inspectExam} />}
      {view === "review" && <ReviewPage history={history} loading={loading} onOpenExams={() => navigate("exams")} onOpenPractice={() => openPractice()} onActivity={() => { void refreshStudyPlan().catch(() => undefined); }} />}
      {view === "progress" && <ProgressPage progress={progress} history={history} completed={completed} loading={loading} onFindExam={() => navigate("exams")} />}

      <nav className="bottom-nav" aria-label="Mobile navigation">
        <NavButton active={view === "dashboard"} onClick={() => navigate("dashboard")} icon={<GridIcon />}>Home</NavButton>
        <NavButton active={view === "practice"} onClick={() => navigate("practice")} icon={<TargetIcon />}>Practice</NavButton>
        <NavButton active={view === "writing"} onClick={() => navigate("writing")} icon={<ReviewIcon />}>Writing</NavButton>
        <NavButton active={view === "exams"} onClick={() => navigate("exams")} icon={<BookIcon />}>Exams</NavButton>
        <NavButton active={view === "review"} onClick={() => navigate("review")} icon={<ReviewIcon />}>Review</NavButton>
        <NavButton active={view === "explore"} onClick={() => navigate("explore")} icon={<FlameIcon />}>Explore</NavButton>
      </nav>
    </main>

    {selectedExam && <ExamBriefing exam={selectedExam} active={history.some((item) => item.status === "in_progress" && item.title === selectedExam.title)} starting={starting} onClose={() => setSelectedExam(null)} onBegin={() => void beginExam()} />}
    {profileOpen && <ProfilePanel user={user} initials={initials} onClose={() => setProfileOpen(false)} onNavigate={(next) => { setProfileOpen(false); navigate(next); }} onLogout={onLogout} />}
  </div>;
}

function ProfilePanel({ user, initials, onClose, onNavigate, onLogout }: { user: User; initials: string; onClose: () => void; onNavigate: (view: View) => void; onLogout: () => Promise<void> }) {
  const telegram = Boolean(window.Telegram?.WebApp?.initData);
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return <div className="profile-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="account-panel" role="dialog" aria-modal="true" aria-labelledby="profile-title">
      <button className="account-close" aria-label="Close profile" onClick={onClose}>×</button>
      <div className="account-identity">
        {user.avatar_url ? <img className="account-avatar" src={user.avatar_url} alt="" /> : <div className="account-avatar">{initials}</div>}
        <div><p className="eyebrow">Your account</p><h2 id="profile-title">{user.display_name}</h2><span>{user.email || (telegram ? "Connected with Telegram" : "Student account")}</span></div>
      </div>
      <div className="account-status"><span className="status-dot" /><div><strong>{telegram ? "Telegram connected" : "Account ready"}</strong><p>{telegram ? "You’ll be signed in automatically whenever you open MockAI from the bot." : "Your progress is saved securely to this account."}</p></div></div>
      <div className="account-links">
        <button onClick={() => onNavigate("writing")}><span><ReviewIcon /></span><div><strong>Writing</strong><small>Essays, estimated scores and feedback</small></div><ArrowIcon /></button>
        <button onClick={() => onNavigate("explore")}><span><FlameIcon /></span><div><strong>Explore</strong><small>Challenges, games and leaderboard</small></div><ArrowIcon /></button>
        <button onClick={() => onNavigate("notebook")}><span><ReviewIcon /></span><div><strong>Mistake notebook</strong><small>Retry and resolve missed answers</small></div><ArrowIcon /></button>
        <button onClick={() => onNavigate("plan")}><span><CalendarIcon /></span><div><strong>Study plan</strong><small>Goals, daily tasks and streak</small></div><ArrowIcon /></button>
        <button onClick={() => onNavigate("progress")}><span><ChartIcon /></span><div><strong>Progress</strong><small>Bands, accuracy and history</small></div><ArrowIcon /></button>
      </div>
      <ReminderSettings/>
      <button className="account-signout" onClick={() => void onLogout()}>Sign out of this session</button>
    </section>
  </div>;
}

function DashboardPage({ user, exams, recent, progress, plan, active, averageBand, completedCount, loading, opening, onInspect, onViewPlan, onViewPractice, onViewExams, onViewReview, onViewProgress }: {
  user: User; exams: ExamSummary[]; recent: HistoryItem[]; progress: SkillProgress[]; plan: StudyPlan | null; active?: HistoryItem;
  averageBand: number | null; completedCount: number; loading: boolean; opening: string | null;
  onInspect: (id: string) => Promise<void>; onViewPlan: () => void; onViewPractice: () => void; onViewExams: () => void; onViewReview: () => void; onViewProgress: () => void;
}) {
  const firstName = user.display_name.trim().split(/\s+/)[0] || "there";
  const date = new Intl.DateTimeFormat("en", { weekday: "long", day: "numeric", month: "long" }).format(new Date());

  return <div className="content page-content">
    <section className="dashboard-hero useful-home">
      <div><p className="eyebrow">{date}</p><h1>Let’s practise, {firstName}</h1><p className="hero-copy">One small session. One clear step forward.</p><div className="next-activity"><span className="eyebrow">Your recommended activity</span><h2>{plan?.recommendation.skill === "listening" ? "Listening" : "Reading"} · up to 5 questions</h2><p>About 8 minutes · {plan?.recommendation.question_type.replaceAll("_"," ") || "mixed practice"}</p><button className="primary-action" onClick={onViewPractice}>Start focused practice <ArrowIcon /></button></div></div>
      {averageBand===null?<div className="first-test-card"><BookIcon/><h2>Find your starting point</h2><p>Take your first timed mock to see your current score and build your personal progress history.</p><button className="secondary-action" onClick={onViewExams}>Choose my first mock <ArrowIcon/></button></div>:<div className="band-card"><span>Overall average</span><strong>{averageBand.toFixed(1)}</strong><small>Based on {completedCount} completed exams</small><button className="secondary-action" onClick={onViewProgress}>See my progress</button></div>}
    </section>

    <section className="home-library"><div className="section-heading"><h2>Ready when you are</h2><button onClick={onViewExams}>All exams <ArrowIcon/></button></div>{loading?<p>Loading exams…</p>:<div className="home-exam-strip">{exams.slice(0,3).map(e=><button key={e.id} disabled={opening===e.id} onClick={()=>void onInspect(e.id)}><span className="eyebrow">{e.skill} · {minutes(e.duration_seconds)} min</span><strong>{e.title}</strong><span>{e.question_count} questions · View exam →</span></button>)}</div>}</section>

    {plan && <section className="home-plan-card"><div className="home-plan-heading"><div className="home-plan-icon"><CalendarIcon /></div><div><p className="eyebrow">Your study plan</p><h2>{plan.profile.exam_date ? `${daysUntil(plan.profile.exam_date)} days to Band ${plan.profile.target_band.toFixed(1)}` : `Build toward Band ${plan.profile.target_band.toFixed(1)}`}</h2><p>{plan.recommendation.reason}</p></div></div><div className="home-plan-stats"><span><FlameIcon /><strong>{plan.streak_days}</strong> day streak</span><span><TargetIcon /><strong>{plan.practice_today}/5</strong> practice today</span><span><ClockIcon /><strong>{plan.estimated_minutes_today}/{plan.profile.daily_goal_minutes}</strong> minutes</span></div><button onClick={onViewPlan}>Open today’s plan <ArrowIcon /></button></section>}

    {active && <section className="resume-banner"><div className="resume-icon"><ClockIcon /></div><div><p className="eyebrow">In progress</p><h2>Continue {active.title}</h2><p>Your saved answers are waiting. The server timer continues from your original start.</p></div>{exams.find((exam) => exam.title === active.title) && <button onClick={() => void onInspect(exams.find((exam) => exam.title === active.title)!.id)}>Resume exam <ArrowIcon /></button>}</section>}

    {recent.length>0&&<section className="section compact-section"><SectionHeading eyebrow="Activity" title="Recent attempts" action="Full progress" onAction={onViewProgress} /><HistoryList items={recent} emptyText="Your completed and active exams will appear here." /></section>}
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

function viewFromHash(): View { const value = window.location.hash.replace("#", ""); return value === "plan" || value === "practice" || value === "exams" || value === "review" || value === "progress" || value === "notebook" || value === "explore" || value === "writing" ? value : "dashboard"; }
function initialsFor(name: string) { return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "U"; }
function minutes(seconds: number) { return Math.max(1, Math.round(seconds / 60)); }
function weakestSkill(progress: SkillProgress[]) { if (!progress.length) return "reading"; return [...progress].sort((a, b) => a.average_band - b.average_band)[0].skill; }
function formatDate(value: string) { return new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value)); }
function statusLabel(status: string) { return ({ in_progress: "In progress", scored: "Completed", expired: "Expired", submitted: "Submitted" } as Record<string, string>)[status] || status; }
function messageFor(error: unknown, fallback: string) { return error instanceof Error ? error.message : fallback; }
function daysUntil(value: string) { const today = new Date(); today.setHours(0, 0, 0, 0); return Math.max(0, Math.ceil((new Date(`${value}T00:00:00`).getTime() - today.getTime()) / 86400000)); }
