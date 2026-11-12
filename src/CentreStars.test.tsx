import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import CentreStars from "./CentreStars";
import { centreStarsAPI } from "./stars";

vi.mock("./stars", async importOriginal => ({
  ...(await importOriginal<typeof import("./stars")>()),
  centreStarsAPI: { get: vi.fn(), grant: vi.fn(), buy: vi.fn(), purchaseStatus: vi.fn() },
}));

const activity = [
  { id: "l2", reason: "full_mock" as const, delta: -20, balance_after: 90, student_name: "Aziz Karimov", created_at: "2026-11-09T10:00:00Z" },
  { id: "l1", reason: "grant" as const, delta: 10, balance_after: 10, note: "Invoice 17", created_at: "2026-11-08T10:00:00Z" },
];

describe("centre stars panel", () => {
  it("shows a centre administrator the balance and who used stars, without a way to add them", async () => {
    vi.mocked(centreStarsAPI.get).mockResolvedValueOnce({ centre_id: "c1", balance: 90, full_mock_cost: 35, can_grant: false, activity });
    render(<CentreStars centreID="c1" />);
    expect(await screen.findByText("Enough for 2 full four-skill mocks with AI marking.")).toBeInTheDocument();
    expect(screen.getByText("Aziz Karimov started a mock")).toBeInTheDocument();
    expect(screen.getByText("-20")).toBeInTheDocument();
    expect(screen.getByText("Invoice 17")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add" })).not.toBeInTheDocument();
  });

  it("lets a platform administrator add stars with a note", async () => {
    vi.mocked(centreStarsAPI.get).mockResolvedValueOnce({ centre_id: "c1", balance: 0, full_mock_cost: 35, can_grant: true, activity: [] });
    vi.mocked(centreStarsAPI.grant).mockResolvedValueOnce({ centre_id: "c1", balance: 70, full_mock_cost: 35, can_grant: true, activity: [{ id: "l3", reason: "grant", delta: 70, balance_after: 70, note: "Contract Nov", created_at: "2026-11-10T10:00:00Z" }] });
    const user = userEvent.setup();
    render(<CentreStars centreID="c1" />);
    expect(await screen.findByText(/No stars left/)).toBeInTheDocument();
    const amount = screen.getByRole("spinbutton", { name: "How many to add" });
    await user.clear(amount); await user.type(amount, "70");
    await user.type(screen.getByRole("textbox", { name: /Note/ }), "Contract Nov");
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(centreStarsAPI.grant).toHaveBeenCalledWith("c1", 70, expect.any(String), "Contract Nov");
    expect(await screen.findByText("70 stars added.")).toBeInTheDocument();
    expect(screen.getByText("Enough for 2 full four-skill mocks with AI marking.")).toBeInTheDocument();
  });
  it("lets a centre administrator buy stars at the current price", async () => {
    vi.mocked(centreStarsAPI.get).mockResolvedValueOnce({ centre_id: "c1", balance: 3, full_mock_cost: 35, can_grant: false, can_buy: true, price_per_star_minor: 100_000, currency: "UZS", max_stars: 5000, payments_available: true, activity: [] });
    vi.mocked(centreStarsAPI.buy).mockRejectedValueOnce(new Error("stop before redirect"));
    const user = userEvent.setup();
    render(<CentreStars centreID="c1" />);
    const count = await screen.findByRole("spinbutton", { name: "How many to buy" });
    await user.clear(count); await user.type(count, "40");
    expect(screen.getByText("40 000 so'm")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Pay and add stars" }));
    expect(centreStarsAPI.buy).toHaveBeenCalledWith("c1", 40);
  });

  it("tells a centre administrator that online payment is coming when sales are closed", async () => {
    vi.mocked(centreStarsAPI.get).mockResolvedValueOnce({ centre_id: "c1", balance: 0, full_mock_cost: 35, can_grant: false, can_buy: true, price_per_star_minor: 100_000, currency: "UZS", max_stars: 5000, payments_available: false, activity: [] });
    render(<CentreStars centreID="c1" />);
    expect(await screen.findByText(/Online payment for centres is coming soon/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pay and add stars" })).not.toBeInTheDocument();
  });
});
