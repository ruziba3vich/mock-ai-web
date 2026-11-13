import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { User } from "./auth";
import { Exam, ExamSummary, examAPI, HistoryItem, SkillProgress, StudyPlan } from "./exams";
import { ArrowIcon, BookIcon, CalendarIcon, ChartIcon, CheckIcon, ClockIcon, FlameIcon, HeadphonesIcon, HistoryIcon, HomeIcon, LogoutIcon, MockIcon, NotebookIcon, PracticeIcon, RefreshIcon, ReviewIcon, StarIcon, TargetIcon } from "./icons";
import Wordmark from "./Wordmark";
import { prefersReducedMotion, RevealText, Roll, stagger, useEntrance, viewTransition } from "./motion";
import StarsPage, { SpendStarDialog } from "./StarsPage";
import { DEFAULT_COSTS, newSpendReference, starsAPI, StarsOverview } from "./stars";
import { APIError } from "./auth";
import PracticePage from "./PracticePage";
import ReviewPage from "./ReviewPage";
import StudyPlanPage from "./StudyPlanPage";
import NotebookPage from "./NotebookPage";
import ReminderSettings from "./ReminderSettings";
import TelegramResults from "./TelegramResults";
import ExplorePage from "./ExplorePage";
import WritingPage from "./WritingPage";
import SpeakingPage from "./SpeakingPage";
import { MicIcon } from "./icons";
import { managedContentAPI, ManagedContent } from "./managedContent";
import Poster, { posterSkill, posterTitle } from "./Poster";
import { examSetKey } from "./fullMock";

type View = "dashboard" | "plan" | "practice" | "exams" | "review" | "progress" | "notebook" | "explore" | "writing" | "speaking" | "stars";
type Props = { user: User; onLogout: () => Promise<void>; onStartExam: (exam: Exam) => Promise<void>; onStartFullMock?: (listeningID:string,readingID:string,paidReference:string,setKey?:string)=>void };

// A followed invite link (/?mock=<listening paper id>) waits here through sign-in, which can leave the tab.
const INVITE = "mockai.invite";
const invited = new URLSearchParams(window.location.search).get("mock");
if (invited) localStorage.setItem(INVITE, invited);

const viewLabels: Record<View, string> = { dashboard: "Home", plan: "Study plan", practice: "Practice", exams: "Mock exams", review: "Review", progress: "Progress", notebook: "Notebook", explore:"Explore", writing:"Writing", speaking:"Speaking", stars:"Stars" };

