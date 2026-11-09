import { useEffect, useRef, useState } from "react";
import { APIError } from "./auth";
import { StarIcon, CheckIcon } from "./icons";
import { StarsArt } from "./illustrations";
import { formatPrice, StarPackage, StarPurchase, starsAPI, starsLabel, StarsOverview } from "./stars";

type Props = {
  overview: StarsOverview | null;
  /** Set when the student was sent here because they ran out of stars. */
  outOfStars?: boolean;
  onRefresh: () => Promise<void>;
  onStartMock: () => void;
};

export default function StarsPage({ overview, outOfStars, onRefresh, onStartMock }: Props) {
  const [buying, setBuying] = useState<string | null>(null);
  const [comingSoon, setComingSoon] = useState(false);
  const [error, setError] = useState("");
  const returned = useReturnedPurchase(onRefresh);
  const balance = overview?.balance ?? 0;
  const cost = overview?.full_mock_cost ?? 1;
  const centre = overview?.source === "centre" ? (overview.centre_name || "your learning centre") : null;

  async function buy(pkg: StarPackage) {
    setError("");
    if (!overview?.payments_available || !pkg.amount_minor) { setComingSoon(true); return; }
    setBuying(pkg.id);
    try {
      const { checkout_url } = await starsAPI.purchase(pkg.stars);
      window.location.assign(checkout_url);
    } catch (caught) {
      if (caught instanceof APIError && caught.status === 503) setComingSoon(true);
      else setError(caught instanceof Error ? caught.message : "The payment could not be started.");
      setBuying(null);
    }
  }

  return <div className="content page-content stars-page">
    <header className="page-header">
      <div className="page-art"><StarsArt /></div>
      <h1>Stars</h1>
      <p>{centre
        ? <>Your stars are provided by <strong>{centre}</strong>. Each full mock you start uses one of the centre's stars.</>
        : "One star lets you sit one full IELTS mock exam: Listening, Reading, Writing and Speaking, scored together."}</p>
    </header>

    {returned && <PurchaseNotice purchase={returned} />}
    {outOfStars && balance < cost && !returned && (centre
      ? <div className="stars-notice warn" role="status"><StarIcon /><div><strong>Your centre has run out of stars</strong><span>Ask {centre} to add more so you can start a full mock. Practice tests stay free.</span></div></div>
      : <div className="stars-notice warn" role="status"><StarIcon /><div><strong>You've used all your stars</strong><span>Get more stars to start another full mock. Practice tests stay free.</span></div></div>)}
    {error && <div className="form-error" role="alert">{error}</div>}

    <section className="stars-balance">
      <div className="stars-balance-figure"><StarIcon /><strong>{overview ? balance : "–"}</strong></div>
      <div className="stars-balance-copy">
        <h2>{!overview ? "Loading your stars…" : centre ? `${centre} has ${starsLabel(balance)}` : `You have ${starsLabel(balance)}`}</h2>
        <p>{centre
          ? (balance >= cost ? "Shared by every student at your centre." : "Ask your centre to add stars for your next full mock.")
          : (balance >= cost ? `Enough for ${Math.floor(balance / cost)} full mock${Math.floor(balance / cost) === 1 ? "" : "s"}.` : "Get stars to sit your next full mock.")}</p>
      </div>
      {balance >= cost && <button className="primary-action" onClick={onStartMock}>Start a full mock →</button>}
    </section>

    {!centre && <section className="section compact-section">
      <div className="section-heading"><h2>Get more stars</h2></div>
      <div className="stars-packages">
        {(overview?.packages ?? []).map((pkg) => {
          const price = formatPrice(pkg);
          return <article className={`stars-package${pkg.highlight ? " highlight" : ""}`} key={pkg.id}>
            {pkg.highlight && <span className="stars-package-tag">Most popular</span>}
            <div className="stars-package-count"><StarIcon /><strong>{pkg.stars}</strong></div>
            <h3>{starsLabel(pkg.stars)}</h3>
            <p>{pkg.label}</p>
            <div className="stars-package-price">{price || "Price coming soon"}</div>
            <button className={pkg.highlight ? "primary-action" : "secondary-action"} disabled={buying !== null} onClick={() => void buy(pkg)}>
              {buying === pkg.id ? "Opening payment…" : `Get ${starsLabel(pkg.stars)}`}
            </button>
          </article>;
        })}
      </div>
    </section>}

    <section className="section compact-section">
      <div className="section-heading"><h2>How stars work</h2></div>
      <ul className="stars-rules">
        {centre
          ? <li><CheckIcon /><span>Your stars come from <strong>{centre}</strong>; you don't need to buy any.</span></li>
          : <li><CheckIcon /><span>Every new account starts with <strong>1 free star</strong>.</span></li>}
        <li><CheckIcon /><span>A full mock costs <strong>{starsLabel(cost)}</strong>, taken once when you start it.</span></li>
        <li><CheckIcon /><span>If you leave halfway, you can resume the same mock without spending another star.</span></li>
        <li><CheckIcon /><span>Practice questions and single-skill tests stay free.</span></li>
      </ul>
    </section>

    {comingSoon && <ComingSoonDialog onClose={() => setComingSoon(false)} />}
  </div>;
}

/** After a provider redirects back with ?purchase=<id>, follow it until it settles. */
function useReturnedPurchase(onRefresh: () => Promise<void>) {
  const [purchase, setPurchase] = useState<StarPurchase | null>(null);
  const refreshed = useRef(false);
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("purchase");
    if (!id) return;
    let alive = true, tries = 0;
    async function poll() {
      try {
        const p = await starsAPI.purchaseStatus(id!);
        if (!alive) return;
        setPurchase(p);
        if (p.status === "pending" && tries++ < 20) { window.setTimeout(poll, 2000); return; }
        if (p.status === "paid" && !refreshed.current) { refreshed.current = true; await onRefresh(); }
        // Drop the query so a reload does not replay the notice.
        window.history.replaceState(null, "", `${window.location.pathname}${window.location.hash}`);
      } catch { /* the stars page still works without the notice */ }
    }
    void poll();
    return () => { alive = false; };
  }, [onRefresh]);
  return purchase;
}

