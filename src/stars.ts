import { apiRequest } from "./auth";

/** Older ledger rows and purchases may still say "writing" or "speaking"; everything new is "star". */
export type CreditKind = "star" | "writing" | "speaking";
/** What each part costs in stars. A full mock is the sum of the four. */
export type StarCosts = { listening: number; reading: number; writing: number; speaking: number };
/** source "centre": the balance is the student's learning centre's, and stars cannot be bought here. */
export type StarsOverview = { source: "personal" | "centre"; centre_name?: string; balance: number; full_mock_cost: number; costs?: StarCosts; price_per_star_minor?: number; currency?: string; max_stars?: number; payments_available: boolean; /** References of the full mocks already paid for (see mockReference). */ paid_mocks?: string[] | null; /** Free AI checks each paid mock still covers. A mock missing here covers none. */ mock_checks?: Record<string, { writing: number; speaking: number }> | null };
export type CentreStarEntry = { id: string; kind?: CreditKind; reason: "full_mock" | "grant" | "purchase" | "refund" | "welcome" | "writing_check" | "speaking_interview"; delta: number; balance_after: number; student_name?: string; note?: string; created_at: string };
export type CentreStars = { centre_id: string; balance: number; full_mock_cost: number; costs?: StarCosts; can_grant: boolean; can_buy?: boolean; price_per_star_minor?: number; currency?: string; max_stars?: number; payments_available?: boolean; activity: CentreStarEntry[] };
export type StarPricing = { price_per_star_minor: number; currency: string; updated_at: string };
export type PurchaseRow = StarPurchase & { buyer: string; buyer_kind: "student" | "centre"; created_at: string };
export type StarsAdmin = { pricing: StarPricing; payments_available: boolean; provider: string; purchases: PurchaseRow[] };
export type StarPurchase = { id: string; kind?: CreditKind; package_id: string; stars: number; amount_minor: number; currency: string; status: "pending" | "paid" | "failed" | "cancelled"; failure_reason?: string };

/** Used until the server's own numbers arrive. */
export const DEFAULT_COSTS: StarCosts = { listening: 5, reading: 5, writing: 10, speaking: 15 };

export const starsAPI = {
  overview: () => apiRequest<StarsOverview>("/api/v1/stars"),
  /**
   * Charges once per reference; retrying the same reference is free. 402 when the balance is too low.
   * For a centre's exam day the reference is the exam's id, and only the parts that exam includes are charged.
   */
  spendOnFullMock: (reference: string) =>
    apiRequest<{ balance: number }>("/api/v1/stars/spend", { method: "POST", body: JSON.stringify({ purpose: "full_mock", reference }) }),
  /** Any number of stars, each at the current price. 503 while payments are not live yet. */
  purchase: (stars: number) =>
    apiRequest<{ purchase: StarPurchase; checkout_url: string }>("/api/v1/stars/purchases", { method: "POST", body: JSON.stringify({ stars }) }),
  purchaseStatus: async (id: string) => (await apiRequest<{ purchase: StarPurchase }>(`/api/v1/stars/purchases/${encodeURIComponent(id)}`)).purchase,
};

/** Admin panel: a centre's shared stars. */
export const centreStarsAPI = {
  get: (centreID: string) => apiRequest<CentreStars>(`/api/v1/admin/centres/${encodeURIComponent(centreID)}/stars`),
  /** Platform administrators only. reference makes a double-submitted grant count once. */
  grant: (centreID: string, stars: number, reference: string, note: string) =>
    apiRequest<CentreStars>(`/api/v1/admin/centres/${encodeURIComponent(centreID)}/stars/grants`, { method: "POST", body: JSON.stringify({ stars, reference, note }) }),
  /** The centre's own administrator: opens checkout for the centre. 503 while payments are off. */
  buy: (centreID: string, stars: number) =>
    apiRequest<{ purchase: StarPurchase; checkout_url: string }>(`/api/v1/admin/centres/${encodeURIComponent(centreID)}/stars/purchases`, { method: "POST", body: JSON.stringify({ stars }) }),
  purchaseStatus: async (id: string) => (await apiRequest<{ purchase: StarPurchase }>(`/api/v1/admin/stars/purchases/${encodeURIComponent(id)}`)).purchase,
};

/** Admin panel, platform administrators: one student's own wallet. */
export type StudentStars = { balance: number; centre_name?: string };
export const studentStarsAPI = {
  get: (userID: string) => apiRequest<StudentStars>(`/api/v1/admin/students/${encodeURIComponent(userID)}/stars`),
  grant: (userID: string, stars: number, reference: string, note: string) =>
    apiRequest<StudentStars>(`/api/v1/admin/students/${encodeURIComponent(userID)}/stars/grants`, { method: "POST", body: JSON.stringify({ stars, reference, note }) }),
};

/** Admin panel, platform administrators: price and purchases. */
export const starsAdminAPI = {
  get: () => apiRequest<StarsAdmin>("/api/v1/admin/stars"),
  setPrice: async (pricePerStarMinor: number) =>
    (await apiRequest<{ pricing: StarPricing }>("/api/v1/admin/stars/pricing", { method: "PUT", body: JSON.stringify({ price_per_star_minor: pricePerStarMinor }) })).pricing,
};

/** Formats an amount in minor units (tiyin) as so'm, e.g. 3000000 → "30 000 so'm". */
export function formatMinor(amountMinor: number, currency = "UZS") {
  const major = amountMinor / 100;
  return currency === "UZS" ? `${major.toLocaleString("en-US", { maximumFractionDigits: 0 }).replace(/,/g, " ")} so'm` : `${major.toFixed(2)} ${currency}`;
}

export function newSpendReference() {
  return typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `ref-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** A full mock is paid for under its two papers, so opening the same mock again, on any device, is never charged twice. Two ids without hyphens are the 64 characters the server allows. */
export function mockReference(listeningID: string, readingID: string) {
  return (listeningID + readingID).replace(/-/g, "");
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
