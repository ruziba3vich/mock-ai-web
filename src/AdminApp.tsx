import { useEffect, useState } from "react";
import { APIError, apiRequest } from "./auth";
import ContentAdmin from "./ContentAdmin";

type Admin = { id: string; email: string; display_name: string };

export default function AdminApp() {
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
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
    {admin ? <main><div className="admin-intro"><p className="eyebrow">Administration</p><h1>Content management</h1><p>Create, preview and publish Reading and Listening material. Signed in as {admin.email}.</p></div><ContentAdmin /></main> :
      <main className="admin-login"><p className="eyebrow">Restricted workspace</p><h1>Admin sign in</h1><p>Use your separately provisioned administrator account. Student, Google and Telegram logins do not grant access.</p><form onSubmit={e => { e.preventDefault(); void login(); }}>
        <label>Admin email<input type="email" autoComplete="username" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} /></label>
        <label>Password<input type="password" autoComplete="current-password" required maxLength={1024} value={password} onChange={e => setPassword(e.target.value)} /></label>
        <button className="primary-action" disabled={busy}>{busy ? "Signing in…" : "Sign in to admin panel"}</button>
      </form><small>No public registration. Ask the platform operator to provision an admin account.</small></main>}
  </div>;
}
