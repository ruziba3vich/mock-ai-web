import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import StarsPage from "./StarsPage";
import { APIError } from "./auth";
import { starsAPI } from "./stars";

vi.mock("./stars", async importOriginal => ({
  ...(await importOriginal<typeof import("./stars")>()),
  starsAPI: { overview: vi.fn(), spendOnFullMock: vi.fn(), purchase: vi.fn(), purchaseStatus: vi.fn() },
}));

const packages = [
  { id: "stars-1", stars: 1, amount_minor: 0, currency: "UZS", label: "One full mock" },
  { id: "stars-5", stars: 5, amount_minor: 4_000_000, currency: "UZS", label: "A month of weekly mocks", highlight: true },
];

describe("stars page", () => {
  it("shows the balance and explains that payments are coming soon", async () => {
    const user = userEvent.setup();
    render(<StarsPage overview={{ source: "personal" as const, balance: 0, full_mock_cost: 1, packages, payments_available: false }} outOfStars onRefresh={vi.fn()} onStartMock={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "You have 0 stars" })).toBeInTheDocument();
    expect(screen.getByText("You've used all your stars")).toBeInTheDocument();
    expect(screen.getByText("40 000 so'm")).toBeInTheDocument();
    expect(screen.getByText("Price coming soon")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Get 5 stars" }));
    expect(screen.getByRole("dialog", { name: "Payments are coming soon" })).toBeInTheDocument();
    expect(starsAPI.purchase).not.toHaveBeenCalled();
  });

  it("falls back to coming soon when the server says payments are off", async () => {
    vi.mocked(starsAPI.purchase).mockRejectedValueOnce(new APIError(503, "payments are coming soon"));
    const user = userEvent.setup();
    render(<StarsPage overview={{ source: "personal" as const, balance: 2, full_mock_cost: 1, packages, payments_available: true }} onRefresh={vi.fn()} onStartMock={vi.fn()} />);
    expect(screen.getByText("Enough for 2 full mocks.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Get 5 stars" }));
    expect(starsAPI.purchase).toHaveBeenCalledWith("stars-5");
    expect(await screen.findByRole("dialog", { name: "Payments are coming soon" })).toBeInTheDocument();
  });
  it("shows a centre student their centre's stars and nothing to buy", () => {
    render(<StarsPage overview={{ source: "centre", centre_name: "Cambridge Centre", balance: 0, full_mock_cost: 1, packages: [], payments_available: false }} outOfStars onRefresh={vi.fn()} onStartMock={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Cambridge Centre has 0 stars" })).toBeInTheDocument();
    expect(screen.getByText("Your centre has run out of stars")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Get more stars" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Get \d+ stars?/ })).not.toBeInTheDocument();
  });
});
