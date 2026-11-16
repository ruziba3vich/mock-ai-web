import { apiRequest } from "./auth";

export type MarkingItem = {
  id: string;
  student_id: string;
  student_name: string;
  title: string;
  essay?: string;
  answers?: number;
  submitted_at: string;
};

export type MarkingTurn = {
  position: number;
  part: number;
  prompt: string;
  duration_ms: number;
  answered: boolean;
  skipped: boolean;
  transcript?: string;
};

export type ReviewCriterion = { key: string; score: number; reason: string; how_to_improve: string };
/** An essay: the marker's own overall band and the four criteria. */
export type Review = {
  overall: number;
  summary: string;
  criteria: ReviewCriterion[];
  strengths: string[];
  next_steps: string[];
};
/** An interview: a band and feedback per part. The API works out the overall band. */
export type SpeakingReview = { summary: string; parts: { part: number; score: number; feedback: string }[] };

export type Skill = "writing" | "speaking";

/** The four criteria an essay is marked on, in the order a marker reads them. */
export const WRITING_CRITERIA = [
  { key: "task_achievement", label: "Task achievement" },
  { key: "coherence_cohesion", label: "Coherence & cohesion" },
  { key: "lexical_resource", label: "Lexical resource" },
  { key: "grammar", label: "Grammatical range & accuracy" },
];

/** An interview's band: the mean of its part bands, to the nearest half band. The API does the same sum. */
export const interviewBand = (scores: number[]) =>
  Math.floor(scores.reduce((sum, s) => sum + s, 0) / scores.length * 2 + 0.5) / 2;

/** IELTS half bands, which is what a marker actually writes. */
export const BANDS = Array.from({ length: 19 }, (_, i) => i / 2);

export const markingAPI = {
  queue: () => apiRequest<{ writing: MarkingItem[]; speaking: MarkingItem[] }>("/api/v1/admin/marking"),
  turns: async (sessionID: string) =>
    (await apiRequest<{ turns: MarkingTurn[] }>(`/api/v1/admin/marking/speaking/${sessionID}/turns`)).turns,
  publish: (skill: Skill, id: string, review: Review | SpeakingReview) =>
    apiRequest<void>(`/api/v1/admin/marking/${skill}/${id}`, { method: "POST", body: JSON.stringify(review) }),
  /** Served from the admin session rather than linked, so it is never public. */
  recording: (sessionID: string, position: number) =>
    `/api/v1/admin/marking/speaking/${sessionID}/${position}/recording`,
};
