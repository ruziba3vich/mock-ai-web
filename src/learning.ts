import { apiRequest } from "./auth";
import { PracticeFeedback, PracticeQuestion } from "./exams";

export type Workspace = {
  flags: string[];
  notes: Record<string, string>;
  highlights: Record<string, string[]>;
};
export type Mistake = PracticeQuestion & {
  resolved: boolean;
  last_missed: string;
};
export type Reminder = {
  enabled: boolean;
  local_time: string;
  timezone: string;
  telegram_linked?: boolean;
};
export type ContentQuestion = {
  type: string;
  prompt: string;
  options: string[];
  answers: string[];
  explanation: string;
};
export type ContentSection = {
  title: string;
  passage: string;
  audio_url: string;
  instructions: string;
  questions: ContentQuestion[];
};
export type Content = {
  title: string;
  description: string;
  skill: string;
  purpose: string;
  duration_seconds: number;
  instructions: string;
  sections: ContentSection[];
  bands: { minimum: number; band: number }[];
};
export type Draft = { id: string; exam_id: string; data: Content };
export const learningAPI = {
  workspace: (id: string) =>
    apiRequest<Workspace>(`/api/v1/attempts/${id}/workspace`),
  saveWorkspace: (id: string, data: Workspace) =>
    apiRequest<void>(`/api/v1/attempts/${id}/workspace`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  mistakes: async () =>
    (await apiRequest<{ mistakes: Mistake[] }>("/api/v1/me/mistakes")).mistakes,
  retry: async (id: string, values: string[]) =>
    (
      await apiRequest<{ feedback: PracticeFeedback }>(
        `/api/v1/me/mistakes/${id}/retry`,
        { method: "POST", body: JSON.stringify({ values }) },
      )
    ).feedback,
  reminder: () => apiRequest<Reminder>("/api/v1/me/reminder"),
  saveReminder: (v: Reminder) =>
    apiRequest<void>("/api/v1/me/reminder", {
      method: "PUT",
      body: JSON.stringify(v),
    }),
  drafts: async () =>
    (await apiRequest<{ drafts: Draft[] }>("/api/v1/admin/content")).drafts,
  saveDraft: (id: string | undefined, data: Content) =>
    apiRequest<{ id: string }>(`/api/v1/admin/content${id ? `/${id}` : ""}`, {
      method: id ? "PUT" : "POST",
      body: JSON.stringify(data),
    }),
  publish: (id: string) =>
    apiRequest<{ exam_id: string }>(`/api/v1/admin/content/${id}/publish`, {
      method: "POST",
    }),
};
