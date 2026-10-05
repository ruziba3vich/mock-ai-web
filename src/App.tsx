import { useEffect, useState } from "react";
import AuthScreen from "./AuthScreen";
import ExamRunner from "./ExamRunner";
import StudentApp from "./StudentApp";
import { APIError, authAPI, User } from "./auth";
import { Attempt, Exam, examAPI } from "./exams";

export type RunnerSession = { exam: Exam; attempt: Attempt };

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [runner, setRunner] = useState<RunnerSession | null>(null);

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

  if (loading) return <LoadingScreen />;
  if (!user) return <AuthScreen onAuthenticated={setUser} />;
  if (runner) return <ExamRunner exam={runner.exam} initialAttempt={runner.attempt} onExit={() => setRunner(null)} />;

  return <StudentApp user={user} onStartExam={async (exam) => {
    const attempt = await examAPI.start(exam.id);
    setRunner({ exam, attempt });
  }} onLogout={async () => {
    await authAPI.logout();
    setUser(null);
  }} />;
}

function LoadingScreen() {
  return <div className="loading-screen" role="status"><span className="brand-mark">M</span><span>Preparing your practice space…</span></div>;
}

export default App;
