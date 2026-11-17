import { useEffect, useMemo, useState } from "react";
import { Centre, centresAPI } from "./centres";
import CentreAdmins from "./CentreAdmins";
import CentreStars from "./CentreStars";
import { AdminFilter, AdminFilters, AdminHeading, AdminSheet, AdminTable, StatusChip, useAdminScope, useSearch } from "./AdminResource";

/**
 * Learning centres, for platform administrators only.
 *
 * A centre has no students of its own: a student joins one of its exam days or
 * opens one of its mock links, so there is no centre invite here.
 *
 * Adding a centre is a sheet rather than a form parked above the list. The
 * form used to sit between the heading and the centres, so the screen opened
 * on "add a centre" when the thing being asked for is almost always one of
 * the centres that already exist.
 */
export default function CentresAdmin() {
  const { can } = useAdminScope();
  const mayManage = can("centres");
  const [centres, setCentres] = useState<Centre[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [creating, setCreating] = useState(false);
  const [openID, setOpenID] = useState("");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [aiEnabled, setAiEnabled] = useState(true);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");

  async function load() {
    try {
      setCentres(await centresAPI.list());
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not load learning centres.");
    } finally {
      setLoaded(true);
    }
  }
  useEffect(() => { void load(); }, []);

  async function create() {
    setBusy(true); setMessage("");
    try {
      const centre = await centresAPI.create(name, slug, true, aiEnabled);
      setName(""); setSlug(""); setAiEnabled(true);
      setCreating(false);
      setMessage(`${centre.name} is ready. Open it to add its administrators and stars.`);
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not create the centre.");
    } finally { setBusy(false); }
  }

  async function change(centre: Centre, patch: Partial<Centre>) {
    setBusy(true); setMessage("");
    const previous = centres;
    setCentres(centres.map(v => (v.id === centre.id ? { ...v, ...patch } : v)));
    try {
      await centresAPI.update({ ...centre, ...patch });
      await load();
    } catch (e) {
      setCentres(previous);
      setMessage(e instanceof Error ? e.message : "Could not save the centre.");
    } finally { setBusy(false); }
  }

  const matching = useSearch(centres, query, centre => [centre.name, centre.slug, centre.join_code]);
  const filtered = useMemo(() => matching.filter(centre =>
    status === "all" || (status === "open" ? !centre.disabled : centre.disabled)), [matching, status]);
  const open = centres.find(centre => centre.id === openID);

  return <div className="centres-admin">
    <AdminHeading title="Learning centres"
      description="Each centre keeps its own exams and content and pays for the exams it runs. A student belongs to no centre: they join a centre's exam day or open its mock link."
      action={mayManage ? <button className="primary-action" onClick={() => { setCreating(true); setMessage(""); }}>Create centre</button> : undefined} />
    {message && !creating && !open && <p className="instruction-box" role="status">{message}</p>}

    <div className="admin-listing">
      <AdminFilters label="Search centres" value={query} onChange={setQuery} placeholder="Name, short name or code"
        count={`${filtered.length} of ${centres.length} centres`}>
        <AdminFilter label="Status" value={status} onChange={setStatus} options={[
          { value: "all", label: "All centres" },
          { value: "open", label: "Open" },
          { value: "closed", label: "Closed" }]} />
      </AdminFilters>
      <AdminTable label="Learning centres" noun="centres" action={mayManage ? "Manage" : "View"}
        columns={[
          { key: "name", label: "Centre", width: "minmax(200px,2fr)" },
          { key: "students", label: "Students", width: "100px" },
          { key: "exams", label: "Exams", width: "90px" },
          { key: "marking", label: "Marking", width: "minmax(120px,1fr)" },
          { key: "status", label: "Status", width: "150px" }]}
        rows={filtered.map(centre => ({
          id: centre.id,
          openLabel: `${mayManage ? "Manage" : "View"} ${centre.name}`,
          selected: openID === centre.id,
          open: () => { setMessage(""); setOpenID(centre.id); },
          cells: [
            <span><strong>{centre.name}</strong><small className="admin-cell-note">{centre.slug}</small></span>,
            centre.students,
            centre.exams,
            centre.ai_enabled ? "AI marking" : "By the centre",
            centre.disabled ? <StatusChip status="archived">Closed</StatusChip> : <StatusChip status="published">Open</StatusChip>],
        }))}
        empty={loaded
          ? (centres.length ? "No centres match these filters." : "No centres yet.")
          : "Loading centres…"} />
    </div>

    {open && <AdminSheet title={open.name}
      subtitle={`${open.students} ${open.students === 1 ? "student" : "students"} · ${open.exams} ${open.exams === 1 ? "exam" : "exams"} · ${open.ai_enabled ? "AI marking" : "marked by the centre"}`}
      onClose={() => setOpenID("")}
      footer={<><span className="admin-sheet-spacer" /><button className="secondary-action" onClick={() => setOpenID("")}>Close</button></>}>
      {message && <p className="instruction-box" role="status">{message}</p>}
      <p className="centre-note">Students here are those who joined one of {open.name}'s exam days or opened one of its mock links. The centre pays the stars for those exams.</p>
      {mayManage && <div className="centre-controls">
        <label className="centre-toggle">
          <input type="checkbox" checked={open.ai_enabled} disabled={busy}
            onChange={e => void change(open, { ai_enabled: e.target.checked })} />
          <span>AI marking<small>Turn this off and nothing the centre produces is sent to a model.</small></span>
        </label>
        <button type="button" className="danger-link" disabled={busy}
          onClick={() => void change(open, { disabled: !open.disabled })}>
          {open.disabled ? "Reopen this centre" : "Close this centre"}
        </button>
      </div>}
      <CentreStars centreID={open.id} />
      <CentreAdmins centre={open} />
    </AdminSheet>}

    {creating && <AdminSheet title="Add a centre" subtitle="A name, a short name for its links, and how its exams are marked."
      onClose={() => setCreating(false)}>
      {message && <p className="instruction-box" role="status">{message}</p>}
      <form className="centre-new" onSubmit={e => { e.preventDefault(); void create(); }}>
        <div className="admin-columns">
          <label>Centre name<input required maxLength={120} placeholder="Oxford Study Centre" value={name}
            onChange={e => {
              setName(e.target.value);
              // Offer a slug until the operator types their own, so the common
              // case is one field rather than two.
              if (!slug || slug === suggest(name)) setSlug(suggest(e.target.value));
            }} /></label>
          <label>Short name in links<input required pattern="[a-z0-9][a-z0-9-]{1,38}[a-z0-9]" placeholder="oxford-study"
            value={slug} onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} /></label>
        </div>
        <label className="centre-toggle">
          <input type="checkbox" checked={aiEnabled} onChange={e => setAiEnabled(e.target.checked)} />
          <span>Use AI marking and the speaking examiner<small>Turn this off and nothing the centre produces is sent to a model: essays and recordings are captured for the centre to mark itself, the speaking interview is read on screen rather than spoken, and importing a paper from PDF is closed. Reading and Listening are scored from the answer key either way.</small></span>
        </label>
        <div className="marking-actions">
          <button type="button" className="secondary-action" disabled={busy} onClick={() => setCreating(false)}>Cancel</button>
          <button className="primary-action" disabled={busy || !name || !slug}>{busy ? "Adding…" : "Add centre"}</button>
        </div>
      </form>
    </AdminSheet>}
  </div>;
}

/** A url-safe short name derived from what the operator is already typing. */
function suggest(name: string) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
}
