import { useEffect, useState } from "react";
import { Centre, centresAPI } from "./centres";
import { AdminHeading } from "./AdminResource";
import CentreStars from "./CentreStars";

/**
 * A centre administrator's view of their own centre.
 *
 * There is exactly one of these, so it is the other tab with no list: a centre
 * admin cannot see the centre list or change how their centre is configured --
 * that is the platform operator's job. A centre has no students of its own, so
 * there is no centre invite: each exam day and each mock has its own link.
 */
export default function MyCentre() {
  const [centre, setCentre] = useState<Centre | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    centresAPI.mine().then(setCentre).catch(e =>
      setError(e instanceof Error ? e.message : "Could not load your centre."));
  }, []);

  // The heading holds its place while the centre loads or fails, so the tab is
  // never a bare error message on an otherwise empty screen.
  if (!centre) return <div className="centres-admin">
    <AdminHeading title="Your centre" description="How your centre is set up, and its stars." />
    {error
      ? <div className="admin-listing"><p className="instruction-box" role="alert">{error}</p></div>
      : <div className="admin-listing"><p className="admin-loading" role="status">Loading your centre…</p></div>}
  </div>;

  return <div className="centres-admin">
    <AdminHeading title={centre.name} description="Any student can sit your exams: share the link of an exam day or a mock. Your centre pays the stars for them." />
    <div className="admin-listing">
      <section className="centre">
        <div className="centre-head">
          <div>
            <h2>Inviting students</h2>
            <p>Students do not join your centre. Under <strong>Exam day</strong> and <strong>Mock exams</strong>, each exam has its own invite link. Whoever opens it sits that exam and appears in your Students list.</p>
          </div>
        </div>
        <dl className="centre-facts">
          <div><dt>Students</dt><dd>{centre.students}</dd></div>
          <div><dt>Your exams</dt><dd>{centre.exams}</dd></div>
          <div><dt>Marking</dt><dd>{centre.ai_enabled ? "AI" : "Your teachers"}</dd></div>
        </dl>
        {!centre.ai_enabled && <p className="centre-note">Writing and Speaking are marked by your staff under <strong>Marking</strong>. Nothing your students produce is sent to a model.</p>}
        {centre.disabled && <p className="centre-note">This centre is closed: its exam links do not open.</p>}
      </section>
      <CentreStars centreID={centre.id} />
    </div>
  </div>;
}
