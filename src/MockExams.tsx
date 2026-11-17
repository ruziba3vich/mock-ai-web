import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { AdminFilter, AdminFilters, AdminHeading, useAdminScope, useSearch } from "./AdminResource";
import { Centre, centresAPI } from "./centres";
import type { ExamPaper } from "./examSession";
import { MockExam, mockExamAPI } from "./mockExam";

const message = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);
// The panel lives on panel.<site>; students use the site itself.
const site = window.location.host.replace(/^panel\./, "");
const PUBLIC = "public";

/**
 * A mock exam is the four sections saved as one, with no date: a student sits
 * it whenever they like. A centre's mock opens only from its invite link.
 * Platform staff also make public ones, which every student sees in their list.
 */
export default function MockExams() {
  const { admin } = useAdminScope();
  const platform = !!admin && !admin.centre_id;
  const [centres, setCentres] = useState<Centre[]>([]);
  // The centre a platform administrator is making a mock for; none means public.
  const [centre, setCentre] = useState("");
  const [search, setSearch] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [mocks, setMocks] = useState<MockExam[] | null>(null);
  const [papers, setPapers] = useState<ExamPaper[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ title: "", listening: "", reading: "", task1: "", task2: "" });
  const [copied, setCopied] = useState("");
  useEffect(() => { if (platform) centresAPI.list().then(setCentres).catch(() => undefined); }, [platform]);

  useEffect(() => {
    let live = true;
    mockExamAPI.list(centre || undefined)
      .then(result => { if (live) { setMocks(result.mocks ?? []); setPapers(result.papers ?? []); } })
      .catch(e => { if (live) setError(message(e, "Could not load the mock exams.")); });
    return () => { live = false; };
  }, [centre]);
  // Another owner has other papers, so the chosen ones no longer apply.
  function pickCentre(id: string) { setCentre(id); setPapers([]); setForm(f => ({ ...f, listening: "", reading: "", task1: "", task2: "" })); }

  const matching = useSearch(mocks ?? [], search, m => [m.title, m.code, m.centre_name]);
  const visible = matching.filter(m => ownerFilter === "all" || (m.centre_id || PUBLIC) === ownerFilter);
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm(f => ({ ...f, [key]: e.target.value }));
  const of = (skill: ExamPaper["skill"]) => papers.filter(p => p.skill === skill);
  const owner = platform ? centres.find(c => c.id === centre)?.name : undefined;

  async function create(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const created = await mockExamAPI.create({
        title: form.title, listening_exam_id: form.listening, reading_exam_id: form.reading,
        writing_task1_content_id: form.task1, writing_task2_content_id: form.task2,
      }, centre || undefined);
      setMocks(list => [created, ...(list ?? [])]);
      setForm(f => ({ ...f, title: "" }));
    } catch (e) { setError(message(e, "The mock exam could not be created.")); }
    finally { setBusy(false); }
  }

  async function remove(mock: MockExam) {
    if (!window.confirm(`Delete "${mock.title}"? Its link stops working. Results students already have are kept.`)) return;
    try { await mockExamAPI.remove(mock.id); setMocks(list => (list ?? []).filter(m => m.id !== mock.id)); }
    catch (e) { setError(message(e, "The mock exam could not be deleted.")); }
  }

  const linkOf = (mock: MockExam) => `https://${site}/?mock=${mock.code}`;
  async function copy(mock: MockExam) {
    try { await navigator.clipboard.writeText(linkOf(mock)); setCopied(mock.id); window.setTimeout(() => setCopied(""), 2000); }
    catch { setError(`Copy this link manually: ${linkOf(mock)}`); }
  }

  const ready = of("listening").length > 0 && of("reading").length > 0;
  return <div className="centres-admin">
    <AdminHeading title="Mock exams" description={platform
      ? "A mock exam is Listening, Reading, Writing and Speaking saved as one, with no date. A public mock is in every student's list. A centre's mock opens only from its invite link."
      : "A mock exam is Listening, Reading, Writing and Speaking saved as one, with no date. Anyone you send its invite link to can sit it at any time."} />
    {error && <div className="admin-listing"><p className="instruction-box" role="alert">{error}</p></div>}
    <section className="centre-new" aria-labelledby="mock-exam-new">
      <h2 id="mock-exam-new">Create a mock exam</h2>
      {platform && <div className="admin-columns">
        <label>Who can sit it<select value={centre} onChange={e => pickCentre(e.target.value)}><option value="">Public: every student</option>{centres.filter(c => !c.disabled).map(c => <option key={c.id} value={c.id}>{c.name}: by invite link</option>)}</select></label>
      </div>}
      {mocks && !ready
        ? <p className="centre-note">{platform
          ? `${owner ?? "The global library"} has no published Listening and Reading exam yet. ${owner ? "A centre's mock is built from the centre's own papers." : "A public mock is built from the global library."}`
          : "Publish one Listening and one Reading exam of your own first, in the Exams tab. They appear here once they are published."}</p>
        : <form onSubmit={create}>
          <div className="admin-columns">
            <label>Name<input required maxLength={120} placeholder="Mock 1" value={form.title} onChange={set("title")} /></label>
          </div>
          <div className="admin-columns">
            <label>Listening paper<select required value={form.listening} onChange={set("listening")}><option value="">Choose…</option>{of("listening").map(p => <option key={p.id} value={p.id}>{p.title}</option>)}</select></label>
            <label>Reading paper<select required value={form.reading} onChange={set("reading")}><option value="">Choose…</option>{of("reading").map(p => <option key={p.id} value={p.id}>{p.title}</option>)}</select></label>
          </div>
          <div className="admin-columns">
            <label>Writing Task 1<select value={form.task1} onChange={set("task1")}><option value="">Random for each student</option>{of("writing_task_1").map(p => <option key={p.id} value={p.id}>{p.title}</option>)}</select></label>
            <label>Writing Task 2<select value={form.task2} onChange={set("task2")}><option value="">Random for each student</option>{of("writing_task_2").map(p => <option key={p.id} value={p.id}>{p.title}</option>)}</select></label>
          </div>
          <p className="centre-note">{platform && !centre
            ? "Every student sees a public mock in their list and can start it at any time. Each student pays with their own stars."
            : "This mock is in nobody's list. Only people who open its invite link can sit it, and the link opens this mock alone. The centre pays the stars for each student who starts it."} Speaking is the AI interview.</p>
          <button className="primary-action" disabled={busy}>{busy ? "Creating…" : "Create the mock exam"}</button>
        </form>}
    </section>
    <div className="admin-listing exam-days">
      {!mocks && !error && <p className="admin-loading" role="status">Loading the mock exams…</p>}
      {!!mocks?.length && <AdminFilters label="Search mock exams" value={search} onChange={setSearch} placeholder={platform ? "Name, code or centre" : "Name or code"}
        count={`${visible.length} of ${mocks.length} mock exams`}>
        {platform && <AdminFilter label="Owner" value={ownerFilter} onChange={setOwnerFilter} options={[
          { value: "all", label: "All owners" }, { value: PUBLIC, label: "Public" }, ...centres.map(c => ({ value: c.id, label: c.name }))]} />}
      </AdminFilters>}
      {mocks?.length === 0 && <p className="centre-admin-empty">No mock exams yet. Create one above.</p>}
      {!!mocks?.length && visible.length === 0 && <p className="centre-admin-empty">No mock exams match these filters.</p>}
      {visible.map(mock => <section className="centre" key={mock.id} aria-label={mock.title}>
        <div className="centre-head">
          <div><h2>{mock.title}</h2><p>{mock.centre_id ? `${platform && mock.centre_name ? mock.centre_name + " · " : ""}By invite link only` : "Public · in every student's list"}</p></div>
          <button type="button" className="danger-link" aria-label={`Delete ${mock.title}`} onClick={() => void remove(mock)}>Delete</button>
        </div>
        <div className="centre-invite">
          <label>Invite link<input readOnly value={linkOf(mock)} onFocus={e => e.target.select()} /></label>
          <button type="button" className="secondary-action" onClick={() => void copy(mock)}>{copied === mock.id ? "Link copied" : "Copy invite link"}</button>
        </div>
        <dl className="centre-facts">
          <div><dt>Students who opened it</dt><dd>{mock.joined}</dd></div>
          <div><dt>Writing tasks</dt><dd>{mock.writing_task1_content_id && mock.writing_task2_content_id ? "Fixed" : mock.writing_task1_content_id || mock.writing_task2_content_id ? "One fixed, one random" : "Random for each student"}</dd></div>
        </dl>
      </section>)}
    </div>
  </div>;
}
