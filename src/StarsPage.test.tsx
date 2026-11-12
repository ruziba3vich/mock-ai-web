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

const personal = { source: "personal" as const, full_mock_cost: 35, price_per_star_minor: 100_000, currency: "UZS", max_stars: 5000 };

describe("stars page", () => {
  it("shows the balance and explains that payments are coming soon", async () => {
    const user = userEvent.setup();
    render(<StarsPage overview={{ ...personal, balance: 0, payments_available: false }} outOfStars onRefresh={vi.fn()} onStartMock={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "You have 0 stars" })).toBeInTheDocument();
    expect(screen.getByText("You've used all your stars")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Get 35 stars" }));
    expect(screen.getByRole("dialog", { name: "Payments are coming soon" })).toBeInTheDocument();
    expect(starsAPI.purchase).not.toHaveBeenCalled();
  });

  it("sells any number of stars at the price of one star each", async () => {
    vi.mocked(starsAPI.purchase).mockRejectedValueOnce(new Error("stop before redirect"));
    const user = userEvent.setup();
    render(<StarsPage overview={{ ...personal, balance: 70, payments_available: true }} onRefresh={vi.fn()} onStartMock={vi.fn()} />);
    expect(screen.getByText("Enough for 2 full mocks.")).toBeInTheDocument();
    const count = screen.getByRole("spinbutton", { name: "How many stars" });
    expect(screen.getByText("35 000 so'm")).toBeInTheDocument();
    await user.clear(count); await user.type(count, "12");
    expect(screen.getByText("12 000 so'm")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Get 12 stars" }));
    expect(starsAPI.purchase).toHaveBeenCalledWith(12);
  });

  it("falls back to coming soon when the server says payments are off", async () => {
    vi.mocked(starsAPI.purchase).mockRejectedValueOnce(new APIError(503, "payments are coming soon"));
    const user = userEvent.setup();
    render(<StarsPage overview={{ ...personal, balance: 70, payments_available: true }} onRefresh={vi.fn()} onStartMock={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Get 35 stars" }));
    expect(await screen.findByRole("dialog", { name: "Payments are coming soon" })).toBeInTheDocument();
  });

  it("shows a centre student their centre's stars and nothing to buy", () => {
    render(<StarsPage overview={{ source: "centre", centre_name: "Cambridge Centre", balance: 0, full_mock_cost: 35, payments_available: false }} outOfStars onRefresh={vi.fn()} onStartMock={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Cambridge Centre has 0 stars" })).toBeInTheDocument();
    expect(screen.getByText("Your centre has run out of stars")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Get stars" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Get \d+ stars?/ })).not.toBeInTheDocument();
  });
});
