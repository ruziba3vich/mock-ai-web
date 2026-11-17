import { apiRequest } from "./auth";
import type { ExamPaper } from "./examSession";

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
  /** How many students opened it. Only administrators are told. */
  joined: number;
  /** Empty for a public mock. */
  centre_id: string; centre_name: string;
};
export type MockExamInput = Pick<MockExam, "title" | "listening_exam_id" | "reading_exam_id" | "writing_task1_content_id" | "writing_task2_content_id">;

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
  remove: (id: string) => apiRequest<void>(`/api/v1/admin/mock-exams/${encodeURIComponent(id)}`, { method: "DELETE" }),
};
