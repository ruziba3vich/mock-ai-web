import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import CentresAdmin from "./CentresAdmin";
import { apiRequest } from "./auth";
vi.mock("./auth", async importOriginal => ({ ...await importOriginal<typeof import("./auth")>(), apiRequest: vi.fn() }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });

const centre = (over: Partial<Record<string, unknown>> = {}) => ({
  id: "c1", slug: "oxford-study", name: "Oxford Study Centre", join_code: "AAAAAAAAAAAAAAAA",
  include_global: true, disabled: false, students: 12, exams: 3, ...over,
});

it("hands the operator the invite link that onboards a centre's students", async () => {
  const request = vi.mocked(apiRequest);
  request.mockResolvedValueOnce({ centres: [centre()] });
  render(<CentresAdmin />);
  const link = await screen.findByLabelText("Invite link");
  // One URL is the whole onboarding path: it starts the bot, attaches the
  // student to the centre, and the bot sends back a login link.
  expect(link).toHaveValue("https://t.me/mockai_bot?start=c_AAAAAAAAAAAAAAAA");
  expect(link).toHaveAttribute("readonly");
  expect(screen.getByText(/12 students · 3 exams · global library included/)).toBeInTheDocument();
});

it("derives the link short name from the centre name so the common case is one field", async () => {
  const request = vi.mocked(apiRequest);
  request.mockResolvedValueOnce({ centres: [] });
  const user = userEvent.setup();
  render(<CentresAdmin />);
  await screen.findByText(/No centres yet/);
  await user.type(screen.getByLabelText("Centre name"), "Oxford Study Centre");
  expect(screen.getByLabelText("Short name in links")).toHaveValue("oxford-study-centre");
  request.mockResolvedValueOnce({ centre: centre() }).mockResolvedValueOnce({ centres: [centre()] });
  await user.click(screen.getByRole("button", { name: "Add centre" }));
  await waitFor(() => expect(request).toHaveBeenCalledWith("/api/v1/admin/centres", {
    method: "POST",
    body: JSON.stringify({ name: "Oxford Study Centre", slug: "oxford-study-centre", include_global: true }),
  }));
});

it("restores the previous state when a change cannot be saved", async () => {
  const request = vi.mocked(apiRequest);
  request.mockResolvedValueOnce({ centres: [centre()] });
  const user = userEvent.setup();
  render(<CentresAdmin />);
  const toggle = await screen.findByRole("checkbox", { name: "Global library" });
  expect(toggle).toBeChecked();
  request.mockRejectedValueOnce(new Error("Learning centre request failed"));
  await user.click(toggle);
  // An optimistic toggle that silently stays flipped would tell the operator a
  // centre is closed off when it is not.
  await waitFor(() => expect(screen.getByRole("checkbox", { name: "Global library" })).toBeChecked());
  expect(screen.getByRole("status")).toHaveTextContent("Learning centre request failed");
});
