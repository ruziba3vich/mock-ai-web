import { useEffect, useMemo, useState } from "react";
import { APIError, apiRequest } from "./auth";
import { AdminIdentity, AdminProvider } from "./AdminResource";
import ContentAdmin from "./ContentAdmin";
import AdminDashboard from "./AdminDashboard";
import ManagedContentAdmin from "./ManagedContentAdmin";
import AdminStudents from "./AdminStudents";
import CentresAdmin from "./CentresAdmin";
import StarsAdmin from "./StarsAdmin";
import MarkingAdmin from "./MarkingAdmin";
import MyCentre from "./MyCentre";
import ExamSessions from "./ExamSessions";
import Wordmark from "./Wordmark";
import { GoogleIcon } from "./AuthScreen";

/**
 * The server says what this administrator is and what they may reach. The
 * panel used to work it out from whether centre_id happened to be set, which
 * drifted from what the API allowed the moment the login response and
 * /admin/me disagreed -- and they did.
 *
 * Permissions decide what is shown, never what is allowed: every route still
 * checks for itself. They are handed down through AdminProvider as well, so a
 * screen can hide a Create button for the same reason the tab strip hides a
 * tab.
 */
type Admin = AdminIdentity;

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
  { key: "sessions", label: "Exam day" },
  { key: "centre", label: "Your centre" },
  { key: "centres", label: "Centres" },
  { key: "pricing", label: "Pricing" },
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
  return admin.centre_id ? [...shared, "marking", "sessions", "centre"] : [...shared, "centres", "pricing"];
}

function allowed(admin: Admin, key: string) {
  return permissionsOf(admin).includes(key);
}

const GOOGLE_ERRORS: Record<string, string> = {
  no_account: "No learning centre is registered with that Google account. Enter your centre's name to register it.",
  invalid_centre: "Enter your centre's name, up to 120 characters, then continue with Google.",
  google_unavailable: "Google sign-in is not available right now. Please try again later.",
  google_failed: "Google sign-in did not finish. Please try again.",
};

