import { useEffect, useState } from "react";
import { APIError, apiRequest } from "./auth";
import ContentAdmin from "./ContentAdmin";
import AdminDashboard from "./AdminDashboard";
import ManagedContentAdmin from "./ManagedContentAdmin";
import AdminStudents from "./AdminStudents";
import CentresAdmin from "./CentresAdmin";
import MarkingAdmin from "./MarkingAdmin";
import MyCentre from "./MyCentre";

/**
 * The server says what this administrator is and what they may reach. The
 * panel used to work it out from whether centre_id happened to be set, which
 * drifted from what the API allowed the moment the login response and
 * /admin/me disagreed -- and they did.
 *
 * Permissions decide what is shown, never what is allowed: every route still
 * checks for itself.
 */
type Admin = {
  id: string; email: string; display_name: string;
  centre_id?: string; centre_name?: string;
  role?: "platform" | "centre";
  permissions?: string[];
};

/** Every tab the panel can show, in the order they appear. */
const TABS: { key: string; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "students", label: "Students" },
  { key: "exams", label: "Exams" },
  { key: "challenges", label: "Challenges" },
  { key: "vocabulary", label: "Vocabulary" },
  { key: "writing", label: "Writing" },
  { key: "speaking", label: "Speaking" },
  { key: "marking", label: "Marking" },
  { key: "centre", label: "Your centre" },
  { key: "centres", label: "Centres" },
];

/**
 * What this administrator may be shown.
 *
 * The server sends the list. When it does not -- an API older than this
 * build, and these are separate repositories that cannot deploy together --
 * fall back to deriving it, because the alternative is a panel with no tabs
 * at all. Showing a tab the API then refuses is recoverable; showing none is
 * not.
 */
function permissionsOf(admin: Admin): string[] {
  if (admin.permissions?.length) return admin.permissions;
  const shared = ["overview", "students", "exams", "challenges", "vocabulary", "writing", "speaking"];
  return admin.centre_id ? [...shared, "marking", "centre"] : [...shared, "centres"];
}

function allowed(admin: Admin, key: string) {
  return permissionsOf(admin).includes(key);
}

export default function AdminApp() {
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [page,setPage]=useState("overview");
  useEffect(()=>{if(admin&&!allowed(admin,page))setPage("overview")},[admin,page]);
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
    <header className="admin-topbar"><div className="brand"><span className="brand-mark">M</span><span>mock-ai <small>Admin</small></span></div>{admin && <div><span>{admin.display_name}{admin.centre_name?<small className="admin-scope">{admin.centre_name}</small>:null}</span><button className="secondary-action" disabled={busy} onClick={() => void logout()}>Sign out</button></div>}</header>
    {error && <div className="admin-notice" role="alert">{error}</div>}
    {admin ? <><nav className="admin-nav" aria-label="Admin sections">{TABS.filter(tab=>allowed(admin,tab.key)).map(tab=><button key={tab.key} className={page===tab.key?"active":""} onClick={()=>setPage(tab.key)}>{tab.label}</button>)}</nav><main className="admin-main">{page==="overview"&&<AdminDashboard/>}{page==="centres"&&allowed(admin,"centres")&&<CentresAdmin/>}{page==="marking"&&allowed(admin,"marking")&&<MarkingAdmin/>}{page==="centre"&&allowed(admin,"centre")&&<MyCentre/>}{page==="students"&&<AdminStudents/>}{page==="exams"&&<><div className="admin-intro"><h1>Exam content</h1><p>Create, import, preview, and publish versioned tests.</p></div><ContentAdmin/></>}{page==="challenges"&&<ManagedContentAdmin kinds={["daily_challenge","achievement"]} title="Challenges & achievements" description="Define goals, unlock rules, visibility windows, destinations, and their student-facing copy."/>}{page==="vocabulary"&&<ManagedContentAdmin kinds={["vocabulary"]} title="Vocabulary warm-up" description="Manage the word cards students receive in their two-minute practice rounds."/>}{page==="writing"&&<ManagedContentAdmin kinds={["writing_prompt"]} title="Writing prompt library" description="Create and schedule original IELTS Writing Task 2 prompts for student practice."/>}{page==="speaking"&&<ManagedContentAdmin kinds={["speaking_plan"]} title="Speaking interview plans" description="Control the full eleven-question, three-part interviews used by the live AI examiner."/>}</main></> :
      <main className="admin-login"><h1>Admin sign in</h1><p>Use your separately provisioned administrator account. Student, Google and Telegram logins do not grant access.</p><form onSubmit={e => { e.preventDefault(); void login(); }}>
        <label>Admin email<input type="email" autoComplete="username" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} /></label>
        <label>Password<input type="password" autoComplete="current-password" required maxLength={1024} value={password} onChange={e => setPassword(e.target.value)} /></label>
        <button className="primary-action" disabled={busy}>{busy ? "Signing in…" : "Sign in to admin panel"}</button>
      </form><small>No public registration. Ask the platform operator to provision an admin account.</small></main>}
  </div>;
}
