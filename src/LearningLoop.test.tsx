import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import PracticePage from "./PracticePage";
import ReviewPage from "./ReviewPage";
import { examAPI, HistoryItem } from "./exams";

vi.mock("./exams", () => ({
  examAPI: { practice: vi.fn(), checkPractice: vi.fn(), review: vi.fn() }
}));

const practiceQuestion = {
  id: "question-1", position: 1, type: "multiple_choice", prompt: "What do rooftop gardens absorb?", points: 1, config: {},
  options: [{ id: "option-1", position: 1, label: "A", value: "Rainwater" }, { id: "option-2", position: 2, label: "B", value: "Traffic" }],
  section_title: "Rooftop gardens", section_instructions: "Read and answer.", passage: "Rooftop gardens absorb rainwater.",
  exam_title: "Urban Gardens", skill: "reading" as const
};

describe("practice and review loop", () => {
  it("starts focused practice and checks an answer", async () => {
    vi.mocked(examAPI.practice).mockResolvedValue([practiceQuestion]);
    vi.mocked(examAPI.checkPractice).mockResolvedValue({ question_id: "question-1", correct: true, accepted_answers: ["Rainwater"], explanation: "The passage states this directly." });
    const user = userEvent.setup();
    render(<PracticePage onOpenExams={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /Start 5-question practice/i }));
    expect(await screen.findByRole("heading", { name: "Question 1 of 1" })).toBeInTheDocument();
    await user.click(screen.getByText("Rainwater"));
    await user.click(screen.getByRole("button", { name: "Check answer" }));
    expect(await screen.findByText("Correct")).toBeInTheDocument();
    expect(screen.getByText("The passage states this directly.")).toBeInTheDocument();
  });

  it("opens a scored attempt and shows accepted answers", async () => {
    const history: HistoryItem[] = [{ id: "attempt-1", exam_version_id: "version-1", status: "scored", started_at: "2026-10-01T00:00:00Z", deadline_at: "2026-10-01T00:20:00Z", submitted_at: "2026-10-01T00:10:00Z", raw_score: 0, band_score: 4, question_count: 1, answers: [], title: "Urban Gardens", skill: "reading" }];
    vi.mocked(examAPI.review).mockResolvedValue({ attempt_id: "attempt-1", exam_title: "Urban Gardens", skill: "reading", band_score: 4, questions: [{ id: "question-1", position: 1, section_title: "Rooftops", type: "multiple_choice", prompt: "What is absorbed?", submitted_answers: ["Traffic"], accepted_answers: ["Rainwater"], correct: false, explanation: "Look at the first sentence." }] });
    const user = userEvent.setup();
    render(<ReviewPage history={history} loading={false} onOpenExams={vi.fn()} onOpenPractice={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /Urban Gardens/i }));
    expect(await screen.findByRole("heading", { name: "What is absorbed?" })).toBeInTheDocument();
    expect(screen.getByText("Rainwater")).toBeInTheDocument();
    expect(screen.getByText("Look at the first sentence.")).toBeInTheDocument();
  });
});
