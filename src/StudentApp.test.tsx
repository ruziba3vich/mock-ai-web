import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import StudentApp from "./StudentApp";
import { examAPI } from "./exams";

vi.mock("./writing", async importOriginal => ({
  ...await importOriginal<typeof import("./writing")>(),
  writingAPI: { settings: vi.fn().mockResolvedValue({ enabled: true, model: "test", daily_limit: 5 }), list: vi.fn().mockResolvedValue([]) }
}));

vi.mock("./exams", () => ({
  examAPI: {
    list: vi.fn(),
    history: vi.fn(),
    progress: vi.fn(),
    get: vi.fn(),
    practice: vi.fn(),
    checkPractice: vi.fn(),
    review: vi.fn(),
    markReviewed: vi.fn(),
    studyPlan: vi.fn(),
    updateStudyProfile: vi.fn()
  }
}));

const summary = {
  id: "exam-1", slug: "urban-gardens", title: "Urban Gardens", description: "A complete reading baseline.",
  skill: "reading" as const, duration_seconds: 1200, question_count: 10, published_at: "2026-10-01T00:00:00Z"
};

const exam = {
  ...summary,
  version_id: "version-1",
  version: 1,
  instructions: "Read carefully.",
  sections: [{ id: "section-1", position: 1, title: "Passage", instructions: "Questions 1–10", passage: "Text", questions: [] }]
};

describe("student workspace", () => {
  it("navigates from the Practice Writing option to the essay editor", async () => {
    window.location.hash = "#practice";
    const user = userEvent.setup();
    render(<StudentApp user={{ id: "user-1", display_name: "Amina", email_verified: true, roles: ["student"], created_at: "2026-10-01T00:00:00Z" }} onLogout={vi.fn()} onStartExam={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /Writing\s*Task 2 essays, scores and feedback/ }));
    await user.click(screen.getByRole("button", { name: "Open Writing workspace" }));
    expect(await screen.findByRole("heading", { name: "Write. Understand. Revise." })).toBeInTheDocument();
    expect(screen.getByLabelText("Your essay")).toBeInTheDocument();
    expect(window.location.hash).toBe("#writing");
  });

  beforeEach(() => {
    window.location.hash = "#dashboard";
    vi.mocked(examAPI.list).mockResolvedValue([summary]);
    vi.mocked(examAPI.history).mockResolvedValue([]);
    vi.mocked(examAPI.progress).mockResolvedValue([]);
    vi.mocked(examAPI.studyPlan).mockResolvedValue({
      profile: { target_band: 7, track: "academic", daily_goal_minutes: 20 },
      streak_days: 0, practice_today: 0, mocks_today: 0, mocks_this_week: 0, reviews_today: 0, estimated_minutes_today: 0,
      recommendation: { skill: "reading", question_type: "multiple_choice", reason: "Build a baseline." },
      week: []
    });
    vi.mocked(examAPI.get).mockResolvedValue(exam);
  });

  it("does not expose the admin editor through legacy student roles or hashes", async () => {
    window.location.hash = "#admin";
    render(<StudentApp user={{ id: "user-1", display_name: "Amina", email_verified: true, roles: ["student", "admin"], created_at: "2026-10-01T00:00:00Z" }} onLogout={vi.fn()} onStartExam={vi.fn()} />);
    expect(await screen.findByRole("heading", { name: /Let’s practise, Amina/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Manage content" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Content studio" })).not.toBeInTheDocument();
  });

  it("explains the next action and keeps the timer behind an explicit briefing", async () => {
    const onStartExam = vi.fn();
    const user = userEvent.setup();
    render(<StudentApp user={{ id: "user-1", display_name: "Amina Karim", email_verified: true, roles: ["student"], created_at: "2026-10-01T00:00:00Z" }} onLogout={vi.fn()} onStartExam={onStartExam} />);

    expect(await screen.findByRole("heading", { name: /Let’s practise, Amina/i })).toBeInTheDocument();
    expect(screen.getByText("Find your starting point")).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: "Mock exams" })[0]);
    expect(await screen.findByRole("heading", { name: "Choose a mock exam" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /View exam/i }));

    expect(await screen.findByRole("dialog", { name: "Urban Gardens" })).toBeInTheDocument();
    expect(onStartExam).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: /Start timed exam/i }));
    expect(onStartExam).toHaveBeenCalledWith(exam);
  });

  it("groups Writing and Speaking under mocks and starts a four-skill mock",async()=>{
    const listening={...summary,id:"exam-2",slug:"listening-1",title:"Listening 1",skill:"listening" as const};
    vi.mocked(examAPI.list).mockResolvedValueOnce([summary,listening]);
    const onStartFullMock=vi.fn(),user=userEvent.setup();
    window.location.hash="#exams";
    render(<StudentApp user={{id:"user-1",display_name:"Amina",email_verified:true,roles:["student"],created_at:"2026-10-01T00:00:00Z"}} onLogout={vi.fn()} onStartExam={vi.fn()} onStartFullMock={onStartFullMock}/>);
    expect(await screen.findByRole("heading",{name:"Take a full four-skill mock"})).toBeInTheDocument();
    expect(screen.getByRole("button",{name:/Writing mock/})).toBeInTheDocument();
    expect(screen.getByRole("button",{name:/Speaking mock/})).toBeInTheDocument();
    await user.click(screen.getByRole("button",{name:"Start full mock →"}));
    expect(onStartFullMock).toHaveBeenCalledWith("exam-2","exam-1");
    const mainNav=screen.getByRole("navigation",{name:"Main navigation"});
    expect(mainNav).not.toHaveTextContent("Writing");
    expect(mainNav).not.toHaveTextContent("Speaking");
  });

  it("provides a useful empty progress state", async () => {
    const user = userEvent.setup();
    render(<StudentApp user={{ id: "user-1", display_name: "Amina", email_verified: true, roles: ["student"], created_at: "2026-10-01T00:00:00Z" }} onLogout={vi.fn()} onStartExam={vi.fn()} />);
    await waitFor(() => expect(examAPI.progress).toHaveBeenCalled());
    await user.click(screen.getAllByRole("button", { name: "Progress" })[0]);
    expect(await screen.findByRole("heading", { name: "No results yet" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Find my first exam/i })).toBeInTheDocument();
  });

  it("opens the profile panel without signing the student out", async () => {
    const onLogout = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<StudentApp user={{ id: "user-1", display_name: "Dostonbek Student", email_verified: false, roles: ["student"], created_at: "2026-10-01T00:00:00Z" }} onLogout={onLogout} onStartExam={vi.fn()} />);
    await waitFor(() => expect(examAPI.studyPlan).toHaveBeenCalled());

    await user.click(screen.getAllByRole("button", { name: "Open profile" })[0]);

    expect(await screen.findByRole("dialog", { name: "Dostonbek Student" })).toBeInTheDocument();
    expect(screen.getByText("Student account")).toBeInTheDocument();
    expect(onLogout).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Sign out of this session" }));
    expect(onLogout).toHaveBeenCalledTimes(1);
  });
});