function PurchaseNotice({ purchase }: { purchase: StarPurchase }) {
  if (purchase.status === "paid") return <div className="stars-notice ok" role="status"><CheckIcon /><div><strong>Payment received</strong><span>{starsLabel(purchase.stars)} added to your balance.</span></div></div>;
  if (purchase.status === "pending") return <div className="stars-notice" role="status"><StarIcon /><div><strong>Confirming your payment…</strong><span>This usually takes a few seconds. Your stars appear as soon as the payment is confirmed.</span></div></div>;
  return <div className="stars-notice warn" role="alert"><StarIcon /><div><strong>The payment didn't go through</strong><span>Your star balance hasn’t changed. You can try again, or contact us if you were charged.</span></div></div>;
}

function ComingSoonDialog({ onClose }: { onClose: () => void }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <section className="star-dialog" role="dialog" aria-modal="true" aria-labelledby="coming-soon-title">
      <div className="star-dialog-art"><StarsArt /></div>
      <h2 id="coming-soon-title">Payments are coming soon</h2>
      <p>You can't buy stars online just yet; we're finishing the payment setup. Practice questions and single-skill tests stay free in the meantime.</p>
      <div className="star-dialog-actions"><button className="primary-action" onClick={onClose}>Got it</button></div>
    </section>
  </div>;
}

type SpendProps = { balance: number; cost: number; centreName?: string; busy: boolean; error: string; onConfirm: () => void; onCancel: () => void };

/** Asked before a full mock starts, because starting it spends a star. */
export function SpendStarDialog({ balance, cost, centreName, busy, error, onConfirm, onCancel }: SpendProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);
  return <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onCancel(); }}>
    <section className="star-dialog" role="dialog" aria-modal="true" aria-labelledby="spend-title">
      <div className="star-dialog-art"><StarsArt /></div>
      <h2 id="spend-title">Use {starsLabel(cost)} to start this mock?</h2>
      {centreName
        ? <p>This uses {cost === 1 ? "one" : cost} of <strong>{centreName}</strong>'s stars. The centre has <strong>{starsLabel(balance)}</strong> left for its students.</p>
        : <p>You have <strong>{starsLabel(balance)}</strong>. After starting you'll have <strong>{starsLabel(Math.max(0, balance - cost))}</strong> left.</p>}
      <p className="star-dialog-note">If you leave halfway, you can come back to this mock without spending another star.</p>
      {error && <div className="form-error" role="alert">{error}</div>}
      <div className="star-dialog-actions">
        <button className="secondary-action" onClick={onCancel} disabled={busy}>Not now</button>
        <button ref={confirmRef} className="primary-action" onClick={onConfirm} disabled={busy}>{busy ? "Starting…" : `Use ${starsLabel(cost)} and start`}</button>
      </div>
    </section>
  </div>;
}
