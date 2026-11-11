import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import LandingPage from "./LandingPage";
afterEach(cleanup);

it("speaks to students and to learning centres", async () => {
  render(<LandingPage onSignIn={() => undefined} />);
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/Know your IELTS band/);
  // A centre arriving here must find its own answer, not only a student's.
  expect(screen.getByRole("heading", { name: "For learning centres" })).toBeInTheDocument();
  for (const claim of ["Your material stays yours", "Students join with one link", "Mark it yourself, or let the AI", "Your own admin panel"]) {
    expect(screen.getByRole("heading", { name: claim })).toBeInTheDocument();
  }
});

it("does not claim a model marks Reading or Listening", () => {
  render(<LandingPage onSignIn={() => undefined} />);
  // Reading and Listening are scored against a stored answer key. Saying
  // otherwise is a lie a student catches on their first attempt.
  // "Writing" and "Speaking" also head the feedback section, so scope to the
  // skill list rather than matching whichever came first.
  const skills = within(document.querySelector(".landing-skills") as HTMLElement);
  const reading = skills.getByRole("heading", { name: "Reading" }).closest("li")!;
  const listening = skills.getByRole("heading", { name: "Listening" }).closest("li")!;
  expect(reading).toHaveTextContent("Answer key");
  expect(listening).toHaveTextContent("Answer key");
  expect(reading).not.toHaveTextContent(/AI/);
  expect(listening).not.toHaveTextContent(/AI/);
  // And the two that are an estimate say so, next to the disclaimer.
  expect(skills.getByRole("heading", { name: "Writing" }).closest("li")).toHaveTextContent("AI estimate");
  expect(skills.getByRole("heading", { name: "Speaking" }).closest("li")).toHaveTextContent("AI estimate");
  // Stated in the section and again in the footer; both are deliberate.
  expect(screen.getAllByText(/not official IELTS\s+scores/).length).toBeGreaterThan(0);
});

it("hands a visitor to sign-in from every call to action", async () => {
  const onSignIn = vi.fn();
  const user = userEvent.setup();
  render(<LandingPage onSignIn={onSignIn} />);
  const buttons = screen.getAllByRole("button", { name: "Sign in on the web" });
  expect(buttons.length).toBeGreaterThan(1);
  for (const button of buttons) await user.click(button);
  expect(onSignIn).toHaveBeenCalledTimes(buttons.length);
});

it("opens the mock-ai bot in Telegram as the main action", () => {
  render(<LandingPage onSignIn={() => undefined} />);
  const links = screen.getAllByRole("link", { name: "Open in Telegram" });
  expect(links.length).toBeGreaterThan(1);
  for (const link of links) expect(link).toHaveAttribute("href", "https://t.me/mockai_bot");
  // Free allowance must match the Stars rules: one mock, one of each AI check.
  expect(screen.getByText(/one free full mock, one Writing check and one Speaking interview/)).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /I run a learning centre/ })).toHaveAttribute("href", "#centres");
});

it("lets an exam-room computer open its pairing screen from the header", () => {
  render(<LandingPage onSignIn={() => undefined} />);
  const nav = screen.getByRole("navigation", { name: "Sections" });
  expect(within(nav).getByRole("link", { name: "Join PC" })).toHaveAttribute("href", "/pc");
});
