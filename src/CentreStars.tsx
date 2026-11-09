import { FormEvent, useEffect, useState } from "react";
import { StarIcon } from "./icons";
import { CentreStars as CentreStarsData, centreStarsAPI, newSpendReference, starsLabel } from "./stars";

/**
 * A learning centre's shared stars, in the admin panel.
 *
 * The centre's students spend these on full mocks instead of personal stars.
 * Centre administrators see the balance and who used it; platform
 * administrators also top it up here until centres can pay online.
 */
export default function CentreStars({ centreID }: { centreID: string }) {
  const [data, setData] = useState<CentreStarsData | null>(null);
  const [error, setError] = useState("");
  const [amount, setAmount] = useState("10");
  const [note, setNote] = useState("");
  const [reference, setReference] = useState(newSpendReference);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState("");

  useEffect(() => {
    let alive = true;
    setData(null); setError("");
    (async () => {
      try {
        const loaded = await centreStarsAPI.get(centreID);
        if (alive && loaded) setData(loaded);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "Could not load this centre's stars.");
      }
    })();
    return () => { alive = false; };
  }, [centreID]);

  async function grant(event: FormEvent) {
    event.preventDefault();
    const stars = Number(amount);
    if (!Number.isInteger(stars) || stars < 1 || stars > 10000) { setError("Enter a whole number of stars between 1 and 10 000."); return; }
    setBusy(true); setError(""); setSaved("");
    try {
      setData(await centreStarsAPI.grant(centreID, stars, reference, note.trim()));
      setSaved(`${starsLabel(stars)} added.`);
      setNote(""); setReference(newSpendReference()); // the next grant is a new one
    } catch (e) {
      setError(e instanceof Error ? e.message : "The stars could not be added.");
    } finally { setBusy(false); }
  }

  const mocks = data ? Math.floor(data.balance / Math.max(1, data.full_mock_cost)) : 0;
  return <section className="centre centre-stars" aria-labelledby={`centre-stars-${centreID}`}>
    <div className="centre-head">
      <div>
        <h2 id={`centre-stars-${centreID}`}>Stars</h2>
        <p>Students in this centre share these stars: each full mock a student starts takes one.</p>
      </div>
      <div className="centre-stars-balance" aria-live="polite"><StarIcon /><strong>{data ? data.balance : "–"}</strong></div>
    </div>
    {error && <p className="instruction-box" role="alert">{error}</p>}
    {data && <p className="centre-note">{data.balance > 0 ? `Enough for ${mocks} full mock${mocks === 1 ? "" : "s"}.` : "No stars left — students cannot start a full mock until stars are added. Practice stays open."}</p>}

    {data?.can_grant && <form className="centre-stars-grant" onSubmit={e => void grant(e)}>
      <label>Add stars<input type="number" inputMode="numeric" min={1} max={10000} step={1} value={amount} onChange={e => setAmount(e.target.value)} required /></label>
      <label>Note <small>(optional)</small><input value={note} maxLength={200} placeholder="e.g. Invoice 17, paid by bank transfer" onChange={e => setNote(e.target.value)} /></label>
      <button className="primary-action" disabled={busy}>{busy ? "Adding…" : "Add stars"}</button>
      {saved && <span className="centre-stars-saved" role="status">{saved}</span>}
    </form>}

    {data && (data.activity.length ? <ol className="centre-stars-activity">
      {data.activity.map(e => <li key={e.id}>
        <span className={`delta ${e.delta > 0 ? "plus" : "minus"}`}>{e.delta > 0 ? `+${e.delta}` : e.delta}</span>
        <span className="what">{describe(e)}{e.note && <small>{e.note}</small>}</span>
        <time dateTime={e.created_at}>{new Date(e.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</time>
      </li>)}
    </ol> : <p className="admin-loading">No star activity yet.</p>)}
  </section>;
}

function describe(e: { reason: string; student_name?: string }) {
  switch (e.reason) {
    case "full_mock": return `${e.student_name || "A student"} started a full mock`;
    case "grant": return "Stars added";
    case "purchase": return "Stars bought";
    case "refund": return "Refund";
    default: return e.reason;
  }
}
