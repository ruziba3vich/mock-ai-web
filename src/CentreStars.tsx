import { FormEvent, useEffect, useState } from "react";
import { StarIcon } from "./icons";
import { APIError } from "./auth";
import { CentreStars as CentreStarsData, centreStarsAPI, creditLabel, CreditKind, formatMinor, newSpendReference, StarPurchase } from "./stars";

const KINDS: { kind: CreditKind; label: string }[] = [
  { kind: "star", label: "Stars (full mocks)" },
  { kind: "writing", label: "Writing checks" },
  { kind: "speaking", label: "Speaking interviews" },
];

function priceOf(d: CentreStarsData, kind: CreditKind) {
  return (kind === "writing" ? d.writing_price_minor : kind === "speaking" ? d.speaking_price_minor : d.price_per_star_minor) ?? 0;
}

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
  const [buyCount, setBuyCount] = useState("20");
  const [buyKind, setBuyKind] = useState<CreditKind>("star");
  const [grantKind, setGrantKind] = useState<CreditKind>("star");
  const [buying, setBuying] = useState(false);
  const [returned, setReturned] = useState<StarPurchase | null>(null);

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

  // Back from the payment page with ?purchase=<id>: follow it until settled.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("purchase");
    if (!id) return;
    let alive = true, tries = 0;
    async function poll() {
      try {
        const p = await centreStarsAPI.purchaseStatus(id!);
        if (!alive || !p) return;
        setReturned(p);
        if (p.status === "pending" && tries++ < 20) { window.setTimeout(poll, 2000); return; }
        if (p.status === "paid") { const fresh = await centreStarsAPI.get(centreID); if (alive && fresh) setData(fresh); }
        window.history.replaceState(null, "", window.location.pathname);
      } catch { /* the panel still works without the notice */ }
    }
    void poll();
    return () => { alive = false; };
  }, [centreID]);

  async function buy(event: FormEvent) {
    event.preventDefault();
    const stars = Number(buyCount);
    const max = data?.max_stars ?? 5000;
    if (!Number.isInteger(stars) || stars < 1 || stars > max) { setError(`Enter a whole number of stars between 1 and ${max}.`); return; }
    setBuying(true); setError("");
    try {
      const { checkout_url } = await centreStarsAPI.buy(centreID, stars, buyKind);
      window.location.assign(checkout_url);
    } catch (e) {
      setError(e instanceof APIError && e.status === 503 ? "Online payment is not available yet. Ask the platform team to add stars." : e instanceof Error ? e.message : "The payment could not be started.");
      setBuying(false);
    }
  }

  async function grant(event: FormEvent) {
    event.preventDefault();
    const stars = Number(amount);
    if (!Number.isInteger(stars) || stars < 1 || stars > 10000) { setError("Enter a whole number of stars between 1 and 10 000."); return; }
    setBusy(true); setError(""); setSaved("");
    try {
      setData(await centreStarsAPI.grant(centreID, stars, reference, note.trim(), grantKind));
      setSaved(`${creditLabel(grantKind, stars)} added.`);
      setNote(""); setReference(newSpendReference()); // the next grant is a new one
    } catch (e) {
      setError(e instanceof Error ? e.message : "The stars could not be added.");
    } finally { setBusy(false); }
  }

  const mocks = data ? Math.floor(data.balance / Math.max(1, data.full_mock_cost)) : 0;
  return <section className="centre centre-stars" aria-labelledby={`centre-stars-${centreID}`}>
    <div className="centre-head">
      <div>
        <h2 id={`centre-stars-${centreID}`}>Stars and practice checks</h2>
        <p>Students in this centre share these. A full mock takes a star; an AI-evaluated essay or AI interview in Practice takes a Writing check or Speaking interview.</p>
      </div>
      <div className="centre-stars-balance" aria-live="polite"><StarIcon /><strong>{data ? data.balance : "–"}</strong></div>
    </div>
    {returned && <p className={`centre-note purchase-notice ${returned.status}`} role="status">{
      returned.status === "paid" ? `Payment received: ${creditLabel(returned.kind, returned.stars)} added for your students.`
        : returned.status === "pending" ? "Confirming your payment… your stars appear as soon as it is confirmed."
          : "The payment didn't go through. Your balance hasn't changed; you can try again."}</p>}
    {error && <p className="instruction-box" role="alert">{error}</p>}
    {data && <div className="centre-balances">
      <span><b>{data.balance}</b> star{data.balance === 1 ? "" : "s"}</span>
      <span><b>{data.writing_balance ?? 0}</b> Writing check{(data.writing_balance ?? 0) === 1 ? "" : "s"}</span>
      <span><b>{data.speaking_balance ?? 0}</b> Speaking interview{(data.speaking_balance ?? 0) === 1 ? "" : "s"}</span>
    </div>}
    {data && <p className="centre-note">{data.balance > 0 ? `Enough for ${mocks} full mock${mocks === 1 ? "" : "s"}.` : "No stars left — students cannot start a full mock until stars are added. Practice stays open."}</p>}

    {data?.can_buy && (data.payments_available && data.price_per_star_minor ? <form className="centre-stars-grant centre-stars-buy" onSubmit={e => void buy(e)}>
      <label>Buy<select value={buyKind} onChange={e => setBuyKind(e.target.value as CreditKind)} aria-label="What to buy">{KINDS.map(k => <option key={k.kind} value={k.kind}>{k.label}</option>)}</select></label>
      <label>How many<input type="number" inputMode="numeric" min={1} max={data.max_stars ?? 5000} step={1} value={buyCount} onChange={e => setBuyCount(e.target.value)} required aria-label="How many to buy" /></label>
      <div className="centre-stars-total"><span>{formatMinor(priceOf(data, buyKind), data.currency)} each</span><strong>{Number(buyCount) > 0 ? formatMinor(Number(buyCount) * priceOf(data, buyKind), data.currency) : "–"}</strong></div>
      <button className="primary-action" disabled={buying}>{buying ? "Opening payment…" : "Pay and add stars"}</button>
    </form> : <p className="centre-note">Online payment for centres is coming soon. Until then the platform team adds stars for you.</p>)}

    {data?.can_grant && <form className="centre-stars-grant" onSubmit={e => void grant(e)}>
      <label>Add<select value={grantKind} onChange={e => setGrantKind(e.target.value as CreditKind)} aria-label="What to add">{KINDS.map(k => <option key={k.kind} value={k.kind}>{k.label}</option>)}</select></label>
      <label>How many<input aria-label="How many to add" type="number" inputMode="numeric" min={1} max={10000} step={1} value={amount} onChange={e => setAmount(e.target.value)} required /></label>
      <label>Note <small>(optional)</small><input value={note} maxLength={200} placeholder="e.g. Invoice 17, paid by bank transfer" onChange={e => setNote(e.target.value)} /></label>
      <button className="primary-action" disabled={busy}>{busy ? "Adding…" : "Add"}</button>
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

function describe(e: { reason: string; kind?: CreditKind; delta: number; student_name?: string }) {
  const what = creditLabel(e.kind, Math.abs(e.delta));
  switch (e.reason) {
    case "full_mock": return `${e.student_name || "A student"} started a full mock`;
    case "writing_check": return `${e.student_name || "A student"} used a Writing check`;
    case "speaking_interview": return `${e.student_name || "A student"} used a Speaking interview`;
    case "grant": return `${what} added`;
    case "purchase": return `${what} bought`;
    case "refund": return "Refund";
    default: return e.reason;
  }
}
