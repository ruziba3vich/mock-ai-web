import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import NotebookPage from "./NotebookPage";
import { learningAPI } from "./learning";
vi.mock("./learning", () => ({
  learningAPI: { mistakes: vi.fn(), retry: vi.fn() },
}));
it("retries a missed question and moves it into resolved mistakes", async () => {
  vi.mocked(learningAPI.mistakes).mockResolvedValue([
    {
      id: "q1",
      type: "short_answer",
      position: 1,
      prompt: "When does it open?",
      points: 1,
      config: {},
      options: [],
      section_title: "Library",
      section_instructions: "Read carefully",
      passage: "The library opens at nine.",
      exam_title: "Library",
      skill: "reading",
      resolved: false,
      last_missed: new Date().toISOString(),
    },
  ]);
  vi.mocked(learningAPI.retry).mockResolvedValue({
    question_id: "q1",
    correct: true,
    accepted_answers: ["nine"],
    explanation: "The passage gives nine as the opening time.",
  });
  const user = userEvent.setup();
  render(<NotebookPage />);
  await user.click(
    await screen.findByRole("button", { name: /When does it open/ }),
  );
  await user.type(screen.getByPlaceholderText("Type your answer"), "nine");
  await user.click(screen.getByRole("button", { name: "Check retry" }));
  expect(await screen.findByText("Resolved — well done")).toBeInTheDocument();
  expect(learningAPI.retry).toHaveBeenCalledWith("q1", ["nine"]);
  await user.click(screen.getByRole("button", { name: "Continue notebook" }));
  await user.click(screen.getByRole("button", { name: "resolved (1)" }));
  expect(
    screen.getByRole("button", { name: /When does it open/ }),
  ).toBeInTheDocument();
});
