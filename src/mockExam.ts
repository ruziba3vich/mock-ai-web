import { apiRequest } from "./auth";
import type { ExamPaper } from "./examSession";
import { DEFAULT_COSTS, StarCosts } from "./stars";

/**
 * A mock exam an administrator saved: four sections, no schedule. A public
 * one (no centre) is listed for every student; a centre's one opens only from
 * its invite link, /?mock=<code>.
 */
export type MockExam = {
  id: string; title: string; code: string;
  listening_exam_id: string; reading_exam_id: string;
  /** Empty when the task is picked at random for each student. */
  writing_task1_content_id: string; writing_task2_content_id: string;
  /** False when the centre's teachers mark that part. A public mock is always marked by AI. */
  ai_writing: boolean; ai_speaking: boolean;
  /** How many students opened it. Only administrators are told. */
  joined: number;
  /** Empty for a public mock. */
  centre_id: string; centre_name: string;
};
export type MockExamInput = Pick<MockExam, "title" | "listening_exam_id" | "reading_exam_id" | "writing_task1_content_id" | "writing_task2_content_id" | "ai_writing" | "ai_speaking">;

/** The stars one student's sitting costs: Listening and Reading always, Writing and Speaking only where AI marks them. */
export const mockStars = (mock: Partial<Pick<MockExam, "ai_writing" | "ai_speaking">>, costs: StarCosts = DEFAULT_COSTS) =>
  costs.listening + costs.reading + (mock.ai_writing === false ? 0 : costs.writing) + (mock.ai_speaking === false ? 0 : costs.speaking);

// Platform staff name the centre they act on; without one the mock is public.
const forCentre = (centreID?: string) => (centreID ? `?centre_id=${encodeURIComponent(centreID)}` : "");

export const mockExamAPI = {
  /** The mocks this student may sit: public ones and those whose link they opened. */
  mine: async () => (await apiRequest<{ mocks: MockExam[] }>("/api/v1/mock-exams")).mocks ?? [],
  /** Opens a mock by its code, which is what lets the student read its papers. */
  join: async (code: string) => {
    const { mock } = await apiRequest<{ mock?: MockExam }>("/api/v1/mock-exams/join", { method: "POST", body: JSON.stringify({ code }) });
    if (!mock) throw new Error("That mock exam link is not valid any more.");
    return mock;
  },
  list: (centreID?: string) => apiRequest<{ mocks: MockExam[]; papers: ExamPaper[] }>("/api/v1/admin/mock-exams" + forCentre(centreID)),
  create: async (input: MockExamInput, centreID?: string) =>
    (await apiRequest<{ mock: MockExam }>("/api/v1/admin/mock-exams" + forCentre(centreID), { method: "POST", body: JSON.stringify(input) })).mock,
  /** Changes a mock in place: its invite link and its owner stay. */
  update: async (id: string, input: MockExamInput) =>
    (await apiRequest<{ mock: MockExam }>(`/api/v1/admin/mock-exams/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(input) })).mock,
  remove: (id: string) => apiRequest<void>(`/api/v1/admin/mock-exams/${encodeURIComponent(id)}`, { method: "DELETE" }),
};
