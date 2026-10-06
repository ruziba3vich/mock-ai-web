import { useEffect, useState } from "react";
import { apiRequest } from "./auth";
import VocabularyGame from "./VocabularyGame";

type Community = {
  profile: { nickname: string; enabled: boolean };
  stats: { questions: number; mocks: number; days: number; today_questions: number; week_mocks: number; week_days: number; week_points: number };
  board: { nickname: string; points: number; position: number; is_me: boolean }[];
};

export default function ExplorePage({ onPractice, onExams }: { onPractice: () => void; onExams: () => void }) {
  const [data, setData] = useState<Community | null>(null);
  const [nickname, setNickname] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  async function load() {
    setError("");
    try {
      const result = await apiRequest<Community>("/api/v1/me/community");
      setData(result); setNickname(result.profile.nickname); setEnabled(result.profile.enabled);
    } catch { setError("Could not load your challenges. Please try again."); }
  }
  useEffect(() => { void load(); }, []);
  async function save() {
    setBusy(true); setError(""); setNotice("");
    try {
      await apiRequest("/api/v1/me/community", { method: "PUT", body: JSON.stringify({ nickname, enabled }) });
      await load(); setNotice(enabled ? "You have joined this week’s leaderboard." : "You are hidden from the leaderboard. Your progress stays saved.");
    } catch { setError("Could not save. Use a nickname of 2–24 letters, numbers, spaces, hyphens or underscores."); }
    finally { setBusy(false); }
  }
  const s = data?.stats;
  return <div className="content page-content explore-page">
    <header className="explore-heading"><p className="eyebrow">A little practice, every day</p><h1>Make it a habit.</h1><p>Small challenges. Real progress. A friendly reason to come back.</p></header>
    {error && <div role="alert" className="global-notice error">{error}<button onClick={() => void load()}>Retry</button></div>}
    {!data && !error && <p role="status">Loading your challenges…</p>}
    {s && <>
      <section className="challenge-grid" aria-label="Study challenges">
        <Challenge title="Daily five" label="Practise 5 different questions today" value={s.today_questions} target={5} action="Start practice" onClick={onPractice}/>
        <Challenge title="Show up three times" label="Study on 3 days this week" value={s.week_days} target={3} action="Keep practising" onClick={onPractice}/>
        <Challenge title="Mock milestone" label="Complete a mock this week with at least one answer" value={s.week_mocks} target={1} action="Choose a mock" onClick={onExams}/>
      </section>
      <p className="explore-caption">Daily challenges reset at midnight UTC. Weeks run Monday–Sunday (UTC).</p>
      <section className="explore-card"><div className="section-heading"><h2>Your achievements</h2><span>Earned through study</span></div><div className="badge-grid">
        {[{name:"First steps",detail:"Practise 5 different questions",value:s.questions,target:5,icon:"01"},{name:"Curious mind",detail:"Practise 25 different questions",value:s.questions,target:25,icon:"25"},{name:"Mock explorer",detail:"Complete your first answered mock",value:s.mocks,target:1,icon:"M"},{name:"Building a habit",detail:"Study on 7 different days",value:s.days,target:7,icon:"7"}].map(b=><div key={b.name} className={`achievement ${b.value>=b.target?"earned":""}`}><span className="achievement-symbol" aria-hidden="true">{b.icon}</span><strong>{b.name}</strong><small>{b.detail}</small><span>{b.value>=b.target?"Unlocked ✓":`${Math.min(b.value,b.target)} / ${b.target}`}</span></div>)}
      </div></section>
    </>}
    <VocabularyGame/>
    {data && <section className="explore-card" aria-labelledby="leaderboard-title"><div className="section-heading"><div><p className="eyebrow">Friendly competition</p><h2 id="leaderboard-title">Weekly leaderboard</h2></div><strong>{data.stats.week_points} points this week</strong></div>
      <p>Study points, not IELTS bands. Each different practice question earns 1 point; each answered, completed mock version earns 10. Each counts once per week, regardless of accuracy. Vocabulary games do not earn ranking points.</p>
      <form className="community-settings" onSubmit={e=>{e.preventDefault();void save();}}>
        <label>Public nickname<input value={nickname} onChange={e=>setNickname(e.target.value)} minLength={2} maxLength={24} required placeholder="Choose a nickname" autoComplete="off"/></label>
        <label className="community-checkbox"><input type="checkbox" checked={enabled} onChange={e=>setEnabled(e.target.checked)}/> Show my nickname and points to other students</label>
        <button className="secondary-action" disabled={busy}>{busy?"Saving…":"Save visibility"}</button>
      </form>
      <p className="explore-caption">Optional and off by default. Your name, email and Telegram photo are never used here. Turning this off removes you from the board.</p>
      {notice && <p role="status">{notice}</p>}
      {data.board.length ? <ol className="leaderboard" aria-label="Weekly standings">{data.board.map((entry,i)=><li key={i} className={entry.is_me?"is-me":""}><span className="rank">{entry.position}</span><strong>{entry.nickname}{entry.is_me?" (you)":""}</strong><span>{entry.points} pts</span></li>)}</ol> : <div className="leaderboard-empty"><h3>A fresh starting line.</h3><p>No participants have earned points this week yet. Practise, then join when you’re ready.</p></div>}
      <p className="explore-caption">Top 50 participants, plus your position if you’re outside the top 50. Equal points share a rank. Existing activity from this week counts when you join.</p>
    </section>}
  </div>;
}

function Challenge({ title,label,value,target,action,onClick }: { title:string; label:string; value:number; target:number; action:string; onClick:()=>void }) {
  const done=value>=target;
  return <article className={`challenge-card ${done?"complete":""}`}><span className="eyebrow">{done?"Completed ✓":"Your next small win"}</span><h2>{title}</h2><p>{label}</p><progress value={Math.min(value,target)} max={target} aria-label={title}/><strong>{Math.min(value,target)} / {target}</strong><button onClick={onClick}>{done?"Keep the momentum →":`${action} →`}</button></article>;
}
