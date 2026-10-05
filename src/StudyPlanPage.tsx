import { FormEvent, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { StudyPlan, StudyProfile, examAPI } from "./exams";
import { ArrowIcon, BookIcon, CalendarIcon, CheckIcon, ClockIcon, FlameIcon, HeadphonesIcon, ReviewIcon, TargetIcon } from "./icons";

type Props = {
  plan: StudyPlan | null; loading: boolean; onRefresh: () => Promise<void>;
  onPractice: (skill: "reading" | "listening", questionType: string) => void;
  onReview: () => void; onExams: () => void;
};

export default function StudyPlanPage({ plan, loading, onRefresh, onPractice, onReview, onExams }: Props) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<StudyProfile>(() => plan?.profile || defaultProfile());

  if (loading && !plan) return <div className="content page-content"><div className="plan-loading"><i/><i/><i/></div></div>;
  if (!plan) return <div className="content page-content"><div className="form-error">Your study plan could not be loaded.</div></div>;

  const profile = plan.profile;
  const days = profile.exam_date ? daysUntil(profile.exam_date) : null;
  const dailyPercent = Math.min(100, Math.round((plan.estimated_minutes_today / profile.daily_goal_minutes) * 100));
  const maxActivity = Math.max(5, ...plan.week.map((day) => day.practice_answers + day.mocks_completed * 5));

  function beginEdit() { setForm(profile); setError(""); setEditing(true); }
  async function save(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    try { await examAPI.updateStudyProfile(form); await onRefresh(); setEditing(false); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Your study profile could not be saved."); }
    finally { setSaving(false); }
  }

  return <div className="content page-content">
    <header className="plan-hero"><div><p className="eyebrow">Personal study plan</p><h1>Your clearest path to Band {profile.target_band.toFixed(1)}</h1><p>Complete today’s short actions, keep your streak alive, and use full mocks to confirm improvement under time pressure.</p><button onClick={beginEdit}>Edit goal and exam date</button></div><div className="goal-ring" style={{ "--progress": `${dailyPercent * 3.6}deg` } as CSSProperties}><div><strong>{dailyPercent}%</strong><span>Daily goal</span></div></div></header>

    {!profile.exam_date && <section className="plan-onboarding"><CalendarIcon /><div><strong>Add your IELTS exam date</strong><p>We’ll turn your target band into a clearer countdown and daily pace.</p></div><button onClick={beginEdit}>Set exam date</button></section>}

    <div className="plan-metrics"><PlanMetric icon={<TargetIcon />} label="Target band" value={profile.target_band.toFixed(1)} hint={profile.track === "general_training" ? "General Training" : "Academic IELTS"} /><PlanMetric icon={<CalendarIcon />} label="Time remaining" value={days === null ? "—" : String(days)} hint={days === null ? "Add an exam date" : days === 1 ? "day until your exam" : "days until your exam"} /><PlanMetric icon={<FlameIcon />} label="Study streak" value={String(plan.streak_days)} hint={plan.streak_days === 1 ? "active day" : "consecutive active days"} /></div>

    <section className="section compact-section"><div className="section-heading"><div><p className="eyebrow">Today · about {profile.daily_goal_minutes} minutes</p><h2>Your next three actions</h2></div></div><div className="daily-tasks">
      <TaskCard done={plan.practice_today >= 5} icon={plan.recommendation.skill === "listening" ? <HeadphonesIcon /> : <BookIcon />} eyebrow="10 minutes" title={`Practise ${labelType(plan.recommendation.question_type)}`} copy={`${capitalize(plan.recommendation.skill)} · ${plan.recommendation.reason}`} action={plan.practice_today >= 5 ? "Practise more" : "Start practice"} onAction={() => onPractice(plan.recommendation.skill, plan.recommendation.question_type)} />
      <TaskCard done={plan.reviews_today > 0} icon={<ReviewIcon />} eyebrow="5 minutes" title="Review recent mistakes" copy="Compare your answers with the accepted answers and notice the exact evidence you missed." action={plan.reviews_today > 0 ? "Review more" : "Open review"} onAction={onReview} />
      <TaskCard done={plan.mocks_this_week > 0} icon={<ClockIcon />} eyebrow="Weekly checkpoint" title="Complete one timed mock" copy={plan.mocks_this_week ? "Weekly checkpoint complete. Another mock is optional." : "Measure whether practice holds up under realistic time pressure."} action={plan.mocks_this_week ? "Take another" : "Choose a mock"} onAction={onExams} />
    </div></section>

    <section className="section compact-section plan-activity"><div className="section-heading"><div><p className="eyebrow">Last seven days</p><h2>Consistency</h2></div><span>{plan.practice_today} practice answers today</span></div><div className="activity-chart">{plan.week.map((day) => { const activity = day.practice_answers + day.mocks_completed * 5; return <div key={day.date}><div className="activity-bar"><i style={{ height: `${Math.max(activity ? 12 : 3, activity / maxActivity * 100)}%` }} /></div><strong>{weekday(day.date)}</strong><span>{activity || "·"}</span></div>; })}</div><p className="activity-key"><i/> Practice answers <i/> Timed mocks count as five activity points</p></section>

    {editing && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditing(false); }}>
      <form className="profile-dialog" onSubmit={(event) => void save(event)}>
        <button type="button" className="modal-close" onClick={() => setEditing(false)}>×</button>
        <p className="eyebrow">Personalize your plan</p><h2>Study goal</h2>
        <div className="profile-fields">
          <label>Target band<select value={form.target_band} onChange={(event) => setForm({ ...form, target_band: Number(event.target.value) })}>{Array.from({ length: 11 }, (_, i) => 4 + i * .5).map((band) => <option key={band} value={band}>{band.toFixed(1)}</option>)}</select></label>
          <label>Exam date<input type="date" min={today()} value={form.exam_date || ""} onChange={(event) => setForm({ ...form, exam_date: event.target.value })} /></label>
          <label>IELTS track<select value={form.track} onChange={(event) => setForm({ ...form, track: event.target.value as StudyProfile["track"] })}><option value="academic">Academic</option><option value="general_training" disabled>General Training (coming soon)</option></select></label>
          <label>Daily study goal<select value={form.daily_goal_minutes} onChange={(event) => setForm({ ...form, daily_goal_minutes: Number(event.target.value) })}>{[10, 20, 30, 45, 60, 90].map((minutes) => <option key={minutes} value={minutes}>{minutes} minutes</option>)}</select></label>
        </div>
        {error && <div className="form-error">{error}</div>}
        <div className="profile-actions"><button type="button" className="secondary-action" onClick={() => setEditing(false)}>Cancel</button><button className="primary-action" disabled={saving}>{saving ? "Saving…" : "Save study goal"}</button></div>
      </form>
    </div>}
  </div>;
}

