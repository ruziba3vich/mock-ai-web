import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import MarkingAdmin from "./MarkingAdmin";
import { apiRequest } from "./auth";
vi.mock("./auth", async importOriginal => ({ ...await importOriginal<typeof import("./auth")>(), apiRequest: vi.fn() }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });

const essay = {
  id: "w1", student_id: "s1", student_name: "Dilnoza Karimova",
  title: "Should cities invest in public transport?", essay: "Public transport helps workers reach their jobs.",
  submitted_at: new Date().toISOString(),
};
const interview = {
  id: "sp1", student_id: "s2", student_name: "Sardor Tursunov",
  title: "Daily routine", answers: 9, submitted_at: new Date().toISOString(),
};

it("lists the work a centre has to assess, by skill", async () => {
  vi.mocked(apiRequest).mockResolvedValueOnce({ writing: [essay], speaking: [interview] });
  render(<MarkingAdmin />);
  expect(await screen.findByText("Dilnoza Karimova")).toBeInTheDocument();
  expect(screen.getByText("Sardor Tursunov")).toBeInTheDocument();
  // Both skills are one queue with a filter, so the counts live on the filter.
  const skills = screen.getByLabelText("Skill");
  expect(skills).toHaveTextContent("Essays (1)");
  expect(skills).toHaveTextContent("Interviews (1)");
  expect(screen.getByText(/9 answers/)).toBeInTheDocument();
});

it("publishes a writing mark with the marker's own overall band", async () => {
  const request = vi.mocked(apiRequest);
  request.mockResolvedValueOnce({ writing: [essay], speaking: [] });
  const user = userEvent.setup();
  render(<MarkingAdmin />);
  await user.click(await screen.findByRole("button", { name: "Mark Dilnoza Karimova" }));
  // The work is on screen before the form, because a marker reads first.
  expect(screen.getByText(/Public transport helps workers/)).toBeInTheDocument();
  // Writing's four criteria, not Speaking's.
  expect(screen.getByRole("group", { name: "Task achievement" })).toBeInTheDocument();
  expect(screen.queryByRole("group", { name: "Pronunciation" })).not.toBeInTheDocument();

  await user.selectOptions(screen.getByLabelText(/Overall band/), "7.5");
  await user.type(screen.getByLabelText("Summary"), "Clear position, thin second body paragraph.");
  request.mockResolvedValueOnce(undefined).mockResolvedValueOnce({ writing: [], speaking: [] });
  await user.click(screen.getByRole("button", { name: "Publish to the student" }));

  await waitFor(() => {
    const call = request.mock.calls.find(c => String(c[0]).includes("/admin/marking/writing/w1"));
    expect(call).toBeTruthy();
    const body = JSON.parse(String((call![1] as RequestInit).body));
    // The overall band is the marker's, not an average of the criteria.
    expect(body.overall).toBe(7.5);
    expect(body.criteria.map((c: { key: string }) => c.key)).toEqual(
      ["task_achievement", "coherence_cohesion", "lexical_resource", "grammar"]);
  });
  expect(await screen.findByText(/The student can read it now/)).toBeInTheDocument();
});

it("gives a speaking marker the recordings to listen to", async () => {
  const request = vi.mocked(apiRequest);
  request
    .mockResolvedValueOnce({ writing: [], speaking: [interview] })
    .mockResolvedValueOnce({ turns: [
      { position: 0, part: 1, prompt: "Do you work or study?", duration_ms: 24000, answered: true, skipped: false },
      { position: 1, part: 1, prompt: "Skipped one", duration_ms: 0, answered: false, skipped: true },
    ] });
  const user = userEvent.setup();
  const { container } = render(<MarkingAdmin />);
  await user.click(await screen.findByRole("button", { name: "Mark Sardor Tursunov" }));
  await waitFor(() => expect(container.querySelector("audio")).toBeTruthy());
  const players = container.querySelectorAll("audio");
  // Only answered turns, and the audio comes from the admin session.
  expect(players).toHaveLength(1);
  expect(players[0].getAttribute("src")).toBe("/api/v1/admin/marking/speaking/sp1/0/recording");
  expect(screen.getByRole("group", { name: "Pronunciation" })).toBeInTheDocument();
});
