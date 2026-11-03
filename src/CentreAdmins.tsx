import { useEffect, useState } from "react";
import { Centre, CentreAdmin, centresAPI } from "./centres";

/**
 * The administrators of one learning centre.
 *
 * Provisioning these used to mean writing SQL, which is why this sits inside
 * the centre's own row: creating the centre and handing someone the keys to it
 * are one job, not two.
 *
 * A password is shown exactly once, when it is issued. There is no mail
 * infrastructure to send a reset through, so re-keying from here is the
 * recovery path for an administrator who is locked out.
 */
export default function CentreAdmins({ centre }: { centre: Centre }) {
  const [admins, setAdmins] = useState<CentreAdmin[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  /** The one-time password for whichever account was just issued one. */
  const [issued, setIssued] = useState<{ id: string; email: string; password: string } | null>(null);

  async function load() {
    try {
      setAdmins(await centresAPI.listAdmins(centre.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load administrators.");
    }
  }
  useEffect(() => { if (open) void load(); }, [open, centre.id]);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const admin = await centresAPI.createAdmin(centre.id, email, name);
      setIssued({ id: admin.id, email: admin.email, password: admin.password ?? "" });
      setEmail(""); setName("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add the administrator.");
    } finally { setBusy(false); }
  }

  async function rekey(admin: CentreAdmin) {
    setBusy(true); setError("");
    try {
      const updated = await centresAPI.resetAdminPassword(centre.id, admin.id);
      setIssued({ id: admin.id, email: admin.email, password: updated.password ?? "" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not issue a new password.");
    } finally { setBusy(false); }
  }

  async function toggle(admin: CentreAdmin) {
    setBusy(true); setError("");
    try {
      await centresAPI.setAdminDisabled(centre.id, admin.id, !admin.disabled);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not change the administrator.");
    } finally { setBusy(false); }
  }

  if (!open) {
    return <button type="button" className="centre-admins-toggle" onClick={() => setOpen(true)}>
      Administrators
    </button>;
  }

  return <section className="centre-admins" aria-label={`Administrators of ${centre.name}`}>
    <div className="centre-admins-head">
      <h3>Administrators</h3>
      <button type="button" className="centre-admins-toggle" onClick={() => setOpen(false)}>Hide</button>
    </div>
    {error && <p className="instruction-box" role="alert">{error}</p>}

    {issued && <div className="centre-credential" role="status">
      <p>Password for <strong>{issued.email}</strong>. It is shown once — copy it now and send it to the centre.</p>
      <div className="centre-invite">
        <label>One-time password<input readOnly value={issued.password} onFocus={e => e.target.select()} /></label>
        <button type="button" className="secondary-action" onClick={() => void navigator.clipboard?.writeText(issued.password).catch(() => undefined)}>Copy</button>
      </div>
      <button type="button" className="danger-link" onClick={() => setIssued(null)}>I have saved it</button>
    </div>}

    <ul className="centre-admin-list">
      {admins.map(admin => <li key={admin.id}>
        <div>
          <strong>{admin.display_name}</strong>
          <span>{admin.email}</span>
        </div>
        <div className="centre-admin-actions">
          {admin.disabled && <span className="status-chip status-archived">Blocked</span>}
          <button type="button" className="secondary-action" disabled={busy} onClick={() => void rekey(admin)}>New password</button>
          <button type="button" className="danger-link" disabled={busy} onClick={() => void toggle(admin)}>
            {admin.disabled ? "Allow sign-in" : "Block sign-in"}
          </button>
        </div>
      </li>)}
      {admins.length === 0 && <li className="centre-admin-empty">No one can administer this centre yet.</li>}
    </ul>

    <form className="centre-admin-new" onSubmit={create}>
      <div className="admin-columns">
        <label>Name<input required maxLength={100} placeholder="Dilnoza Karimova" value={name} onChange={e => setName(e.target.value)} /></label>
        <label>Email<input required type="email" maxLength={254} placeholder="dilnoza@centre.uz" value={email} onChange={e => setEmail(e.target.value)} /></label>
      </div>
      <button className="primary-action" disabled={busy || !email || !name}>{busy ? "Adding…" : "Add administrator"}</button>
    </form>
  </section>;
}