function TaskCard({ done, icon, eyebrow, title, copy, action, onAction }: { done: boolean; icon: ReactNode; eyebrow: string; title: string; copy: string; action: string; onAction: () => void }) { return <article className={`task-card ${done ? "done" : ""}`}><div className="task-icon">{done ? <CheckIcon /> : icon}</div><div><span>{eyebrow}</span><h3>{title}</h3><p>{copy}</p></div><button onClick={onAction}>{action} <ArrowIcon /></button></article>; }
function PlanMetric({ icon, label, value, hint }: { icon: ReactNode; label: string; value: string; hint: string }) { return <article><div>{icon}</div><span>{label}</span><strong>{value}</strong><small>{hint}</small></article>; }
function defaultProfile(): StudyProfile { return { target_band: 7, exam_date: "", track: "academic", daily_goal_minutes: 20 }; }
function labelType(value: string) { return value.split("_").map(capitalize).join(" "); }
function capitalize(value: string) { return value.charAt(0).toUpperCase() + value.slice(1); }
function today() { return new Date().toISOString().slice(0, 10); }
function daysUntil(value: string) { return Math.max(0, Math.ceil((new Date(`${value}T00:00:00`).getTime() - new Date(`${today()}T00:00:00`).getTime()) / 86400000)); }
function weekday(value: string) { return new Intl.DateTimeFormat("en", { weekday: "short", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`)).slice(0, 1); }
