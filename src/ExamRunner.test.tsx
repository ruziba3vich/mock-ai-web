import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ExamRunner from "./ExamRunner";
import { Attempt, Exam, examAPI } from "./exams";
import { learningAPI } from "./learning";
vi.mock("./learning",()=>({learningAPI:{workspace:vi.fn().mockResolvedValue({flags:[],notes:{},highlights:{}}),saveWorkspace:vi.fn().mockResolvedValue(undefined)}}));

vi.mock("./exams", () => ({
  examAPI: { save: vi.fn(), submit: vi.fn() }
}));

const question = {
  id: "question-1", position: 1, type: "multiple_choice", prompt: "What do rooftop gardens absorb?", points: 1, config: {},
  options: [{ id: "option-1", position: 1, label: "A", value: "Rainwater" }, { id: "option-2", position: 2, label: "B", value: "Traffic" }]
};

const exam: Exam = {
  id: "exam-1", slug: "urban-gardens", title: "Urban Gardens", description: "Reading mock", skill: "reading",
  duration_seconds: 1200, question_count: 1, published_at: "2026-10-01T00:00:00Z", version_id: "version-1", version: 1,
  instructions: "Read carefully.", sections: [{ id: "section-1", position: 1, title: "Passage", instructions: "Answer the question.", passage: "Rooftop gardens absorb rainwater.", questions: [question] }]
};

const attempt: Attempt = {
  id: "attempt-1", exam_version_id: "version-1", status: "in_progress", started_at: new Date().toISOString(),
  deadline_at: new Date(Date.now() + 1_200_000).toISOString(), question_count: 1, answers: []
};

describe("exam runner", () => {
 it("persists flags and notes without changing answers",async()=>{
  const user=userEvent.setup();render(<ExamRunner exam={exam} initialAttempt={attempt} onExit={vi.fn()}/>);
  await screen.findByText("Notes synced");
  await user.click(screen.getByRole("button",{name:"⚐ Flag for review"}));
  await waitFor(()=>expect(learningAPI.saveWorkspace).toHaveBeenCalledWith("attempt-1",expect.objectContaining({flags:["question-1"]})));
  await user.click(screen.getByText("Personal note"));
  await user.type(screen.getByLabelText("Note for question 1"),"Check paragraph two");await user.tab();
  await waitFor(()=>expect(learningAPI.saveWorkspace).toHaveBeenCalledWith("attempt-1",expect.objectContaining({flags:["question-1"],notes:{"question-1":"Check paragraph two"}})));
 });
  it("autosaves an answer, confirms submission, and shows the scored result", async () => {
    vi.mocked(examAPI.save).mockResolvedValue({ question_id: "question-1", values: ["Rainwater"], revision: 1, saved_at: new Date().toISOString() });
    vi.mocked(examAPI.submit).mockResolvedValue({ ...attempt, status: "scored", raw_score: 1, band_score: 9, submitted_at: new Date().toISOString(), answers: [{ question_id: "question-1", values: ["Rainwater"], revision: 1, saved_at: new Date().toISOString(), is_correct: true, awarded_points: 1 }] });
    const user = userEvent.setup();
    render(<ExamRunner exam={exam} initialAttempt={attempt} onExit={vi.fn()} />);

    await user.click(screen.getByText("Rainwater"));
    await waitFor(() => expect(examAPI.save).toHaveBeenCalledWith("attempt-1", "question-1", ["Rainwater"]));
    await user.click(screen.getByRole("button", { name: "Review and submit" }));
    expect(screen.getByRole("dialog", { name: "Submit this exam?" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Submit for scoring" }));

    expect(await screen.findByRole("heading", { name: "Band 9.0" })).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();
  });
});
