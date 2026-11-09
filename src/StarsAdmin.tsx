import { FormEvent, useEffect, useState } from "react";
import { AdminHeading } from "./AdminResource";
import { creditLabel, formatMinor, StarsAdmin as StarsAdminData, starsAdminAPI } from "./stars";

type PriceKey = "price_per_star_minor" | "writing_price_minor" | "speaking_price_minor";
const PRICES: { key: PriceKey; label: string; hint: string }[] = [
  { key: "price_per_star_minor", label: "Full mock (1 star)", hint: "All four skills, scored together" },
  { key: "writing_price_minor", label: "Writing check", hint: "One AI-evaluated essay in Practice" },
  { key: "speaking_price_minor", label: "Speaking interview", hint: "One AI-assessed interview in Practice" },
];

/**
 * Platform administrators: what a full mock, a Writing check and a Speaking
 * interview cost, and every recent purchase. Student packages and centre
 * purchases are priced from these at the moment someone buys.
 */
export default function StarsAdmin() {
  const [data, setData] = useState<StarsAdminData | null>(null);
  const [prices, setPrices] = useState<Record<PriceKey, string>>({ price_per_star_minor: "", writing_price_minor: "", speaking_price_minor: "" });
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const loaded = await starsAdminAPI.get();
        if (alive && loaded) {
          setData(loaded);
          setPrices({
            price_per_star_minor: String(Math.round(loaded.pricing.price_per_star_minor / 100)),
            writing_price_minor: String(Math.round((loaded.pricing.writing_price_minor ?? 0) / 100)),
            speaking_price_minor: String(Math.round((loaded.pricing.speaking_price_minor ?? 0) / 100)),
          });
        }
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "Could not load pricing.");
      }
    })();
    return () => { alive = false; };
  }, []);

  const som = (key: PriceKey) => Number(prices[key].replace(/\s/g, "")) || 0;

  async function save(event: FormEvent) {
    event.preventDefault();
    for (const p of PRICES) {
      const v = som(p.key);
      if (!Number.isInteger(v) || v < 1000 || v > 10_000_000) { setError(`${p.label}: enter a whole number of so'm between 1 000 and 10 000 000.`); return; }
    }
    setBusy(true); setError(""); setSaved("");
    try {
      const pricing = await starsAdminAPI.setPrices({
        price_per_star_minor: som("price_per_star_minor") * 100,
        writing_price_minor: som("writing_price_minor") * 100,
        speaking_price_minor: som("speaking_price_minor") * 100,
      });
      setData(d => d ? { ...d, pricing } : d);
      setSaved(`Saved. A full mock costs ${formatMinor(pricing.price_per_star_minor, pricing.currency)}, a Writing check ${formatMinor(pricing.writing_price_minor, pricing.currency)} and a Speaking interview ${formatMinor(pricing.speaking_price_minor, pricing.currency)}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The prices could not be saved.");
    } finally { setBusy(false); }
  }

  return <div className="centres-admin stars-admin">
    <AdminHeading title="Pricing" description="What students and learning centres pay for full mocks and for AI-marked practice." />
    <div className="admin-listing">
      {error && <p className="instruction-box" role="alert">{error}</p>}
      <section className="centre">
        <div className="centre-head">
          <div>
            <h2>Prices</h2>
            <p>Changing a price affects new purchases only; a payment already started keeps its price.</p>
          </div>
          {data && <span className={`stars-sales ${data.payments_available ? "on" : "off"}`}>{data.payments_available ? `Selling via ${data.provider}` : "Sales closed"}</span>}
        </div>
        <form className="stars-price-grid" onSubmit={e => void save(e)}>
          {PRICES.map(p => <label key={p.key}>
            <span className="price-label">{p.label}<small>{p.hint}</small></span>
            <span className="stars-price-input"><input inputMode="numeric" value={prices[p.key]} onChange={e => setPrices(v => ({ ...v, [p.key]: e.target.value }))} aria-label={`${p.label} price in so'm`} required /><span>so'm</span></span>
            {som(p.key) >= 1000 && <small className="price-preview">5 for {formatMinor(som(p.key) * 500)} · 10 for {formatMinor(som(p.key) * 1000)}</small>}
          </label>)}
          <button className="primary-action" disabled={busy || !data}>{busy ? "Saving…" : "Save prices"}</button>
        </form>
        {saved && <p className="centre-stars-saved" role="status">{saved}</p>}
      </section>

      <section className="centre">
        <div className="centre-head"><div><h2>Recent purchases</h2><p>Credits are added only after the payment provider confirms the payment.</p></div></div>
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
