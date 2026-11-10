import { apiRequest } from "./auth";

/** What a student sees of a centre's scheduled mock. Paper ids arrive only after joining. */
export type ExamSeat = {
  id: string; title: string; centre_name: string;
  starts_at: string; ends_at: string;
  listening_exam_id?: string; reading_exam_id?: string;
  /** Server time when this was sent, so the countdown does not trust the PC's clock. */
  now: string;
};

/** The admin's view of one scheduled mock. */
export type ExamSession = {
  id: string; title: string; code: string;
  starts_at: string; ends_at: string;
  listening_exam_id: string; reading_exam_id: string;
  seats: number; joined: number;
  /** Numbers of the centre computers that show this exam's QR. */
  pcs: number[];
};
/** One of the centre's computers, as the admin sees it. */
export type CentrePC = { id: string; number: number; online: boolean };
/** What a centre computer shows: its pairing code, then its number and exam. */
export type PCState = {
  status: "pending" | "paired"; pair_code?: string; number?: number; centre_name?: string;
  session?: { id: string; title: string; starts_at: string; ends_at: string; open: boolean; code?: string };
};
export type ExamPaper = { id: string; title: string; skill: "listening" | "reading" };
export type ExamParticipant = { user_id: string; full_name: string; contact: string; joined_at: string; pc?: number };
export type ExamSessionInput = Pick<ExamSession, "title" | "starts_at" | "ends_at" | "listening_exam_id" | "reading_exam_id" | "seats"> & { pc_ids: string[] };

export const examSessionAPI = {
  lookup: async (code: string) =>
    (await apiRequest<{ session: ExamSeat }>("/api/v1/exam-sessions/lookup", { method: "POST", body: JSON.stringify({ code }) })).session,
  /** Seats the student. Without a session cookie this also creates their account and signs them in. */
  join: async (code: string, fullName: string, contact: string) =>
    (await apiRequest<{ session: ExamSeat }>("/api/v1/exam-sessions/join", { method: "POST", body: JSON.stringify({ code, full_name: fullName, contact }) })).session,
  list: () => apiRequest<{ sessions: ExamSession[]; papers: ExamPaper[]; pcs: CentrePC[] }>("/api/v1/admin/exam-sessions"),
  approvePC: async (code: string) =>
    (await apiRequest<{ pc: CentrePC }>("/api/v1/admin/pcs", { method: "POST", body: JSON.stringify({ code }) })).pc,
  removePC: (id: string) => apiRequest<void>(`/api/v1/admin/pcs/${encodeURIComponent(id)}`, { method: "DELETE" }),
  create: async (input: ExamSessionInput) =>
    (await apiRequest<{ session: ExamSession }>("/api/v1/admin/exam-sessions", { method: "POST", body: JSON.stringify(input) })).session,
  participants: async (id: string) =>
    (await apiRequest<{ participants: ExamParticipant[] }>(`/api/v1/admin/exam-sessions/${encodeURIComponent(id)}/participants`)).participants,
  remove: (id: string) => apiRequest<void>(`/api/v1/admin/exam-sessions/${encodeURIComponent(id)}`, { method: "DELETE" }),
};

/** A centre computer talking about itself. The server knows it by a cookie. */
export const pcAPI = {
  me: async () => (await apiRequest<{ pc: PCState | null }>("/api/v1/pcs/me")).pc,
  pair: async () => (await apiRequest<{ pc: PCState }>("/api/v1/pcs", { method: "POST" })).pc,
  /** A fresh token for the student QR: t.me/<bot>?start=j_<token>. */
  login: () => apiRequest<{ token: string; expires_at: string }>("/api/v1/pcs/login", { method: "POST" }),
  poll: (token: string) => apiRequest<{ signed_in: boolean; contact: string }>("/api/v1/pcs/login/poll", { method: "POST", body: JSON.stringify({ token }) }),
};

/**
 * The seat this computer is holding, kept across a reload. reference is what
 * the centre's star is spent with, so starting twice charges once. skew_ms is
 * server time minus this computer's time.
 */
export type HeldSeat = { user_id: string; seat: ExamSeat; reference: string; skew_ms: number };
const KEY = "mockai.exam-seat";
export function readSeat(): HeldSeat | null {
  try { const raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) as HeldSeat : null; } catch { return null; }
}
export function writeSeat(value: HeldSeat | null) {
  if (value) localStorage.setItem(KEY, JSON.stringify(value)); else localStorage.removeItem(KEY);
}

/** "ab c-234" → "ABC234", the way the server compares codes. */
export function normaliseCode(value: string) {
  return value.toUpperCase().replace(/[\s-]/g, "");
}

export function formatWhen(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}
