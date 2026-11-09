import { apiRequest } from "./auth";

/** A bundle of stars. amount_minor is in tiyin for UZS; 0 means not on sale yet. */
export type CreditKind = "star" | "writing" | "speaking";
/** A bundle to buy. stars is how many of kind; amount_minor is in tiyin for UZS. */
export type StarPackage = { id: string; kind?: CreditKind; stars: number; amount_minor: number; currency: string; label: string; highlight?: boolean };
/** source "centre": the balance is the student's learning centre's, and stars cannot be bought here. */
export type StarsOverview = { source: "personal" | "centre"; centre_name?: string; balance: number; writing_balance?: number; speaking_balance?: number; full_mock_cost: number; price_per_star_minor?: number; writing_price_minor?: number; speaking_price_minor?: number; currency?: string; max_stars?: number; packages: StarPackage[]; payments_available: boolean };
export type CentreStarEntry = { id: string; kind?: CreditKind; reason: "full_mock" | "grant" | "purchase" | "refund" | "welcome" | "writing_check" | "speaking_interview"; delta: number; balance_after: number; student_name?: string; note?: string; created_at: string };
export type CentreStars = { centre_id: string; balance: number; writing_balance?: number; speaking_balance?: number; full_mock_cost: number; can_grant: boolean; can_buy?: boolean; price_per_star_minor?: number; writing_price_minor?: number; speaking_price_minor?: number; currency?: string; max_stars?: number; payments_available?: boolean; activity: CentreStarEntry[] };
export type StarPricing = { price_per_star_minor: number; writing_price_minor: number; speaking_price_minor: number; currency: string; updated_at: string };
export type PurchaseRow = StarPurchase & { buyer: string; buyer_kind: "student" | "centre"; created_at: string };
export type StarsAdmin = { pricing: StarPricing; payments_available: boolean; provider: string; purchases: PurchaseRow[] };
export type StarPurchase = { id: string; kind?: CreditKind; package_id: string; stars: number; amount_minor: number; currency: string; status: "pending" | "paid" | "failed" | "cancelled"; failure_reason?: string };

export const starsAPI = {
  overview: () => apiRequest<StarsOverview>("/api/v1/stars"),
  /** Charges once per reference; retrying the same reference is free. 402 when the balance is empty. */
  spendOnFullMock: (reference: string) =>
    apiRequest<{ balance: number }>("/api/v1/stars/spend", { method: "POST", body: JSON.stringify({ purpose: "full_mock", reference }) }),
  /** 503 while payments are not live yet. */
  purchase: (count: number, kind: CreditKind = "star") =>
    apiRequest<{ purchase: StarPurchase; checkout_url: string }>("/api/v1/stars/purchases", { method: "POST", body: JSON.stringify({ kind, count }) }),
  purchaseStatus: async (id: string) => (await apiRequest<{ purchase: StarPurchase }>(`/api/v1/stars/purchases/${encodeURIComponent(id)}`)).purchase,
};

/** Admin panel: a centre's shared stars. */
export const centreStarsAPI = {
  get: (centreID: string) => apiRequest<CentreStars>(`/api/v1/admin/centres/${encodeURIComponent(centreID)}/stars`),
  /** Platform administrators only. reference makes a double-submitted grant count once. */
  grant: (centreID: string, stars: number, reference: string, note: string, kind: CreditKind = "star") =>
    apiRequest<CentreStars>(`/api/v1/admin/centres/${encodeURIComponent(centreID)}/stars/grants`, { method: "POST", body: JSON.stringify({ kind, stars, reference, note }) }),
  /** The centre's own administrator: opens checkout for the centre. 503 while payments are off. */
  buy: (centreID: string, stars: number, kind: CreditKind = "star") =>
    apiRequest<{ purchase: StarPurchase; checkout_url: string }>(`/api/v1/admin/centres/${encodeURIComponent(centreID)}/stars/purchases`, { method: "POST", body: JSON.stringify({ kind, stars }) }),
  purchaseStatus: async (id: string) => (await apiRequest<{ purchase: StarPurchase }>(`/api/v1/admin/stars/purchases/${encodeURIComponent(id)}`)).purchase,
};

/** Admin panel, platform administrators: price and purchases. */
export const starsAdminAPI = {
  get: () => apiRequest<StarsAdmin>("/api/v1/admin/stars"),
  setPrices: async (prices: Partial<Pick<StarPricing, "price_per_star_minor" | "writing_price_minor" | "speaking_price_minor">>) =>
    (await apiRequest<{ pricing: StarPricing }>("/api/v1/admin/stars/pricing", { method: "PUT", body: JSON.stringify(prices) })).pricing,
};

/** Formats an amount in minor units (tiyin) as so'm, e.g. 3000000 → "30 000 so'm". */
export function formatMinor(amountMinor: number, currency = "UZS") {
  const major = amountMinor / 100;
  return currency === "UZS" ? `${major.toLocaleString("en-US", { maximumFractionDigits: 0 }).replace(/,/g, " ")} so'm` : `${major.toFixed(2)} ${currency}`;
}

export function newSpendReference() {
  return typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `ref-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function formatPrice(p: StarPackage) {
  return p.amount_minor ? formatMinor(p.amount_minor, p.currency) : "";
}

export function starsLabel(n: number) {
  return `${n} star${n === 1 ? "" : "s"}`;
}

/** "3 Writing checks", "1 Speaking interview", "5 stars". */
export function creditLabel(kind: CreditKind | undefined, n: number) {
  if (kind === "writing") return `${n} Writing check${n === 1 ? "" : "s"}`;
  if (kind === "speaking") return `${n} Speaking interview${n === 1 ? "" : "s"}`;
  return starsLabel(n);
}
