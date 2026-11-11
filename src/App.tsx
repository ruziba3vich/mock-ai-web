import { useEffect, useState } from "react";
import AuthScreen from "./AuthScreen";
import LandingPage from "./LandingPage";
import ExamRunner from "./ExamRunner";
import StudentApp from "./StudentApp";
import FullMockFlow,{breakTime} from "./FullMockFlow";
import { APIError, authAPI, User } from "./auth";
import { Attempt, Exam, examAPI } from "./exams";
import {FullMockSession,newFullMock,readFullMock,writeFullMock} from "./fullMock";
import Wordmark from "./Wordmark";
import JoinExam, { ExamLobby } from "./JoinExam";
import { HeldSeat, readSeat, writeSeat } from "./examSession";

// Exam day at a learning centre: the centre's computers sit on this path.
// /pc is /join for a computer that wants to be set up as a centre computer.
const joining = ["/join", "/pc"].includes(window.location.pathname);

export type RunnerSession = { exam: Exam; attempt: Attempt; fullMockSkill?: "listening"|"reading" };

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [runner, setRunner] = useState<RunnerSession | null>(null);
  const [fullMock,setFullMock]=useState<FullMockSession|null>(null);
  const [seat, setSeat] = useState<HeldSeat | null>(readSeat);
  // Someone sent back from a sign-in round trip has already chosen to sign in,
  // so the landing page would be a step backwards for them.
  const [signingIn, setSigningIn] = useState(() => {
    const query = new URLSearchParams(window.location.search);
    return query.has("auth_error") || query.has("auth");
  });

  useEffect(() => {
    let active = true;
    async function restoreSession() {
      try {
        const current = await authAPI.me();
        if (active) setUser(current);
      } catch (error) {
        const initData = window.Telegram?.WebApp?.initData;
        if (initData && error instanceof APIError && error.status === 401) {
          try {
            const telegramUser = await authAPI.telegram(initData);
            if (active) setUser(telegramUser);
          } catch {
            // Keep normal sign-in available when Telegram authentication fails.
          }
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    window.Telegram?.WebApp?.ready();
    window.Telegram?.WebApp?.expand();
    void restoreSession();
    return () => { active = false; };
  }, []);

  useEffect(()=>{setFullMock(user?readFullMock(user.id):null)},[user?.id]);

  function updateFullMock(value:FullMockSession|null){if(user)writeFullMock(user.id,value);setFullMock(value)}
  function holdSeat(value: HeldSeat | null) { writeSeat(value); setSeat(value); }
  async function logout() {
    await authAPI.logout();
    setRunner(null);setFullMock(null);holdSeat(null);
    setUser(null);
  }
  // A centre computer is shared: finishing an exam-day mock signs the student
  // out and leaves the computer ready for the next exam code.
  async function finishExamDay() {
    updateFullMock(null);
    try { await logout(); } finally { if (!joining) window.location.assign("/join"); }
  }

  if (loading) return <LoadingScreen />;
  if (!user) return joining ? <JoinExam user={null} onUser={setUser} onJoined={holdSeat} onLogout={logout} />
    : signingIn ? <AuthScreen /> : <LandingPage onSignIn={() => setSigningIn(true)} />;
  if (runner) return <ExamRunner exam={runner.exam} initialAttempt={runner.attempt} completionLabel={runner.fullMockSkill?"Continue full mock":"Return to dashboard"} onScored={runner.fullMockSkill&&fullMock?(attempt)=>updateFullMock({...fullMock,stage:runner.fullMockSkill==="listening"?"break_reading":"break_writing",break_until:breakTime(),...(runner.fullMockSkill==="listening"?{listening_band:attempt.band_score}:{reading_band:attempt.band_score})}):undefined} strict={!!runner.fullMockSkill&&!!fullMock?.exam_session_id} onExit={() => setRunner(null)} />;

  if(fullMock)return <FullMockFlow session={fullMock} onChange={updateFullMock} onDirtyChange={()=>undefined} onStartExam={async(exam,skill)=>{const attempt=await examAPI.start(exam.id);setRunner({exam,attempt,fullMockSkill:skill})}} onFinish={fullMock.exam_session_id?()=>void finishExamDay():()=>{updateFullMock(null);window.location.hash="exams"}} onCancel={()=>updateFullMock(null)}/>;

  if (joining) {
    const held = seat?.user_id === user.id ? seat : null;
    const { listening_exam_id: listening, reading_exam_id: reading } = held?.seat ?? {};
    return held && listening && reading
      ? <ExamLobby held={held} user={user} onLogout={logout} onStart={() => updateFullMock({ ...newFullMock(listening, reading, held.reference), exam_session_id: held.seat.id, writing_task1_content_id: held.seat.writing_task1_content_id || undefined, writing_task2_content_id: held.seat.writing_task2_content_id || undefined })} />
      : <JoinExam user={user} onUser={setUser} onJoined={holdSeat} onLogout={logout} />;
  }

  return <StudentApp user={user} onStartExam={async (exam) => {
    const attempt = await examAPI.start(exam.id);
    setRunner({ exam, attempt });
  }} onStartFullMock={(listeningID,readingID,paidReference)=>updateFullMock(newFullMock(listeningID,readingID,paidReference))} onLogout={logout} />;
}

function LoadingScreen() {
  return <div className="loading-screen" role="status"><Wordmark /><span>Preparing your practice space…</span></div>;
}

export default App;
