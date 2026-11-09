import { useEffect, useRef, useState } from "react";
import { APIError } from "./auth";
import { StarIcon, CheckIcon } from "./icons";
import Poster from "./Poster";
import { Roll, stagger, useEntrance } from "./motion";
import { creditLabel, CreditKind, formatPrice, StarPackage, StarPurchase, starsAPI, starsLabel, StarsOverview } from "./stars";

const GROUPS: { kind: CreditKind; title: string; copy: string }[] = [
  { kind: "star", title: "Stars for full mocks", copy: "One star is one complete four-skill mock." },
  { kind: "writing", title: "Writing checks", copy: "One AI-evaluated essay with band, criteria and rewrite." },
  { kind: "speaking", title: "Speaking interviews", copy: "One interview with the AI examiner and a full report." },
];

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
  const root = useRef<HTMLDivElement>(null);
  useEntrance(root, !!overview);
  const balance = overview?.balance ?? 0;
  const cost = overview?.full_mock_cost ?? 1;
  const centre = overview?.source === "centre" ? (overview.centre_name || "your learning centre") : null;

  async function buy(pkg: StarPackage) {
    setError("");
    if (!overview?.payments_available || !pkg.amount_minor) { setComingSoon(true); return; }
    setBuying(pkg.id);
    try {
      const { checkout_url } = await starsAPI.purchase(pkg.stars, pkg.kind ?? "star");
      window.location.assign(checkout_url);
    } catch (caught) {
      if (caught instanceof APIError && caught.status === 503) setComingSoon(true);
      else setError(caught instanceof Error ? caught.message : "The payment could not be started.");
      setBuying(null);
    }
  }

  return <div className="content page-content stars-page" ref={root}>
    <header className="page-header">
      <h1>Stars</h1>
      <p>{centre
        ? <>Your stars and practice checks are provided by <strong>{centre}</strong>.</>
        : "Stars pay for full IELTS mock exams. Writing checks and Speaking interviews pay for AI-marked practice."}</p>
    </header>

    {returned && <PurchaseNotice purchase={returned} />}
    {outOfStars && balance < cost && !returned && (centre
      ? <div className="stars-notice warn" role="status"><StarIcon /><div><strong>Your centre has run out of stars</strong><span>Ask {centre} to add more so you can start a full mock. Practice tests stay free.</span></div></div>
      : <div className="stars-notice warn" role="status"><StarIcon /><div><strong>You've used all your stars</strong><span>Get more stars to start another full mock. Practice tests stay free.</span></div></div>)}
    {error && <div className="form-error" role="alert">{error}</div>}

    <section className="stars-balance rise">
      <Poster skill="full" title="Full mock" size="sm" className="stars-balance-poster" />
      <div className="stars-balance-figure"><StarIcon /><strong>{overview ? <Roll value={balance} delay={400} /> : "–"}</strong></div>
      <div className="stars-balance-copy">
        <h2>{!overview ? "Loading your stars…" : centre ? `${centre} has ${starsLabel(balance)}` : `You have ${starsLabel(balance)}`}</h2>
        <p>{centre
          ? (balance >= cost ? "Shared by every student at your centre." : "Ask your centre to add stars for your next full mock.")
          : (balance >= cost ? `Enough for ${Math.floor(balance / cost)} full mock${Math.floor(balance / cost) === 1 ? "" : "s"}.` : "Get stars to sit your next full mock.")}</p>
      </div>
      {balance >= cost && <button className="primary-action" onClick={onStartMock}>Start a full mock →</button>}
    </section>
    {overview && <div className="practice-balances">
      <div className="practice-balance writing"><Poster skill="writing" size="sm" className="balance-art" /><div><strong>{overview.writing_balance ?? 0}</strong><span>Writing check{(overview.writing_balance ?? 0) === 1 ? "" : "s"} {centre ? "from your centre" : "left"}</span></div></div>
      <div className="practice-balance speaking"><Poster skill="speaking" size="sm" className="balance-art" /><div><strong>{overview.speaking_balance ?? 0}</strong><span>Speaking interview{(overview.speaking_balance ?? 0) === 1 ? "" : "s"} {centre ? "from your centre" : "left"}</span></div></div>
    </div>}

    {!centre && GROUPS.map(group => {
      const packages = (overview?.packages ?? []).filter(p => (p.kind ?? "star") === group.kind);
      if (!packages.length) return null;
      return <section className="section compact-section" key={group.kind}>
        <div className="section-heading"><h2>{group.title}</h2><p>{group.copy}</p></div>
        <div className={`stars-packages kind-${group.kind}`}>
          {packages.map((pkg, i) => {
            const price = formatPrice(pkg);
            return <article className={`stars-package rise${pkg.highlight ? " highlight" : ""}`} style={stagger(i, 300)} key={pkg.id}>
              {pkg.highlight && <span className="stars-package-tag">Most popular</span>}
              <div className="stars-package-count">{group.kind === "star" ? <StarIcon /> : <Poster skill={group.kind} size="sm" className="package-art" />}<strong>{pkg.stars}</strong></div>
              <h3>{creditLabel(pkg.kind, pkg.stars)}</h3>
              <p>{pkg.label}</p>
              <div className="stars-package-price">{price || "Price coming soon"}</div>
              <button className="secondary-action" disabled={buying !== null} onClick={() => void buy(pkg)}>
                {buying === pkg.id ? "Opening payment…" : `Get ${creditLabel(pkg.kind, pkg.stars)}`}
              </button>
            </article>;
          })}
        </div>
      </section>;
    })}

    <section className="section compact-section">
      <div className="section-heading"><h2>How it works</h2></div>
      <ul className="stars-rules">
        {centre
          ? <li><CheckIcon /><span>Your stars come from <strong>{centre}</strong>; you don't need to buy any.</span></li>
          : <li><CheckIcon /><span>Every new account starts with <strong>1 free star</strong>.</span></li>}
        <li><CheckIcon /><span>A full mock costs <strong>{starsLabel(cost)}</strong>, taken once when you start it.</span></li>
        <li><CheckIcon /><span>If you leave halfway, you can resume the same mock without spending another star.</span></li>
        <li><CheckIcon /><span>In Practice, each AI-evaluated essay uses <strong>1 Writing check</strong> and each AI interview <strong>1 Speaking interview</strong>. A full mock's own Writing and Speaking are included in its star.</span></li>
        {!centre && <li><CheckIcon /><span>New accounts also get <strong>1 free Writing check and 1 free Speaking interview</strong> to try.</span></li>}
        <li><CheckIcon /><span>Reading and Listening practice stay free.</span></li>
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
  if (purchase.status === "paid") return <div className="stars-notice ok" role="status"><CheckIcon /><div><strong>Payment received</strong><span>{creditLabel(purchase.kind, purchase.stars)} added to your balance.</span></div></div>;
  if (purchase.status === "pending") return <div className="stars-notice" role="status"><StarIcon /><div><strong>Confirming your payment…</strong><span>This usually takes a few seconds. Your stars appear as soon as the payment is confirmed.</span></div></div>;
  return <div className="stars-notice warn" role="alert"><StarIcon /><div><strong>The payment didn't go through</strong><span>Your star balance hasn’t changed. You can try again, or contact us if you were charged.</span></div></div>;
}

function ComingSoonDialog({ onClose }: { onClose: () => void }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <section className="star-dialog" role="dialog" aria-modal="true" aria-labelledby="coming-soon-title">
      <Poster skill="full" title="Full mock" size="sm" className="star-dialog-art" />
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
      <Poster skill="full" title="Full mock" size="sm" className="star-dialog-art" />
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
