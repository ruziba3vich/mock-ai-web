import { apiRequest } from "./auth";

export type ExamSummary = {
  id: string; slug: string; title: string; description: string;
  skill: "listening" | "reading"; duration_seconds: number;
  question_count: number; published_at: string;
};
export type Option = { id: string; position: number; label: string; value: string };
export type Question = { id: string; position: number; type: string; prompt: string; points: number; config: Record<string, unknown>; options: Option[] };
export type Section = { id: string; position: number; title: string; instructions: string; audio_url?: string; passage?: string; questions: Question[] };
export type Exam = ExamSummary & { version_id: string; version: number; instructions: string; sections: Section[] };
export type SavedAnswer = { question_id: string; values: string[]; revision: number; saved_at: string; is_correct?: boolean; awarded_points?: number };
export type Attempt = {
  id: string; exam_version_id: string; status: string; started_at: string; deadline_at: string;
  submitted_at?: string; raw_score?: number; band_score?: number; question_count: number; answers: SavedAnswer[];
};
export type HistoryItem = Attempt & { title: string; skill: string };
export type SkillProgress = { skill: string; completed_attempts: number; average_band: number; best_band: number; latest_band: number; correct_answers: number; total_questions: number };
export type PracticeQuestion = Question & {
  section_title: string; section_instructions: string; audio_url?: string; passage?: string;
  exam_title: string; skill: "listening" | "reading";
};
export type PracticeFeedback = { question_id: string; correct: boolean; accepted_answers: string[]; explanation: string };
export type ReviewQuestion = {
  id: string; position: number; section_title: string; type: string; prompt: string;
  submitted_answers: string[]; accepted_answers: string[]; correct: boolean; explanation: string;
};
export type AttemptReview = { attempt_id: string; exam_title: string; skill: string; band_score: number; questions: ReviewQuestion[] };
export type StudyProfile = { target_band: number; exam_date?: string; track: "academic" | "general_training"; daily_goal_minutes: number };
export type DailyStudyActivity = { date: string; practice_answers: number; mocks_completed: number };
export type StudyPlan = {
  profile: StudyProfile; streak_days: number; practice_today: number; mocks_today: number; mocks_this_week: number; reviews_today: number;
  estimated_minutes_today: number; recommendation: { skill: "reading" | "listening"; question_type: string; reason: string };
  week: DailyStudyActivity[];
};

export const examAPI = {
  list: async () => (await apiRequest<{ exams: ExamSummary[] }>("/api/v1/exams")).exams,
  get: async (id: string) => (await apiRequest<{ exam: Exam }>(`/api/v1/exams/${id}`)).exam,
  start: async (id: string) => (await apiRequest<{ attempt: Attempt }>(`/api/v1/exams/${id}/attempts`, { method: "POST" })).attempt,
  attempt: async (id: string) => (await apiRequest<{ attempt: Attempt }>(`/api/v1/attempts/${id}`)).attempt,
  save: async (attemptID: string, questionID: string, values: string[]) =>
    (await apiRequest<{ answer: SavedAnswer }>(`/api/v1/attempts/${attemptID}/answers/${questionID}`, { method: "PUT", body: JSON.stringify({ values }) })).answer,
  submit: async (attemptID: string) => (await apiRequest<{ attempt: Attempt }>(`/api/v1/attempts/${attemptID}/submit`, { method: "POST" })).attempt,
  history: async (limit = 20, offset = 0) => (await apiRequest<{ attempts: HistoryItem[] }>(`/api/v1/me/attempts?limit=${limit}&offset=${offset}`)).attempts,
  progress: async () => (await apiRequest<{ skills: SkillProgress[] }>("/api/v1/me/progress")).skills,
  practice: async (skill: string, questionType = "", limit = 5) => {
    const query = new URLSearchParams({ skill, type: questionType, limit: String(limit) });
    return (await apiRequest<{ questions: PracticeQuestion[] }>(`/api/v1/practice/questions?${query}`)).questions;
  },
  checkPractice: async (questionID: string, values: string[]) =>
    (await apiRequest<{ feedback: PracticeFeedback }>(`/api/v1/practice/questions/${questionID}/check`, { method: "POST", body: JSON.stringify({ values }) })).feedback,
  review: async (attemptID: string) =>
    (await apiRequest<{ review: AttemptReview }>(`/api/v1/attempts/${attemptID}/review`)).review,
  markReviewed: (attemptID: string) => apiRequest<void>(`/api/v1/attempts/${attemptID}/reviewed`, { method: "POST" }),
  studyPlan: async () => (await apiRequest<{ plan: StudyPlan }>("/api/v1/me/study-plan")).plan,
  updateStudyProfile: async (profile: StudyProfile) =>
    (await apiRequest<{ profile: StudyProfile }>("/api/v1/me/study-profile", { method: "PUT", body: JSON.stringify(profile) })).profile
};
