import { FormEvent, useEffect, useState } from "react";
import { AdminHeading } from "./AdminResource";
import { formatMinor, StarsAdmin as StarsAdminData, starsAdminAPI } from "./stars";

/**
 * Platform administrators: the price of one star (one full mock) and every
 * recent purchase. Packages on the student Stars page and centre purchases
 * are priced from this number at the moment someone buys.
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

  async function save(event: FormEvent) {
    event.preventDefault();
    const som = Number(price.replace(/\s/g, ""));
    if (!Number.isInteger(som) || som < 1000 || som > 10_000_000) { setError("Enter a whole number of so'm between 1 000 and 10 000 000."); return; }
    setBusy(true); setError(""); setSaved("");
    try {
      const pricing = await starsAdminAPI.setPrice(som * 100);
      setData(d => d ? { ...d, pricing } : d);
      setSaved(`Saved. One full mock now costs ${formatMinor(pricing.price_per_star_minor, pricing.currency)}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The price could not be saved.");
    } finally { setBusy(false); }
  }

  const som = Number(price.replace(/\s/g, "")) || 0;
  return <div className="centres-admin stars-admin">
    <AdminHeading title="Pricing" description="The price of one star. A star is one full IELTS mock, for students and learning centres alike." />
    <div className="admin-listing">
      {error && <p className="instruction-box" role="alert">{error}</p>}
      <section className="centre">
        <div className="centre-head">
          <div>
            <h2>Price of one full mock</h2>
            <p>Changing it affects new purchases only; a payment already started keeps its price.</p>
          </div>
          {data && <span className={`stars-sales ${data.payments_available ? "on" : "off"}`}>{data.payments_available ? `Selling via ${data.provider}` : "Sales closed"}</span>}
        </div>
        <form className="stars-price-form" onSubmit={e => void save(e)}>
          <label>Price in so'm
            <span className="stars-price-input"><input inputMode="numeric" value={price} onChange={e => setPrice(e.target.value)} aria-label="Price in so'm" required /><span>so'm</span></span>
          </label>
          <button className="primary-action" disabled={busy || !data}>{busy ? "Saving…" : "Save price"}</button>
        </form>
        {saved && <p className="centre-stars-saved" role="status">{saved}</p>}
        {som >= 1000 && <dl className="centre-facts">
          <div><dt>1 mock</dt><dd>{formatMinor(som * 100)}</dd></div>
          <div><dt>5 mocks</dt><dd>{formatMinor(som * 500)}</dd></div>
          <div><dt>10 mocks</dt><dd>{formatMinor(som * 1000)}</dd></div>
          <div><dt>50 for a centre</dt><dd>{formatMinor(som * 5000)}</dd></div>
        </dl>}
      </section>

      <section className="centre">
        <div className="centre-head"><div><h2>Recent purchases</h2><p>Stars are added only after the payment provider confirms the payment.</p></div></div>
        {data && (data.purchases.length ? <ol className="centre-stars-activity stars-purchases">
          {data.purchases.map(p => <li key={p.id}>
            <span className={`purchase-status ${p.status}`}>{statusLabel(p.status)}</span>
            <span className="what">{p.buyer || (p.buyer_kind === "centre" ? "A centre" : "A student")} · {p.stars} star{p.stars === 1 ? "" : "s"}<small>{p.buyer_kind === "centre" ? "Learning centre" : "Student"} · {formatMinor(p.amount_minor, p.currency)}</small></span>
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
