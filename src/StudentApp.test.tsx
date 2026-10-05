import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import StudentApp from "./StudentApp";
import { examAPI } from "./exams";

vi.mock("./exams", () => ({
  examAPI: {
    list: vi.fn(),
    history: vi.fn(),
    progress: vi.fn(),
    get: vi.fn()
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
  beforeEach(() => {
    window.location.hash = "#dashboard";
    vi.mocked(examAPI.list).mockResolvedValue([summary]);
    vi.mocked(examAPI.history).mockResolvedValue([]);
    vi.mocked(examAPI.progress).mockResolvedValue([]);
    vi.mocked(examAPI.get).mockResolvedValue(exam);
  });

  it("explains the next action and keeps the timer behind an explicit briefing", async () => {
    const onStartExam = vi.fn();
    const user = userEvent.setup();
    render(<StudentApp user={{ id: "user-1", display_name: "Amina Karim", email_verified: true, roles: ["student"], created_at: "2026-10-01T00:00:00Z" }} onLogout={vi.fn()} onStartExam={onStartExam} />);

    expect(await screen.findByRole("heading", { name: /Ready for your next step, Amina/i })).toBeInTheDocument();
    expect(screen.getByText("Choose a skill")).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: "Mock exams" })[0]);
    expect(await screen.findByRole("heading", { name: "Choose a mock exam" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /View exam/i }));

    expect(await screen.findByRole("dialog", { name: "Urban Gardens" })).toBeInTheDocument();
    expect(onStartExam).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: /Start timed exam/i }));
    expect(onStartExam).toHaveBeenCalledWith(exam);
  });

  it("provides a useful empty progress state", async () => {
    const user = userEvent.setup();
    render(<StudentApp user={{ id: "user-1", display_name: "Amina", email_verified: true, roles: ["student"], created_at: "2026-10-01T00:00:00Z" }} onLogout={vi.fn()} onStartExam={vi.fn()} />);
    await waitFor(() => expect(examAPI.progress).toHaveBeenCalled());
    await user.click(screen.getAllByRole("button", { name: "Progress" })[0]);
    expect(await screen.findByRole("heading", { name: "No results yet" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Find my first exam/i })).toBeInTheDocument();
  });
});
