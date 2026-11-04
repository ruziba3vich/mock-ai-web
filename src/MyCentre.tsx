import { useEffect, useState } from "react";
import { Centre, centresAPI, inviteLink } from "./centres";

const BOT = (import.meta.env.VITE_TELEGRAM_BOT as string | undefined) || "mockai_bot";

/**
 * A centre administrator's view of their own centre.
 *
 * They cannot see the centre list or change how their centre is configured --
 * that is the platform operator's job. What they do need is the invite link,
 * because without it they cannot onboard a single student, and a plain reading
 * of how their centre is set up so the app's behaviour is not a mystery.
 */
export default function MyCentre() {
  const [centre, setCentre] = useState<Centre | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    centresAPI.mine().then(setCentre).catch(e =>
      setError(e instanceof Error ? e.message : "Could not load your centre."));
  }, []);

  if (error) return <div className="centres-admin"><header className="admin-page-heading"><h1>Your centre</h1></header><p className="instruction-box" role="alert">{error}</p></div>;
  if (!centre) return <div className="centres-admin"><header className="admin-page-heading"><h1>Your centre</h1></header></div>;

  const link = inviteLink(centre, BOT);
  return <div className="centres-admin">
    <header className="admin-page-heading">
      <h1>{centre.name}</h1>
      <p>Everything your students practise comes from your centre{centre.include_global ? " and the shared library" : " alone"}.</p>
    </header>
    <section className="centre">
      <div className="centre-head">
        <div>
          <h2>Invite your students</h2>
          <p>Send this link. Opening it puts a student in your centre and signs them in — no account to create, no password to reset.</p>
        </div>
      </div>
      <div className="centre-invite">
        <label>Invite link<input readOnly value={link} onFocus={e => e.target.select()} /></label>
        <button type="button" className="secondary-action" onClick={async () => {
          try {
            await navigator.clipboard.writeText(link);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
          } catch {
            setError(`Copy this link manually: ${link}`);
          }
        }}>{copied ? "Copied" : "Copy"}</button>
      </div>
      <dl className="centre-facts">
        <div><dt>Students</dt><dd>{centre.students}</dd></div>
        <div><dt>Your exams</dt><dd>{centre.exams}</dd></div>
        <div><dt>Shared library</dt><dd>{centre.include_global ? "Included" : "Your material only"}</dd></div>
        <div><dt>Marking</dt><dd>{centre.ai_enabled ? "AI" : "Your teachers"}</dd></div>
      </dl>
      {!centre.ai_enabled && <p className="centre-note">Writing and Speaking are marked by your staff under <strong>Marking</strong>. Nothing your students produce is sent to a model.</p>}
      {centre.disabled && <p className="centre-note">This centre is closed to new students. Existing students are unaffected.</p>}
    </section>
  </div>;
}
