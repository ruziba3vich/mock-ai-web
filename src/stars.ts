import { apiRequest } from "./auth";

/** A bundle of stars. amount_minor is in tiyin for UZS; 0 means not on sale yet. */
export type StarPackage = { id: string; stars: number; amount_minor: number; currency: string; label: string; highlight?: boolean };
export type StarsOverview = { balance: number; full_mock_cost: number; packages: StarPackage[]; payments_available: boolean };
export type StarPurchase = { id: string; package_id: string; stars: number; amount_minor: number; currency: string; status: "pending" | "paid" | "failed" | "cancelled"; failure_reason?: string };

export const starsAPI = {
  overview: () => apiRequest<StarsOverview>("/api/v1/stars"),
  /** Charges once per reference; retrying the same reference is free. 402 when the balance is empty. */
  spendOnFullMock: (reference: string) =>
    apiRequest<{ balance: number }>("/api/v1/stars/spend", { method: "POST", body: JSON.stringify({ purpose: "full_mock", reference }) }),
  /** 503 while payments are not live yet. */
  purchase: (packageID: string) =>
    apiRequest<{ purchase: StarPurchase; checkout_url: string }>("/api/v1/stars/purchases", { method: "POST", body: JSON.stringify({ package_id: packageID }) }),
  purchaseStatus: async (id: string) => (await apiRequest<{ purchase: StarPurchase }>(`/api/v1/stars/purchases/${encodeURIComponent(id)}`)).purchase,
};

export function newSpendReference() {
  return typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `ref-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function formatPrice(p: StarPackage) {
  if (!p.amount_minor) return "";
  const major = p.amount_minor / 100;
  return p.currency === "UZS" ? `${major.toLocaleString("en-US").replace(/,/g, " ")} so'm` : `${major.toFixed(2)} ${p.currency}`;
}

export function starsLabel(n: number) {
  return `${n} star${n === 1 ? "" : "s"}`;
}
