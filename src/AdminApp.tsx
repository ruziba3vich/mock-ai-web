import { useEffect, useState } from "react";
import { APIError, apiRequest } from "./auth";
import ContentAdmin from "./ContentAdmin";
import AdminDashboard from "./AdminDashboard";
import ManagedContentAdmin from "./ManagedContentAdmin";

type Admin = { id: string; email: string; display_name: string };

export default function AdminApp() {
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [page,setPage]=useState("overview");
  useEffect(() => {
    let active = true;
    apiRequest<{ admin: Admin }>("/api/v1/admin/me").then(result => { if (active) setAdmin(result.admin); }).catch(e => { if (active && (!(e instanceof APIError) || e.status !== 401)) setError("Admin service unavailable. Please try again."); }).finally(() => { if (active) setLoading(false); });
    const expired = () => { setAdmin(null); setPassword(""); };
    window.addEventListener("admin-session-expired", expired);
    return () => { active = false; window.removeEventListener("admin-session-expired", expired); };
  }, []);
  async function login() {
    setBusy(true); setError("");
    try { const result = await apiRequest<{ admin: Admin }>("/api/v1/admin/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }); setAdmin(result.admin); setPassword(""); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not sign in."); }
    finally { setBusy(false); }
  }
  async function logout() {
    setBusy(true); setError("");
    try { await apiRequest("/api/v1/admin/auth/logout", { method: "POST" }); setAdmin(null); }
    catch { setError("Could not sign out. Please try again."); }
    finally { setBusy(false); }
  }
  if (loading) return <div className="loading-screen" role="status">Opening admin panel…</div>;
  return <div className="admin-app">
    <header className="admin-topbar"><div className="brand"><span className="brand-mark">M</span><span>mock.ai <small>Admin</small></span></div>{admin && <div><span>{admin.display_name}</span><button className="secondary-action" disabled={busy} onClick={() => void logout()}>Sign out</button></div>}</header>
    {error && <div className="admin-notice" role="alert">{error}</div>}
    {admin ? <><nav className="admin-nav" aria-label="Admin sections">{[["overview","Overview"],["exams","Exams"],["challenges","Challenges"],["vocabulary","Vocabulary"],["writing","Writing"],["speaking","Speaking"]].map(([key,label])=><button key={key} className={page===key?"active":""} onClick={()=>setPage(key)}>{label}</button>)}</nav><main className="admin-main">{page==="overview"&&<AdminDashboard/>}{page==="exams"&&<><div className="admin-intro"><p className="eyebrow">Reading and Listening</p><h1>Exam content</h1><p>Create, import, preview, and publish versioned tests.</p></div><ContentAdmin/></>}{page==="challenges"&&<ManagedContentAdmin kinds={["daily_challenge","achievement"]} title="Challenges & achievements" description="Define goals, unlock rules, visibility windows, destinations, and their student-facing copy."/>}{page==="vocabulary"&&<ManagedContentAdmin kinds={["vocabulary"]} title="Vocabulary warm-up" description="Manage the word cards students receive in their two-minute practice rounds."/>}{page==="writing"&&<ManagedContentAdmin kinds={["writing_prompt"]} title="Writing prompt library" description="Create and schedule original IELTS Writing Task 2 prompts for student practice."/>}{page==="speaking"&&<ManagedContentAdmin kinds={["speaking_plan"]} title="Speaking interview plans" description="Control the full eleven-question, three-part interviews used by the live AI examiner."/>}</main></> :
      <main className="admin-login"><p className="eyebrow">Restricted workspace</p><h1>Admin sign in</h1><p>Use your separately provisioned administrator account. Student, Google and Telegram logins do not grant access.</p><form onSubmit={e => { e.preventDefault(); void login(); }}>
        <label>Admin email<input type="email" autoComplete="username" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} /></label>
        <label>Password<input type="password" autoComplete="current-password" required maxLength={1024} value={password} onChange={e => setPassword(e.target.value)} /></label>
        <button className="primary-action" disabled={busy}>{busy ? "Signing in…" : "Sign in to admin panel"}</button>
      </form><small>No public registration. Ask the platform operator to provision an admin account.</small></main>}
  </div>;
}
