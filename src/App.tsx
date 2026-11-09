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

export type RunnerSession = { exam: Exam; attempt: Attempt; fullMockSkill?: "listening"|"reading" };

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [runner, setRunner] = useState<RunnerSession | null>(null);
  const [fullMock,setFullMock]=useState<FullMockSession|null>(null);
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

  if (loading) return <LoadingScreen />;
  if (!user) return signingIn ? <AuthScreen /> : <LandingPage onSignIn={() => setSigningIn(true)} />;
  if (runner) return <ExamRunner exam={runner.exam} initialAttempt={runner.attempt} completionLabel={runner.fullMockSkill?"Continue full mock":"Return to dashboard"} onScored={runner.fullMockSkill&&fullMock?(attempt)=>updateFullMock({...fullMock,stage:runner.fullMockSkill==="listening"?"break_reading":"break_writing",break_until:breakTime(),...(runner.fullMockSkill==="listening"?{listening_band:attempt.band_score}:{reading_band:attempt.band_score})}):undefined} onExit={() => setRunner(null)} />;

  if(fullMock)return <FullMockFlow session={fullMock} onChange={updateFullMock} onDirtyChange={()=>undefined} onStartExam={async(exam,skill)=>{const attempt=await examAPI.start(exam.id);setRunner({exam,attempt,fullMockSkill:skill})}} onFinish={()=>{updateFullMock(null);window.location.hash="exams"}} onCancel={()=>updateFullMock(null)}/>;

  return <StudentApp user={user} onStartExam={async (exam) => {
    const attempt = await examAPI.start(exam.id);
    setRunner({ exam, attempt });
  }} onStartFullMock={(listeningID,readingID,paidReference)=>updateFullMock(newFullMock(listeningID,readingID,paidReference))} onLogout={async () => {
    await authAPI.logout();
    setRunner(null);setFullMock(null);
    setUser(null);
  }} />;
}

function LoadingScreen() {
  return <div className="loading-screen" role="status"><Wordmark /><span>Preparing your practice space…</span></div>;
}

export default App;
