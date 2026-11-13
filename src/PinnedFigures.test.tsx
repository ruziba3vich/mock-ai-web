import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import PinnedFigures from "./PinnedFigures";

it("shows one figure at a time and lets the student step through or hide them", async () => {
  const user = userEvent.setup();
  render(<PinnedFigures urls={["/a.png", "/b.png"]} title="Passage 1" />);
  expect(screen.getAllByRole("img")).toHaveLength(1);
  expect(screen.getByRole("img", { name: "Passage 1, figure 1" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Previous figure" })).toBeDisabled();

  await user.click(screen.getByRole("button", { name: "Next figure" }));
  expect(screen.getAllByRole("img")).toHaveLength(1);
  expect(screen.getByRole("img", { name: "Passage 1, figure 2" })).toHaveAttribute("src", "/b.png");
  expect(screen.getByRole("button", { name: "Next figure" })).toBeDisabled();

  await user.click(screen.getByRole("button", { name: "Hide figure" }));
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Show figure" }));
  expect(screen.getByRole("img", { name: "Passage 1, figure 2" })).toBeInTheDocument();
});

it("reports a portrait page scan so the host can lay it out as a page", () => {
  const onPortrait = vi.fn();
  render(<PinnedFigures urls={["/scan.png"]} title="Part 1" onPortrait={onPortrait} />);
  const img = screen.getByRole("img");
  Object.defineProperties(img, { naturalWidth: { value: 800 }, naturalHeight: { value: 1100 } });
  fireEvent.load(img);
  expect(onPortrait).toHaveBeenCalledTimes(1);
});
