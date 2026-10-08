import { apiRequest } from "./auth";
export type WritingReport = {
  overall: number; summary: string;
  topic_alignment?: { status: "aligned" | "partly_aligned" | "off_topic"; prompt_topic: string; essay_topic: string; explanation: string };
  criteria: { key: string; score: number; reason: string; how_to_improve?: string }[];
  strengths: string[];
  issues: { category: string; quote: string; explanation: string; suggestion: string; example: string }[];
  next_steps: string[];
  rewrite: { original: string; improved: string; explanation: string };
};
export type WritingSubmission = { id: string; parent_id?: string; prompt: string; essay: string; revision: number; status: "draft" | "queued" | "processing" | "completed" | "failed"; report?: WritingReport; rubric_version: string; error_code: string; created_at: string; updated_at: string };
export type WritingInput = { prompt: string; essay: string; revision?: number; parent_id?: string };
export const writingAPI = {
  settings: () => apiRequest<{ enabled: boolean; daily_limit: number }>("/api/v1/writing/settings"),
  list: async () => (await apiRequest<{ submissions: WritingSubmission[] }>("/api/v1/writing/submissions")).submissions,
  get: (id: string) => apiRequest<WritingSubmission>(`/api/v1/writing/submissions/${id}`),
  create: (v: WritingInput) => apiRequest<WritingSubmission>("/api/v1/writing/submissions", { method: "POST", body: JSON.stringify(v) }),
  save: (id: string, v: WritingInput) => apiRequest<WritingSubmission>(`/api/v1/writing/submissions/${id}`, { method: "PUT", body: JSON.stringify(v) }),
  evaluate: (id: string, revision: number) => apiRequest<WritingSubmission>(`/api/v1/writing/submissions/${id}/evaluate`, { method: "POST", body: JSON.stringify({ revision, consent: true }) }),
  remove: (id: string) => apiRequest<void>(`/api/v1/writing/submissions/${id}`, { method: "DELETE" })
};
export const criteriaLabels: Record<string, string> = { task_response: "Task Response", coherence_cohesion: "Coherence & Cohesion", lexical_resource: "Lexical Resource", grammar: "Grammatical Range & Accuracy" };
