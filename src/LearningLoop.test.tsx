import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import PracticePage from "./PracticePage";
import ReviewPage from "./ReviewPage";
import StudyPlanPage from "./StudyPlanPage";
import { examAPI, HistoryItem } from "./exams";

vi.mock("./exams", () => ({
  examAPI: { practice: vi.fn(), checkPractice: vi.fn(), review: vi.fn(), markReviewed: vi.fn(), updateStudyProfile: vi.fn() }
}));

const practiceQuestion = {
  id: "question-1", position: 1, type: "multiple_choice", prompt: "What do rooftop gardens absorb?", points: 1, config: {},
  options: [{ id: "option-1", position: 1, label: "A", value: "Rainwater" }, { id: "option-2", position: 2, label: "B", value: "Traffic" }],
  section_title: "Rooftop gardens", section_instructions: "Read and answer.", passage: "Rooftop gardens absorb rainwater.",
  exam_title: "Urban Gardens", skill: "reading" as const
};

describe("practice and review loop", () => {
  it("opens Writing without requesting questions and restores other skill filters", async () => {
    const onOpenWriting = vi.fn();
    const user = userEvent.setup();
    render(<PracticePage onOpenWriting={onOpenWriting} />);
    await user.click(screen.getByRole("button", { name: "Short answer" }));
    await user.click(screen.getByRole("button", { name: /^Writing/ }));
    expect(screen.getByRole("button", { name: /^Writing/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("button", { name: "Short answer" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Start" }));
    expect(onOpenWriting).toHaveBeenCalledOnce();
    expect(examAPI.practice).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: /^Listening/ }));
    expect(screen.getByRole("button", { name: "Short answer" })).toHaveClass("selected");
    vi.mocked(examAPI.practice).mockResolvedValue([]);
    await user.click(screen.getByRole("button", { name: "Start" }));
    expect(examAPI.practice).toHaveBeenCalledWith("listening", "short_answer", 5);
  });

  it("starts focused practice and checks an answer", async () => {
    vi.mocked(examAPI.practice).mockResolvedValue([practiceQuestion]);
    vi.mocked(examAPI.checkPractice).mockResolvedValue({ question_id: "question-1", correct: true, accepted_answers: ["Rainwater"], explanation: "The passage states this directly." });
    const user = userEvent.setup();
    render(<PracticePage onOpenWriting={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Start" }));
    expect(await screen.findByRole("heading", { name: "Question 1 of 1" })).toBeInTheDocument();
    await user.click(screen.getByText("Rainwater"));
    await user.click(screen.getByRole("button", { name: "Check answer" }));
    expect(await screen.findByText("Correct")).toBeInTheDocument();
    expect(screen.getByText("The passage states this directly.")).toBeInTheDocument();
  });

  it("lists published Writing and Speaking tests and opens the selected content", async () => {
    const onOpenWriting=vi.fn(),onOpenSpeaking=vi.fn(),user=userEvent.setup();
    const base={summary:"A complete assessment.",status:"published" as const,sort_order:1,created_at:"",updated_at:""};
    render(<PracticePage onOpenWriting={onOpenWriting} onOpenSpeaking={onOpenSpeaking}
      writingContent={[{...base,id:"writing-18-1",kind:"writing_prompt",slug:"writing-18-1",title:"Cambridge 18 · Writing Test 1",data:{task:"task_2",prompt:"Discuss both views."}}]}
      speakingContent={[{...base,id:"speaking-18-1",kind:"speaking_plan",slug:"speaking-18-1",title:"Cambridge 18 · Speaking Test 1",data:{turns:[{},{},{}]}}]} />);
    await user.click(screen.getByRole("button",{name:/Writing\s*Task 2 essays/}));
    expect(screen.getByRole("heading",{name:"Cambridge 18 · Writing Test 1"})).toBeInTheDocument();
    await user.click(screen.getByRole("button",{name:/Open task/}));
    expect(onOpenWriting).toHaveBeenCalledWith("writing-18-1");
    await user.click(screen.getByRole("button",{name:/Speaking\s*Three-part interviews/}));
    expect(screen.getByRole("heading",{name:"Cambridge 18 · Speaking Test 1"})).toBeInTheDocument();
    await user.click(screen.getByRole("button",{name:/Start interview/}));
    expect(onOpenSpeaking).toHaveBeenCalledWith("speaking-18-1");
  });

  it("opens a scored attempt and shows accepted answers", async () => {
    const history: HistoryItem[] = [{ id: "attempt-1", exam_version_id: "version-1", status: "scored", started_at: "2026-10-01T00:00:00Z", deadline_at: "2026-10-01T00:20:00Z", submitted_at: "2026-10-01T00:10:00Z", raw_score: 0, band_score: 4, question_count: 1, answers: [], title: "Urban Gardens", skill: "reading" }];
    vi.mocked(examAPI.review).mockResolvedValue({ attempt_id: "attempt-1", exam_title: "Urban Gardens", skill: "reading", band_score: 4, questions: [{ id: "question-1", position: 1, section_title: "Rooftops", type: "multiple_choice", prompt: "What is absorbed?", submitted_answers: ["Traffic"], accepted_answers: ["Rainwater"], correct: false, explanation: "Look at the first sentence." }] });
    vi.mocked(examAPI.markReviewed).mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<ReviewPage history={history} loading={false} onOpenExams={vi.fn()} onOpenPractice={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /Urban Gardens/i }));
    expect(await screen.findByRole("heading", { name: "What is absorbed?" })).toBeInTheDocument();
    expect(screen.getByText("Rainwater")).toBeInTheDocument();
    expect(screen.getByText("Look at the first sentence.")).toBeInTheDocument();
    expect(examAPI.markReviewed).toHaveBeenCalledWith("attempt-1");
  });

  it("shows a personalized plan and saves study goals", async () => {
    vi.mocked(examAPI.updateStudyProfile).mockResolvedValue({ target_band: 7.5, exam_date: "2026-12-20", track: "academic", daily_goal_minutes: 30 });
    const refresh = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<StudyPlanPage plan={{ profile: { target_band: 7, track: "academic", daily_goal_minutes: 20 }, streak_days: 3, practice_today: 2, mocks_today: 0, mocks_this_week: 0, reviews_today: 0, estimated_minutes_today: 4, recommendation: { skill: "reading", question_type: "multiple_choice", reason: "This is your weakest area." }, week: [] }} loading={false} onRefresh={refresh} onPractice={vi.fn()} onReview={vi.fn()} onExams={vi.fn()} />);

    expect(screen.getByRole("heading", { name: /Band 7.0/i })).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: /exam date/i })[0]);
    await user.selectOptions(screen.getByLabelText("Target band"), "7.5");
    await user.selectOptions(screen.getByLabelText("Daily study goal"), "30");
    await user.click(screen.getByRole("button", { name: "Save study goal" }));
    expect(examAPI.updateStudyProfile).toHaveBeenCalledWith(expect.objectContaining({ target_band: 7.5, daily_goal_minutes: 30 }));
    expect(refresh).toHaveBeenCalled();
  });
});