export default function AdminApp() {
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // A centre opening its own account arrives from the site with ?register.
  const [registering, setRegistering] = useState(() => new URLSearchParams(window.location.search).has("register"));
  // Platform staff sign in with a password on main.<site>; centres only see
  // Google on panel.<site>. Local development has one host, so ?staff chooses.
  const [staff] = useState(() => { const { hostname, search } = window.location; return hostname.startsWith("main.") || (["localhost", "127.0.0.1"].includes(hostname) && new URLSearchParams(search).has("staff")); });
  const [busy, setBusy] = useState(false);
  // Google sends the administrator back here with ?auth=<what went wrong>.
  const [error, setError] = useState(() => { const code = new URLSearchParams(window.location.search).get("auth"); return code ? GOOGLE_ERRORS[code] ?? GOOGLE_ERRORS.google_failed : ""; });
  // A centre administrator coming back from paying lands on their centre.
  const [page,setPage]=useState(()=>(q=>q.has("purchase")||q.has("registered")?"centre":q.has("pc")?"sessions":"overview")(new URLSearchParams(window.location.search)));
  useEffect(()=>{if(admin&&!allowed(admin,page))setPage("overview")},[admin,page]);
  useEffect(() => {
    // The one-time answer from Google must not survive a reload.
    const q = new URLSearchParams(window.location.search);
    if (q.has("auth") || q.has("registered")) { q.delete("auth"); q.delete("registered"); window.history.replaceState(null, "", window.location.pathname + (q.size ? "?" + q : "")); }
    let active = true;
    apiRequest<{ admin: Admin }>("/api/v1/admin/me").then(result => { if (active) setAdmin(result.admin); }).catch(e => { if (active && (!(e instanceof APIError) || e.status !== 401)) setError("Admin service unavailable. Please try again."); }).finally(() => { if (active) setLoading(false); });
    const expired = () => { setAdmin(null); setPassword(""); };
    window.addEventListener("admin-session-expired", expired);
    return () => { active = false; window.removeEventListener("admin-session-expired", expired); };
  }, []);
  const scope = useMemo(() => ({ admin, can: (key: string) => !!admin && allowed(admin, key) }), [admin]);
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
  return <AdminProvider value={scope}><div className="admin-app">
    <header className="admin-topbar"><div className="brand" role="img" aria-label="mock-ai Admin"><Wordmark /><small>Admin</small></div>{admin && <div><span>{admin.display_name}{admin.centre_name?<small className="admin-scope">{admin.centre_name}</small>:null}</span><button className="secondary-action" disabled={busy} onClick={() => void logout()}>Sign out</button></div>}</header>
    {error && <div className="admin-notice" role="alert">{error}</div>}
    {admin ? <><nav className="admin-nav" aria-label="Admin sections">{TABS.filter(tab=>allowed(admin,tab.key)).map(tab=><button key={tab.key} className={page===tab.key?"active":""} onClick={()=>setPage(tab.key)}>{tab.label}</button>)}</nav><main className="admin-main">{page==="overview"&&<AdminDashboard/>}{page==="centres"&&allowed(admin,"centres")&&<CentresAdmin/>}{page==="pricing"&&allowed(admin,"pricing")&&<StarsAdmin/>}{page==="marking"&&allowed(admin,"marking")&&<MarkingAdmin/>}{page==="centre"&&allowed(admin,"centre")&&<MyCentre/>}{page==="sessions"&&allowed(admin,"sessions")&&<ExamSessions/>}{page==="students"&&allowed(admin,"students")&&<AdminStudents/>}{page==="exams"&&allowed(admin,"exams")&&<ContentAdmin/>}{page==="challenges"&&allowed(admin,"challenges")&&<ManagedContentAdmin permission="challenges" kinds={["daily_challenge","achievement"]} title="Challenges & achievements" description="Define goals, unlock rules, visibility windows, destinations, and their student-facing copy."/>}{page==="vocabulary"&&allowed(admin,"vocabulary")&&<ManagedContentAdmin permission="vocabulary" kinds={["vocabulary"]} title="Vocabulary warm-up" description="Manage the word cards students receive in their two-minute practice rounds."/>}{page==="writing"&&allowed(admin,"writing")&&<ManagedContentAdmin permission="writing" kinds={["writing_prompt"]} title="Writing prompt library" description="Create and schedule original IELTS Writing Task 2 prompts for student practice."/>}{page==="speaking"&&allowed(admin,"speaking")&&<ManagedContentAdmin permission="speaking" kinds={["speaking_plan"]} title="Speaking interview plans" description="Control the full eleven-question, three-part interviews used by the live AI examiner."/>}</main></> :
      registering ? <main className="admin-login"><h1>Register your centre</h1><p>Open your learning centre's account with your Google account. You then buy stars and run mock exams on your own computers. Each student who starts an exam uses 1 star.</p><form action="/api/v1/admin/auth/google/start">
        <label>Centre name<input name="centre_name" required maxLength={120} autoComplete="organization" /></label>
        <button className="google-button"><GoogleIcon /> Continue with Google</button>
      </form><small>Already registered? <button type="button" onClick={() => { setRegistering(false); setError(""); }}>Sign in</button></small></main>
      : staff ? <main className="admin-login"><h1>Staff sign in</h1><p>For mock-ai staff. Learning centres sign in with Google.</p>
      <form onSubmit={e => { e.preventDefault(); void login(); }}>
        <label>Admin email<input type="email" autoComplete="username" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} /></label>
        <label>Password<input type="password" autoComplete="current-password" required maxLength={1024} value={password} onChange={e => setPassword(e.target.value)} /></label>
        <button className="primary-action" disabled={busy}>{busy ? "Signing in…" : "Sign in to admin panel"}</button>
      </form></main>
      : <main className="admin-login"><h1>Centre sign in</h1><p>Sign in with the Google account your learning centre registered with.</p>
      <a className="google-button" href="/api/v1/admin/auth/google/start"><GoogleIcon /> Continue with Google</a>
      <p><small>New here? <button type="button" onClick={() => { setRegistering(true); setError(""); }}>Register your centre</button></small></p></main>}
  </div></AdminProvider>;
}
