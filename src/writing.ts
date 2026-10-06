import { apiRequest } from "./auth";
export type WritingReport = {
  overall: number; model_version: string; summary: string;
  criteria: { key: string; score: number; reason: string }[];
  strengths: string[];
  issues: { category: string; quote: string; explanation: string; suggestion: string; example: string }[];
  next_steps: string[];
  rewrite: { original: string; improved: string; explanation: string };
};
export type WritingSubmission = { id: string; parent_id?: string; prompt: string; essay: string; revision: number; status: "draft" | "queued" | "processing" | "completed" | "failed"; report?: WritingReport; model: string; rubric_version: string; error_code: string; created_at: string; updated_at: string };
export type WritingInput = { prompt: string; essay: string; revision?: number; parent_id?: string };
export const writingAPI = {
  settings: () => apiRequest<{ enabled: boolean; model: string; daily_limit: number }>("/api/v1/writing/settings"),
  list: async () => (await apiRequest<{ submissions: WritingSubmission[] }>("/api/v1/writing/submissions")).submissions,
  get: (id: string) => apiRequest<WritingSubmission>(`/api/v1/writing/submissions/${id}`),
  create: (v: WritingInput) => apiRequest<WritingSubmission>("/api/v1/writing/submissions", { method: "POST", body: JSON.stringify(v) }),
  save: (id: string, v: WritingInput) => apiRequest<WritingSubmission>(`/api/v1/writing/submissions/${id}`, { method: "PUT", body: JSON.stringify(v) }),
  evaluate: (id: string, revision: number) => apiRequest<WritingSubmission>(`/api/v1/writing/submissions/${id}/evaluate`, { method: "POST", body: JSON.stringify({ revision, consent: true }) }),
  remove: (id: string) => apiRequest<void>(`/api/v1/writing/submissions/${id}`, { method: "DELETE" })
};
export const criteriaLabels: Record<string, string> = { task_response: "Task Response", coherence_cohesion: "Coherence & Cohesion", lexical_resource: "Lexical Resource", grammar: "Grammatical Range & Accuracy" };
export const writingPrompts = [
  "Some people believe cities should invest more in public transport than in new roads. To what extent do you agree or disagree? Give reasons for your answer and include relevant examples.",
  "Some people think university students should study only subjects related to their future careers. Others believe they should also explore unrelated subjects. Discuss both views and give your own opinion.",
  "Many employees now work from home for part of the week. Do the advantages of this development outweigh the disadvantages? Give reasons for your answer and include relevant examples."
];
