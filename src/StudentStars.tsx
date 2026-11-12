import { FormEvent, useEffect, useState } from "react";
import { APIError } from "./auth";
import { newSpendReference, starsLabel, StudentStars as StudentStarsData, studentStarsAPI } from "./stars";

/**
 * A student's own stars, in the student sheet. Platform administrators add
 * to them here; for a centre administrator the API answers 403 and the
 * section stays hidden.
 */
export default function StudentStars({ userID }: { userID: string }) {
  const [data, setData] = useState<StudentStarsData | null>(null);
  const [hidden, setHidden] = useState(false);
  const [error, setError] = useState("");
  const [amount, setAmount] = useState("35");
  const [note, setNote] = useState("");
  const [reference, setReference] = useState(newSpendReference);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState("");

  useEffect(() => {
    let alive = true;
    setData(null); setError(""); setSaved(""); setHidden(false);
    studentStarsAPI.get(userID).then(d => alive && setData(d)).catch(e => {
      if (!alive) return;
      if (e instanceof APIError && e.status === 403) setHidden(true);
      else setError("This student's stars could not be loaded.");
    });
    return () => { alive = false; };
  }, [userID]);

  async function grant(event: FormEvent) {
    event.preventDefault();
    const count = Number(amount);
    if (!Number.isInteger(count) || count < 1 || count > 10000) { setError("Enter a whole number between 1 and 10 000."); return; }
    setBusy(true); setError(""); setSaved("");
    try {
      setData(await studentStarsAPI.grant(userID, count, reference, note.trim()));
      setSaved(`${starsLabel(count)} added.`);
      setNote(""); setReference(newSpendReference()); // the next grant is a new one
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nothing was added. Try again.");
    } finally { setBusy(false); }
  }

  if (hidden) return null;
  return <section className="student-detail-section" aria-labelledby={`student-stars-${userID}`}>
    <h3 id={`student-stars-${userID}`}>Stars</h3>
    {error && <p className="instruction-box" role="alert">{error}</p>}
    {data ? <>
      <p className="centre-note" aria-live="polite">This student has <b>{starsLabel(data.balance)}</b> of their own.</p>
      {data.centre_name && <p className="centre-note">This student is in {data.centre_name}, which pays for their mocks and checks. What you add here is used only if they leave the centre.</p>}
      <form className="centre-stars-grant" onSubmit={e => void grant(e)}>
        <label>Stars to add<input aria-label="How many to add" type="number" inputMode="numeric" min={1} max={10000} step={1} value={amount} onChange={e => setAmount(e.target.value)} required /></label>
        <label>Note <small>(optional)</small><input value={note} maxLength={200} placeholder="e.g. Compensation for a failed check" onChange={e => setNote(e.target.value)} /></label>
        <button className="primary-action" disabled={busy}>{busy ? "Adding…" : "Add"}</button>
        {saved && <span className="centre-stars-saved" role="status">{saved}</span>}
      </form>
    </> : !error && <p role="status">Loading stars…</p>}
  </section>;
}
