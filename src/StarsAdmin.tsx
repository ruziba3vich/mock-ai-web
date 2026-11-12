import { FormEvent, useEffect, useState } from "react";
import { AdminHeading } from "./AdminResource";
import { creditLabel, formatMinor, StarsAdmin as StarsAdminData, starsAdminAPI } from "./stars";

/**
 * Platform administrators: what one star costs, and every recent purchase.
 * Students and centres buy any number of stars at this price.
 */
export default function StarsAdmin() {
  const [data, setData] = useState<StarsAdminData | null>(null);
  const [price, setPrice] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const loaded = await starsAdminAPI.get();
        if (alive && loaded) { setData(loaded); setPrice(String(Math.round(loaded.pricing.price_per_star_minor / 100))); }
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "Could not load pricing.");
      }
    })();
    return () => { alive = false; };
  }, []);

  const som = Number(price.replace(/\s/g, "")) || 0;

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!Number.isInteger(som) || som < 1000 || som > 10_000_000) { setError("Enter a whole number of so'm between 1 000 and 10 000 000."); return; }
    setBusy(true); setError(""); setSaved("");
    try {
      const pricing = await starsAdminAPI.setPrice(som * 100);
      setData(d => d ? { ...d, pricing } : d);
      setSaved(`Saved. One star costs ${formatMinor(pricing.price_per_star_minor, pricing.currency)}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The price could not be saved.");
    } finally { setBusy(false); }
  }

  return <div className="centres-admin stars-admin">
    <AdminHeading title="Pricing" description="What students and learning centres pay for one star." />
    <div className="admin-listing">
      {error && <p className="instruction-box" role="alert">{error}</p>}
      <section className="centre">
        <div className="centre-head">
          <div>
            <h2>Price per star</h2>
            <p>Listening 5 stars, Reading 5, AI-marked Writing 10, AI Speaking interview 15. Changing the price affects new purchases only; a payment already started keeps its price.</p>
          </div>
          {data && <span className={`stars-sales ${data.payments_available ? "on" : "off"}`}>{data.payments_available ? `Selling via ${data.provider}` : "Sales closed"}</span>}
        </div>
        <form className="stars-price-grid" onSubmit={e => void save(e)}>
          <label>
            <span className="price-label">One star</span>
            <span className="stars-price-input"><input inputMode="numeric" value={price} onChange={e => setPrice(e.target.value)} aria-label="Price of one star in so'm" required /><span>so'm</span></span>
            {som >= 1000 && <small className="price-preview">A full four-skill mock (35 stars) costs {formatMinor(som * 3500)}</small>}
          </label>
          <button className="primary-action" disabled={busy || !data}>{busy ? "Saving…" : "Save price"}</button>
        </form>
        {saved && <p className="centre-stars-saved" role="status">{saved}</p>}
      </section>

      <section className="centre">
        <div className="centre-head"><div><h2>Recent purchases</h2><p>Stars are added only after the payment provider confirms the payment.</p></div></div>
        {data && (data.purchases.length ? <ol className="centre-stars-activity stars-purchases">
          {data.purchases.map(p => <li key={p.id}>
            <span className={`purchase-status ${p.status}`}>{statusLabel(p.status)}</span>
            <span className="what">{p.buyer || (p.buyer_kind === "centre" ? "A centre" : "A student")} · {creditLabel(p.kind, p.stars)}<small>{p.buyer_kind === "centre" ? "Learning centre" : "Student"} · {formatMinor(p.amount_minor, p.currency)}</small></span>
            <time dateTime={p.created_at}>{new Date(p.created_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</time>
          </li>)}
        </ol> : <p className="admin-loading">No purchases yet.</p>)}
      </section>
    </div>
  </div>;
}

function statusLabel(status: string) {
  return status === "paid" ? "Paid" : status === "pending" ? "Waiting" : status === "failed" ? "Failed" : "Cancelled";
}