export default function StudentApp({ user, onLogout, onStartExam, onStartFullMock=()=>undefined }: Props) {
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
  const [speakingDirty, setSpeakingDirty] = useState(false);
  const [writingContent,setWritingContent]=useState<ManagedContent[]>([]);
  const [speakingContent,setSpeakingContent]=useState<ManagedContent[]>([]);
  const [selectedWritingContent,setSelectedWritingContent]=useState<string>();
  const [selectedSpeakingContent,setSelectedSpeakingContent]=useState<string>();
  const [stars, setStars] = useState<StarsOverview | null>(null);
  const [outOfStars, setOutOfStars] = useState(false);
  const [pendingMock, setPendingMock] = useState<{ listeningID: string; readingID: string; setKey?: string; reference: string } | null>(null);
  const [spending, setSpending] = useState(false);
  const [spendError, setSpendError] = useState("");
  const refreshStars = useCallback(async () => { try { setStars(await starsAPI.overview()); } catch { /* the balance chip just stays hidden */ } }, []);
  useEffect(() => { void refreshStars(); }, [refreshStars]);

  // A full mock spends a star, so ask first; with none left, go buy more.
  async function requestFullMock(listeningID: string, readingID: string, setKey?: string) {
    const current = stars ?? await starsAPI.overview().catch(() => null);
    if (!current) { setDataError("Your stars could not be loaded, so the mock cannot start yet. Please try again."); return; }
    setStars(current);
    if (current.balance < current.full_mock_cost) { setOutOfStars(true); navigate("stars"); return; }
    setSpendError("");
    setPendingMock({ listeningID, readingID, setKey, reference: newSpendReference() });
  }
  async function confirmFullMock() {
    if (!pendingMock) return;
    setSpending(true); setSpendError("");
    try {
      const { balance } = await starsAPI.spendOnFullMock(pendingMock.reference);
      setStars((s) => s ? { ...s, balance } : s);
      const { listeningID, readingID, setKey, reference } = pendingMock;
      setPendingMock(null);
      onStartFullMock(listeningID, readingID, reference, setKey);
    } catch (error) {
      if (error instanceof APIError && error.status === 402) { setPendingMock(null); setOutOfStars(true); void refreshStars(); navigate("stars"); }
      else setSpendError(messageFor(error, "The mock could not be started. Please try again."));
    } finally { setSpending(false); }
  }
  const [selectedSpeakingPart,setSelectedSpeakingPart]=useState<number>();
  const [practicePreset, setPracticePreset] = useState<{ skill: "reading" | "listening"; questionType: string; autoStart:boolean } | null>(null);
  const initials = initialsFor(user.display_name);

  useEffect(() => {
    const onHashChange = () => {
      const next=viewFromHash();
      if(next!==view && view==="speaking" && speakingDirty && !window.confirm("Leave this answer? Your unsaved recording will be lost; earlier answers are saved.")){window.history.replaceState(null,"",`#${view}`);return;}
      setView(next);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [view,speakingDirty]);

  async function loadData() {
    setLoading(true);
    setDataError("");
    try {
      const [examList, attempts, skills, plan,writingItems,speakingItems] = await Promise.all([examAPI.list(), examAPI.history(50), examAPI.progress(), examAPI.studyPlan(),managedContentAPI.studentList("writing_prompt").catch(()=>[]),managedContentAPI.studentList("speaking_plan").catch(()=>[])]);
      setExams(examList);
      const invite = localStorage.getItem(INVITE);
      if (invite) {
        localStorage.removeItem(INVITE);
        // Drop ?mock= so a reload does not ask again, and land on the list either way.
        window.history.replaceState(null, "", `${window.location.pathname}#exams`); setView("exams");
        const mock = mockSets(examList).find(m => m.listening.id === invite);
        if (mock) void requestFullMock(mock.listening.id, mock.reading.id, mock.key);
        else setDataError("That mock exam is not available to your account. Choose another one below.");
      }
      setHistory(attempts);
      setProgress(skills);
      setStudyPlan(plan);
      setWritingContent(writingItems);
      setSpeakingContent(speakingItems);
    } catch (error) {
      setDataError(messageFor(error, "Your study data could not be loaded."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadData(); }, []);

  function navigate(next: View) {
    if(view === "speaking" && next !== "speaking" && speakingDirty && !window.confirm("Leave this answer? Your unsaved recording will be lost; earlier answers are saved.")) return;
    if(view === "writing" && next !== "writing" && writingDirty && !window.confirm("Discard unsaved writing changes? Save your draft first to keep them.")) return;
    // hash inside the update, so the snapshot is taken before anything renders
    viewTransition(() => { window.location.hash = next; setView(next); });
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }

  function openPractice(skill: "reading" | "listening" = "reading", questionType = "", autoStart=false) {
    setPracticePreset({ skill, questionType, autoStart });
    navigate("practice");
  }

  function openWriting(contentID?:string){setSelectedWritingContent(contentID);navigate("writing")}
  function openSpeaking(contentID?:string,part?:number){setSelectedSpeakingContent(contentID);setSelectedSpeakingPart(part);navigate("speaking")}

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

  const profileLine = studyPlan
    ? `Target ${studyPlan.profile.target_band.toFixed(1)}${studyPlan.profile.exam_date ? `, exam ${new Date(`${studyPlan.profile.exam_date}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : ""}`
    : "Student";

  return <div className="app-shell">
    <aside className="sidebar">
      <button className="brand-button" onClick={() => navigate("dashboard")} aria-label="mock-ai dashboard"><Wordmark /></button>
      <nav aria-label="Main navigation">
        <NavButton active={view === "dashboard"} onClick={() => navigate("dashboard")} icon={<HomeIcon />}>Dashboard</NavButton>
        <NavButton active={view === "practice"} onClick={() => openPractice()} icon={<PracticeIcon />}>Practice</NavButton>
        <NavButton active={view === "exams"} onClick={() => navigate("exams")} icon={<MockIcon />}>Mock exams</NavButton>
        <NavButton active={view === "notebook"} onClick={() => navigate("notebook")} icon={<NotebookIcon />}>Mistake notebook</NavButton>
        <NavButton active={view === "plan"} onClick={() => navigate("plan")} icon={<CalendarIcon />}>Study plan</NavButton>
        <NavButton active={view === "progress"} onClick={() => navigate("progress")} icon={<ChartIcon />}>Progress</NavButton>
        <NavButton active={view === "review"} onClick={() => navigate("review")} icon={<ReviewIcon />}>Review</NavButton>
        <NavButton active={view === "explore"} onClick={() => navigate("explore")} icon={<FlameIcon />}>Explore</NavButton>
        <NavButton active={view === "stars"} onClick={() => navigate("stars")} icon={<StarIcon />}>Stars{stars && <b className="nav-count" aria-label={`${stars.balance} stars`}>{stars.balance}</b>}</NavButton>
      </nav>
      <div className="sidebar-footer">
        <button className="profile-trigger" aria-label="Open profile" onClick={() => setProfileOpen(true)}>
          {user.avatar_url ? <img className="avatar" src={user.avatar_url} alt="" /> : <span className="avatar">{initials}</span>}
          <span className="profile-copy"><strong>{user.display_name}</strong><span>{profileLine}</span></span>
        </button>
        <button className="logout-button" aria-label="Sign out" title="Sign out" onClick={() => void onLogout()}><LogoutIcon /></button>
      </div>
    </aside>

    <main className="student-main">
      <header className="mobile-header">
        <button className="brand-button" onClick={() => navigate("dashboard")} aria-label="mock-ai dashboard"><Wordmark /></button>
        <div className="mobile-title">{viewLabels[view]}</div>
        {stars && <button className="star-chip" onClick={() => navigate("stars")} aria-label={`${stars.balance} stars, get more`}><StarIcon />{stars.balance}</button>}
        <button aria-label="Open profile" className="avatar small" onClick={() => setProfileOpen(true)}>{user.avatar_url ? <img src={user.avatar_url} alt="" /> : initials}</button>
      </header>

      {dataError && <div className="global-notice error" role="alert"><span>{dataError}</span><button onClick={() => void loadData()}><RefreshIcon /> Try again</button></div>}

      {view === "dashboard" && <DashboardPage user={user} exams={exams} recent={history.slice(0, 4)} progress={progress} plan={studyPlan} active={active} averageBand={averageBand} completedCount={completedCount} loading={loading} opening={opening} onInspect={inspectExam} onViewPlan={() => navigate("plan")} onViewPractice={() => studyPlan ? openPractice(studyPlan.recommendation.skill, studyPlan.recommendation.question_type,true) : openPractice("reading","",true)} onViewExams={() => navigate("exams")} onViewReview={() => navigate("review")} onViewProgress={() => navigate("progress")} />}
      {view === "plan" && <StudyPlanPage plan={studyPlan} loading={loading} onRefresh={refreshStudyPlan} onPractice={openPractice} onReview={() => navigate("review")} onExams={() => navigate("exams")} />}
      {view === "practice" && <PracticePage autoStart={practicePreset?.autoStart} onNotebook={() => navigate("notebook")} onOpenSpeaking={openSpeaking} onOpenWriting={openWriting} initialSkill={practicePreset?.skill} initialQuestionType={practicePreset?.questionType} onActivity={() => { void refreshStudyPlan().catch(() => undefined); }} exams={exams} history={history} examsLoading={loading} opening={opening} onInspect={inspectExam} writingContent={writingContent} speakingContent={speakingContent} />}
      {view === "notebook" && <NotebookPage/>}
      {view === "writing" && <WritingPage
        onDirtyChange={setWritingDirty}
        credits={stars ? { balance: stars.balance, cost: stars.costs?.writing ?? DEFAULT_COSTS.writing, centreName: stars.source === "centre" ? stars.centre_name || "Your centre" : undefined, onUsed: () => void refreshStars(), onBuy: () => navigate("stars") } : undefined}
        initialContentID={selectedWritingContent}
      />}
      {view === "speaking" && <SpeakingPage
        onDirtyChange={setSpeakingDirty}
        credits={stars ? { balance: stars.balance, cost: stars.costs?.speaking ?? DEFAULT_COSTS.speaking, centreName: stars.source === "centre" ? stars.centre_name || "Your centre" : undefined, onUsed: () => void refreshStars(), onBuy: () => navigate("stars") } : undefined}
        planID={selectedSpeakingContent}
        part={selectedSpeakingPart}
      />}
      {view === "explore" && <ExplorePage onPractice={() => openPractice("reading","",true)} onExams={() => navigate("exams")}/>}
      {view === "exams" && <ExamsPage exams={exams} loading={loading} stars={stars} onStartFullMock={(l, r, key) => void requestFullMock(l, r, key)} />}
      {view === "stars" && <StarsPage overview={stars} outOfStars={outOfStars} onRefresh={refreshStars} onStartMock={() => { setOutOfStars(false); navigate("exams"); }} />}
      {view === "review" && <ReviewPage history={history} loading={loading} onOpenExams={() => navigate("exams")} onOpenPractice={() => openPractice()} onOpenNotebook={() => navigate("notebook")} onActivity={() => { void refreshStudyPlan().catch(() => undefined); }} />}
      {view === "progress" && <ProgressPage progress={progress} history={history} completed={completed} loading={loading} target={studyPlan?.profile.target_band} onFindExam={() => navigate("exams")} />}

      <nav className="bottom-nav" aria-label="Mobile navigation">
        <NavButton active={view === "dashboard"} onClick={() => navigate("dashboard")} icon={<HomeIcon />}>Home</NavButton>
        <NavButton active={view === "practice"} onClick={() => navigate("practice")} icon={<PracticeIcon />}>Practice</NavButton>
        <NavButton active={view === "exams"} onClick={() => navigate("exams")} icon={<MockIcon />}>Exams</NavButton>
        <NavButton active={view === "review"} onClick={() => navigate("review")} icon={<ReviewIcon />}>Review</NavButton>
        <NavButton active={view === "explore"} onClick={() => navigate("explore")} icon={<FlameIcon />}>Explore</NavButton>
      </nav>
    </main>

    {pendingMock && stars && <SpendStarDialog balance={stars.balance} cost={stars.full_mock_cost} centreName={stars.source === "centre" ? stars.centre_name || "your centre" : undefined} busy={spending} error={spendError} onConfirm={() => void confirmFullMock()} onCancel={() => setPendingMock(null)} />}
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
        <div><h2 id="profile-title">{user.display_name}</h2><span>{user.email || (telegram ? "Connected with Telegram" : "Student account")}</span></div>
      </div>
      <div className="account-status"><span className="status-dot" /><div><strong>{telegram ? "Telegram connected" : "Account ready"}</strong><p>{telegram ? "You’ll be signed in automatically whenever you open MockAI from the bot." : "Your progress is saved securely to this account."}</p></div></div>
      <div className="account-links">
        <button onClick={() => onNavigate("writing")}><span><ReviewIcon /></span><div><strong>Writing</strong><small>Essays, estimated scores and feedback</small></div><ArrowIcon /></button>
        <button onClick={() => onNavigate("speaking")}><span><MicIcon /></span><div><strong>Speaking</strong><small>Interviews, recordings and feedback</small></div><ArrowIcon /></button>
        <button onClick={() => onNavigate("explore")}><span><FlameIcon /></span><div><strong>Explore</strong><small>Challenges, games and leaderboard</small></div><ArrowIcon /></button>
        <button onClick={() => onNavigate("notebook")}><span><ReviewIcon /></span><div><strong>Mistake notebook</strong><small>Retry and resolve missed answers</small></div><ArrowIcon /></button>
        <button onClick={() => onNavigate("plan")}><span><CalendarIcon /></span><div><strong>Study plan</strong><small>Goals, daily tasks and streak</small></div><ArrowIcon /></button>
        <button onClick={() => onNavigate("progress")}><span><ChartIcon /></span><div><strong>Progress</strong><small>Bands, accuracy and history</small></div><ArrowIcon /></button>
      </div>
      <TelegramResults/>
      <ReminderSettings/>
      <button className="account-signout" onClick={() => void onLogout()}>Sign out of this session</button>
    </section>
  </div>;
}

function DashboardPage({ user, exams, recent, progress, plan, active, averageBand, completedCount, loading, opening, onInspect, onViewPlan, onViewPractice, onViewExams, onViewProgress }: {
  user: User; exams: ExamSummary[]; recent: HistoryItem[]; progress: SkillProgress[]; plan: StudyPlan | null; active?: HistoryItem;
  averageBand: number | null; completedCount: number; loading: boolean; opening: string | null;
  onInspect: (id: string) => Promise<void>; onViewPlan: () => void; onViewPractice: () => void; onViewExams: () => void; onViewReview: () => void; onViewProgress: () => void;
}) {
  const stage = useRef<HTMLDivElement>(null);
  useEntrance(stage, !loading);
  const [focusID, setFocusID] = useState<string>();
  const firstName = user.display_name.trim().split(/\s+/)[0] || "there";
  const date = new Intl.DateTimeFormat("en", { weekday: "long", day: "numeric", month: "long" }).format(new Date());
  const skill = plan?.recommendation.skill ?? (weakestSkill(progress) === "listening" ? "listening" : "reading");
  const skillName = titleCase(skill);
  const type = plan?.recommendation.question_type.replaceAll("_", " ");
  const focus = !type ? "Mixed practice" : type === "true false not given" ? "True / False / Not given" : type.charAt(0).toUpperCase() + type.slice(1);
  const shelf = (exams.some((exam) => exam.skill === skill) ? exams.filter((exam) => exam.skill === skill) : exams).slice(0, 6);
  const picked = shelf.find((exam) => exam.id === focusID) ?? shelf[0];
  const resume = active && exams.find((exam) => exam.title === active.title);

  return <div ref={stage} className="content page-content home">
    <header className="home-greet"><p className="blurin">{date}</p><RevealText as="h1" text={`Keep building, ${firstName}`} charStep={20} /></header>
    {loading ? <CardSkeletons count={2} /> : <div className="home-grid">
      <section className="home-hero rise" style={stagger(0, 60, 0, 1000)} aria-labelledby="home-next">
        <Poster skill={skill} size="hero" tag="Up next" title={skillName} enter style={stagger(0, 180)} />
        <div className="home-hero-body">
          <h2 id="home-next" className="rise" style={stagger(0, 700)}>{focus}</h2>
          <p className="home-count rise" style={stagger(0, 790)}><span className="chip">Up to 5 questions</span></p>
          {plan && <p className="home-why rise" style={stagger(0, 880)}>{plan.recommendation.reason}</p>}
          {averageBand === null
            ? <div className="home-first rise" style={stagger(0, 1300)}><h3>Find your starting point</h3><p>Take your first timed mock to see your current score and build your personal progress history.</p><button className="btn btn-ghost" onClick={onViewExams}>Choose my first mock <ArrowIcon /></button></div>
            : <BandRail progress={progress} overall={averageBand} target={plan?.profile.target_band} label={`Overall band across ${completedCount} exams`} base={1300} />}
          <div className="home-cta">
            <button className="btn btn-primary rise" style={stagger(0, 2600, 0, 1000)} onClick={onViewPractice}>Start focused practice <ArrowIcon /></button>
            <p className="blurin" style={stagger(0, 2850)}><b>About 8 min</b>{skillName} practice</p>
          </div>
        </div>
      </section>

      <div className="home-side">
        {plan && <section className="home-today rise" style={stagger(0, 2800)} aria-label="Today">
          <p><span><b>{plan.estimated_minutes_today}</b> of {plan.profile.daily_goal_minutes} min today</span><span>{plan.profile.exam_date ? <><b>{daysUntil(plan.profile.exam_date)} days</b> to Band {plan.profile.target_band.toFixed(1)}</> : <>Toward Band {plan.profile.target_band.toFixed(1)}</>}</span></p>
          <div className="home-goal" role="progressbar" aria-label="Daily goal" aria-valuemin={0} aria-valuemax={plan.profile.daily_goal_minutes} aria-valuenow={Math.min(plan.estimated_minutes_today, plan.profile.daily_goal_minutes)}><i className="grow" style={{ ...stagger(0, 3000, 0, 1200), width: `${Math.min(100, (plan.estimated_minutes_today / Math.max(1, plan.profile.daily_goal_minutes)) * 100)}%` }} /></div>
          <div className="home-today-foot"><span className="chip"><FlameIcon />{plan.streak_days}-day streak</span><span className="chip"><TargetIcon />{plan.practice_today}/5 practice</span><button className="home-link" onClick={onViewPlan}>Open today’s plan <ArrowIcon /></button></div>
        </section>}

        {active && <section className="home-continue rise" style={stagger(0, 3000)}><Poster skill={posterSkill(active.skill)} size="sm" title={posterTitle(active.title)} /><div><h2>Continue {active.title}</h2><p>Your saved answers are waiting. The server timer continues from your original start.</p>{resume && <button className="btn btn-ghost" onClick={() => void onInspect(resume.id)}>Resume exam <ArrowIcon /></button>}</div></section>}

        {recent.length > 0 && <section className="home-recent" aria-labelledby="home-recent-title">
          <div className="home-row-h rise" style={stagger(0, 3050)}><h2 id="home-recent-title">Recent attempts</h2><button className="home-link" onClick={onViewProgress}>Full progress <ArrowIcon /></button></div>
          <ol className="home-reel">{recent.map((item, i) => <li key={item.id}><Poster skill={posterSkill(item.skill)} title={posterTitle(item.title)} band={item.status === "scored" ? item.band_score ?? null : null} tag={item.status === "scored" ? undefined : statusLabel(item.status)} enter style={stagger(i, 3150, 80, 900)} /><p className="rise" style={stagger(i, 3350, 80)}><b>{item.title}</b>{formatDate(item.started_at)}{item.status === "scored" && item.band_score != null && <span className="visually-hidden">, band {item.band_score.toFixed(1)}</span>}</p></li>)}</ol>
        </section>}
      </div>

      <section className="home-shelf" aria-labelledby="home-shelf-title">
        <div className="home-row-h rise" style={stagger(0, 2950)}><h2 id="home-shelf-title">Moves your {skillName}</h2><button className="home-link" onClick={onViewExams}>All exams <ArrowIcon /></button></div>
        {shelf.length ? <div className="home-shelf-body">
          <div className="home-shelf-row">{shelf.map((exam, i) => <button key={exam.id} className={`home-tile${exam.id === picked?.id ? " is-focus" : ""}`} aria-label={`${exam.title}, ${minutes(exam.duration_seconds)} minutes, ${exam.question_count} questions`} disabled={opening === exam.id} onMouseEnter={() => setFocusID(exam.id)} onFocus={() => setFocusID(exam.id)} onClick={() => void onInspect(exam.id)}><Poster skill={exam.skill} tag={titleCase(exam.skill)} title={posterTitle(exam.title)} enter style={stagger(i, 3050, 80, 1000)} /></button>)}</div>
          {picked && <div className="home-detail blurin" style={stagger(0, 3450)} aria-live="polite"><h3>{picked.title}</h3><div className="home-facts"><span className="chip"><ClockIcon />{minutes(picked.duration_seconds)} min</span><span className="chip"><CheckIcon />{picked.question_count} questions</span></div><p>{picked.description || "A timed IELTS-style mock with automatic scoring."}</p></div>}
        </div> : <EmptyExams onAction={onViewExams} />}
      </section>
    </div>}
  </div>;
}

function ExamsPage({ exams, loading, stars, onStartFullMock }: { exams: ExamSummary[]; loading: boolean; stars: StarsOverview | null; onStartFullMock:(listeningID:string,readingID:string,setKey?:string)=>void }) {
  const ready=exams.some(exam=>exam.skill==="listening")&&exams.some(exam=>exam.skill==="reading");
  function start(){const selected=pickFullMockPapers(exams);if(selected){const key=examSetKey(selected.listening.title);onStartFullMock(selected.listening.id,selected.reading.id,key===examSetKey(selected.reading.title)?key:undefined)}}
  const mocks=mockSets(exams);
  const [copied,setCopied]=useState("");
  async function share(id:string){
    const link=`${window.location.origin}/?mock=${id}`;
    try{await navigator.clipboard.writeText(link);setCopied(id);window.setTimeout(()=>setCopied(""),2000)}
    catch{window.prompt("Copy this invite link",link)}
  }
  const stage=useRef<HTMLDivElement>(null);
  useEntrance(stage,!loading);
  const papers=(skill:string)=>{const n=exams.filter(exam=>exam.skill===skill).length;return loading?undefined:`${n} paper${n===1?"":"s"}`};
  const skills:["listening"|"reading"|"writing"|"speaking",string,string,string|undefined][]=[["listening","Listening","40 minutes",papers("listening")],["reading","Reading","60 minutes",papers("reading")],["writing","Writing","Task 1 + Task 2 · 60 minutes",undefined],["speaking","Speaking","Live interview",undefined]];
  return <div className="content page-content exams-page" ref={stage}>
    <div className="exams-hero">
      <div className="exams-art"><Poster skill="full" title="Full mock" tag="4 skills" size="hero" enter style={stagger(0,0)}/></div>
      <div className="exams-copy">
        <header className="page-header"><RevealText as="h1" text="Full mock exam" base={300}/><p className="rise" style={stagger(0,900)}>Complete Listening, Reading, Writing and Speaking as one guided IELTS simulation.</p></header>
        <section className="exams-promo full-mock-only rise" style={stagger(0,1200)}><h2>Take a full four-skill mock</h2><p>Experience every IELTS skill in one guided session. Your progress is saved automatically, with time to reset between sections.</p></section>
        <ol className="exams-skills" aria-label="Sections in order">{skills.map(([skill,label,time,tag],i)=><li key={skill} className="rise" style={stagger(i,1500,110)}><Poster skill={skill} title={label} tag={tag} size="md"/><b>{label}</b><small>{time}</small></li>)}</ol>
        <div className="exams-action rise" style={stagger(0,2400,0,1000)}><button className="btn btn-primary" disabled={loading||!ready} onClick={start}>{loading?"Preparing library…":ready?"Start full mock →":"Reading and Listening content required"}</button>{stars && <span className="exams-cost"><StarIcon />Costs {stars.full_mock_cost} star{stars.full_mock_cost === 1 ? "" : "s"} · you have {stars.balance}</span>}</div>
        {mocks.length>0 && <section className="exams-list rise" style={stagger(0,2700)} aria-label="Mock exams">
          <h2>Or choose a mock</h2><p>Each mock has its own link. Anyone who opens it sits the same papers, paid from their own stars or their centre's.</p>
          <ul>{mocks.map(mock=><li key={mock.listening.id}><div><b>{mock.title}</b><small>Listening · Reading · Writing · Speaking</small></div>
            <button className="btn btn-ghost" onClick={()=>void share(mock.listening.id)}>{copied===mock.listening.id?"Link copied":"Copy invite link"}</button>
            <button className="btn btn-primary" aria-label={`Start ${mock.title}`} onClick={()=>onStartFullMock(mock.listening.id,mock.reading.id,mock.key)}>Start</button>
          </li>)}</ul>
        </section>}
      </div>
    </div>
  </div>;
}

/** The named mocks: a Listening paper and the Reading paper that shares its name. */
export function mockSets(exams:ExamSummary[]){
  return exams.filter(exam=>exam.skill==="listening").flatMap(listening=>{
    const key=examSetKey(listening.title),reading=exams.find(exam=>exam.skill==="reading"&&examSetKey(exam.title)===key);
    return reading?[{key,listening,reading,title:listening.title.replace(/\blistening\b/i,"").replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N})]+$/gu,"").replace(/\s{2,}/g," ")||"Full mock"}]:[];
  });
}

export function pickFullMockPapers(exams:ExamSummary[],random:()=>number=Math.random){
  const listening=exams.filter(exam=>exam.skill==="listening"),reading=exams.filter(exam=>exam.skill==="reading");
  if(!listening.length||!reading.length)return null;
  const pairs=listening.flatMap(audio=>reading.filter(paper=>examSetKey(paper.title)===examSetKey(audio.title)).map(paper=>({listening:audio,reading:paper})));
  if(pairs.length)return pairs[Math.floor(random()*pairs.length)];
  return {listening:listening[Math.floor(random()*listening.length)],reading:reading[Math.floor(random()*reading.length)]};
}

function ProgressPage({ progress, history, completed, loading, target, onFindExam }: { progress: SkillProgress[]; history: HistoryItem[]; completed: HistoryItem[]; loading: boolean; target?: number; onFindExam: () => void }) {
  const stage = useRef<HTMLDivElement>(null);
  useEntrance(stage, !loading);
  const total = progress.reduce((sum, item) => sum + item.completed_attempts, 0);
  const best = progress.length ? Math.max(...progress.map((item) => item.best_band)) : null;
  const overall = total ? progress.reduce((sum, item) => sum + item.average_band * item.completed_attempts, 0) / total : 0;
  const totalCorrect = progress.reduce((sum, item) => sum + item.correct_answers, 0);
  const totalQuestions = progress.reduce((sum, item) => sum + item.total_questions, 0);
  const accuracy = totalQuestions ? Math.round((totalCorrect / totalQuestions) * 100) : null;
  return <div ref={stage} className="content page-content progress-page">
    <PageHeader title="Your progress" copy="Use band trends and accuracy together. A higher band shows the outcome; accuracy shows where consistent practice is paying off." />
    {loading ? <CardSkeletons count={3} /> : total === 0 ? <div className="progress-empty"><div className="empty-illustration"><ChartIcon /></div><h2>No results yet</h2><p>Complete your first mock exam and this page will turn it into a clear baseline for Reading and Listening.</p><button className="primary-action" onClick={onFindExam}>Find my first exam <ArrowIcon /></button></div> : <>
      <section className="progress-hero rise" style={stagger(0, 120, 0, 1000)} aria-label="Bands">
        <div className="progress-overall"><span>Overall band</span><strong className="display"><Roll value={halfBand(overall)} from={4} step={0.5} delay={400} duration={1300} /></strong><small>Across {total} scored {total === 1 ? "exam" : "exams"}</small></div>
        <BandRail progress={progress} overall={overall} target={target} label="Bands by skill" base={600} />
        <div className="metric-grid"><Metric label="Completed exams" value={<Roll value={total} delay={700} />} hint="Scored attempts" /><Metric label="Best band" value={best === null ? "—" : <Roll value={best} from={4} step={0.5} delay={700} />} hint="Across both skills" /><Metric label="Overall accuracy" value={accuracy === null ? "—" : <><Roll value={accuracy} delay={700} />%</>} hint={`${Math.round(totalCorrect)} of ${totalQuestions} answers`} /></div>
      </section>
      <section className="section compact-section rise" style={stagger(0, 500)}><SectionHeading title="Reading and Listening" /><div className="skill-grid">{["reading", "listening"].map((skill) => <SkillCard key={skill} skill={skill} data={progress.find((item) => item.skill === skill)} />)}</div></section>
      <section className="section compact-section"><SectionHeading title="Attempt history" /><HistoryList items={history} emptyText="No attempts yet." /></section>{completed.length > 0 && <p className="progress-note">Tip: compare at least three attempts in the same skill before judging a trend.</p>}
    </>}
  </div>;
}

function ExamBriefing({ exam, active, starting, onClose, onBegin }: { exam: Exam; active: boolean; starting: boolean; onClose: () => void; onBegin: () => void }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="exam-briefing" role="dialog" aria-modal="true" aria-labelledby="briefing-title"><button className="modal-close" onClick={onClose} aria-label="Close exam briefing">×</button><div className={`briefing-icon ${exam.skill}`}>{exam.skill === "listening" ? <HeadphonesIcon /> : <BookIcon />}</div><h2 id="briefing-title">{exam.title}</h2><p className="briefing-description">{exam.description || "A timed IELTS-style mock with automatic scoring."}</p><div className="briefing-stats"><div><ClockIcon /><strong>{minutes(exam.duration_seconds)} minutes</strong><span>Server-timed</span></div><div><CheckIcon /><strong>{exam.question_count} questions</strong><span>{exam.sections.length} {exam.sections.length === 1 ? "section" : "sections"}</span></div></div>{exam.instructions && <div className="instruction-box"><strong>Before you begin</strong><p>{exam.instructions}</p></div>}<ul className="readiness-list"><li><CheckIcon /> Find a quiet place and keep this tab open.</li><li><CheckIcon /> Answers save automatically as you work.</li><li><CheckIcon /> Submit before time ends; the exam auto-submits at zero.</li></ul><div className="briefing-actions"><button className="secondary-action" onClick={onClose}>Not now</button><button className="primary-action" disabled={starting} onClick={onBegin}>{starting ? "Preparing exam…" : active ? "Resume timed exam" : "Start timed exam"} <ArrowIcon /></button></div><small className="timer-warning">{active ? "Your existing timer is already running." : "The timer begins only after you press Start timed exam."}</small></section></div>;
}

function HistoryList({ items, emptyText }: { items: HistoryItem[]; emptyText: string }) {
  if (!items.length) return <div className="empty-list"><HistoryIcon /><p>{emptyText}</p></div>;
  return <div className="history-list">{items.map((item, i) => <article className="history-row rise" style={stagger(i, 900, 60)} key={item.id}><div className="history-skill"><Poster skill={posterSkill(item.skill)} size="sm" /></div><div className="history-main"><strong>{item.title}</strong><span>{formatDate(item.started_at)} · {item.skill}</span></div><span className={`status-chip ${item.status}`}>{statusLabel(item.status)}</span><div className="history-score"><strong>{item.status === "scored" ? item.band_score?.toFixed(1) : "—"}</strong><span>{item.status === "scored" ? `Band · ${item.raw_score}/${item.question_count}` : "Band"}</span></div></article>)}</div>;
}

function SkillCard({ skill, data }: { skill: string; data?: SkillProgress }) {
  const accuracy = data?.total_questions ? Math.round((data.correct_answers / data.total_questions) * 100) : 0;
  return <article className={`skill-card ${skill}`}><div className="skill-card-heading"><Poster skill={posterSkill(skill)} size="sm" /><span>{skill}</span></div>{data ? <><div className="skill-band"><strong><Roll value={data.latest_band} from={4} step={0.5} delay={700} duration={1200} /></strong><span>Latest band</span></div><div className="skill-stats"><div><strong>{data.average_band.toFixed(1)}</strong><span>Average</span></div><div><strong>{data.best_band.toFixed(1)}</strong><span>Best</span></div><div><strong>{data.completed_attempts}</strong><span>Attempts</span></div></div><div className="accuracy-label"><span>Answer accuracy</span><strong>{accuracy}%</strong></div><div className="bar"><span className="grow" style={{ ...stagger(0, 900), width: `${accuracy}%` }} /></div></> : <div className="skill-no-data"><strong>No baseline yet</strong><p>Complete a {skill} mock to unlock this analysis.</p></div>}</article>;
}

function Metric({ label, value, hint }: { label: string; value: ReactNode; hint: string }) { return <article className="metric-card"><span>{label}</span><strong>{value}</strong><small>{hint}</small></article>; }

/** IELTS bands on a 4.0–9.0 rail: one dot per skill, the weakest ringed, the gap to target drawn in red. */
function BandRail({ progress, overall, target, label, base = 0 }: { progress: SkillProgress[]; overall: number; target?: number; label: string; base?: number }) {
  const pos = (band: number) => `${Math.max(0, Math.min(100, ((band - 4) / 5) * 100))}%`;
  const skills = [...progress].sort((a, b) => b.average_band - a.average_band);
  const last = skills[skills.length - 1];
  const lowBand = last ? halfBand(last.average_band) : null;
  const low = skills.length > 1 && lowBand! < halfBand(skills[0].average_band) ? last : undefined;
  const mid = halfBand(overall);
  const read = skills.map((item) => `${titleCase(item.skill)} ${halfBand(item.average_band).toFixed(1)}`).join(", ");
  return <div className="band-rail" role="img" aria-label={`${label}. ${read}${target ? `. Target ${target.toFixed(1)}` : ""}.`}>
    <i className="band-rail-line grow" style={stagger(0, base, 0, 900)} />
    {lowBand !== null && target && lowBand < target && <i className="band-rail-gap grow" style={{ ...stagger(0, base + 1200, 0, 900), left: pos(lowBand), width: `calc(${pos(target)} - ${pos(lowBand)})` }} />}
    {target && <span className="band-rail-target land" style={{ ...stagger(0, base + 600), left: pos(target) }}>Target {target.toFixed(1)}</span>}
    {skills.map((item, i) => {
      // skills sharing a half-band sit side by side instead of on top of each other
      const same = skills.filter((other) => halfBand(other.average_band) === halfBand(item.average_band));
      const shift = (same.indexOf(item) - (same.length - 1) / 2) * 28;
      return <span key={item.skill} className={`band-dot ${item.skill}${item === low ? " is-low" : ""} land`} style={{ ...stagger(i, base + 400, 110), left: pos(halfBand(item.average_band)), marginLeft: `${shift - 13}px` }}>{item.skill.charAt(0).toUpperCase()}</span>;
    })}
    {mid > 4.6 && <span className="band-rail-tick is-start blurin" style={stagger(0, base + 300)}>4.0</span>}
    <span className="band-rail-tick is-overall blurin" style={{ ...stagger(0, base + 300), left: pos(mid) }}>Overall <Roll value={mid} from={4} step={0.5} delay={base + 300} duration={1400} /></span>
    {mid < 8.4 && <span className="band-rail-tick is-end blurin" style={stagger(0, base + 300)}>9.0</span>}
  </div>;
}

function PageHeader({ title, copy }: { title: string; copy: string }) { return <header className="page-header rise"><div><h1>{title}</h1><p>{copy}</p></div></header>; }
function SectionHeading({ title }: { title: string }) { return <div className="section-heading"><h2>{title}</h2></div>; }
function NavButton({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: ReactNode; children: ReactNode }) { return <button className={`nav-item ${active ? "active" : ""}`} aria-current={active ? "page" : undefined} onClick={onClick}>{icon}<span>{children}</span></button>; }
function CardSkeletons({ count = 2 }: { count?: number }) { return <div className="skeleton-grid" aria-label="Loading exams">{Array.from({ length: count }, (_, index) => <div className="skeleton-card" key={index}><i/><i/><i/></div>)}</div>; }
function ListSkeleton() { return <div className="list-skeleton" aria-label="Loading activity"><i/><i/><i/></div>; }
function EmptyExams({ onAction }: { onAction?: () => void }) { return <div className="empty-state"><BookIcon /><h2>No published exams yet</h2><p>Reading and Listening mocks will appear here as soon as they are published.</p>{onAction && <button onClick={onAction}>Open exam library</button>}</div>; }

function viewFromHash(): View { const value = window.location.hash.replace("#", ""); return value === "plan" || value === "practice" || value === "exams" || value === "review" || value === "progress" || value === "notebook" || value === "explore" || value === "writing" || value === "speaking" || value === "stars" ? value : "dashboard"; }
function initialsFor(name: string) { return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "U"; }
function titleCase(v: string) { return v.charAt(0).toUpperCase() + v.slice(1); }
/** Overall IELTS rounding: to the nearest half band. */
function halfBand(v: number) { return Math.round(v * 2) / 2; }
function minutes(seconds: number) { return Math.max(1, Math.round(seconds / 60)); }
function weakestSkill(progress: SkillProgress[]) { if (!progress.length) return "reading"; return [...progress].sort((a, b) => a.average_band - b.average_band)[0].skill; }
function formatDate(value: string) { return new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value)); }
function statusLabel(status: string) { return ({ in_progress: "In progress", scored: "Completed", expired: "Expired", submitted: "Submitted" } as Record<string, string>)[status] || status; }
function messageFor(error: unknown, fallback: string) { return error instanceof Error ? error.message : fallback; }
function daysUntil(value: string) { const today = new Date(); today.setHours(0, 0, 0, 0); return Math.max(0, Math.ceil((new Date(`${value}T00:00:00`).getTime() - today.getTime()) / 86400000)); }
